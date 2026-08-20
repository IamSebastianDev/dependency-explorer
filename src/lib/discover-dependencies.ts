import { access, readFile, realpath } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { createLimiter } from './concurrency';

export type DependencyKind =
    | 'dependencies'
    | 'devDependencies'
    | 'optionalDependencies'
    | 'peerDependencies';

export type DependencyEntrypoints = {
    main?: string;
    module?: string;
    types?: string;
    exports: string[];
    binaries: string[];
};

export type DependencyPackage = {
    id: string;
    name: string;
    version: string;
    root: string;
    description?: string;
    license?: string;
    homepage?: string;
    repository?: string;
    readme?: string;
    changelog?: string;
    directKinds: DependencyKind[];
    requirements: string[];
    dependencies: string[];
    dependents: string[];
    entrypoints: DependencyEntrypoints;
    engines: Record<string, string>;
};

export type DependencyBranch = {
    package: DependencyPackage;
    children: DependencyBranch[];
};

export type DependencyProject = {
    name: string;
    version?: string;
    root: string;
    packages: DependencyPackage[];
    groups: Partial<Record<DependencyKind, DependencyBranch[]>>;
    warnings: string[];
};

type PackageJson = {
    name?: string;
    version?: string;
    description?: string;
    license?: string;
    homepage?: string;
    main?: string;
    module?: string;
    types?: string;
    typings?: string;
    exports?: unknown;
    bin?: string | Record<string, string>;
    engines?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    repository?: string | { url?: string; directory?: string };
};

const dependencyKinds: DependencyKind[] = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];

const io = createLimiter(32);

const exists = async (path: string) => {
    try {
        await io(() => access(path));
        return true;
    } catch {
        return false;
    }
};

const readPackageJson = async (root: string): Promise<PackageJson> => {
    const path = join(root, 'package.json');
    const source = (await io(() => readFile(path, 'utf8'))).replace(/^\uFEFF/, '');
    try {
        return JSON.parse(source) as PackageJson;
    } catch (error) {
        throw new Error(
            `Could not parse ${path}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        );
    }
};

const findPackageRoot = async (from: string, name: string): Promise<string | undefined> => {
    let directory = resolve(from);
    const filesystemRoot = parse(directory).root;

    while (true) {
        const candidate = join(directory, 'node_modules', ...name.split('/'));
        if (await exists(join(candidate, 'package.json'))) return io(() => realpath(candidate));
        if (directory === filesystemRoot) return undefined;
        directory = dirname(directory);
    }
};

const findFirstFile = async (root: string, names: string[]) => {
    for (const name of names) {
        const candidate = join(root, name);
        if (await exists(candidate)) return candidate;
    }
};

const safeExternalUrl = (value: string | undefined) => {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
    } catch {
        return undefined;
    }
};

export const repositoryUrl = (repository: PackageJson['repository']) => {
    const value = typeof repository === 'string' ? repository : repository?.url;
    if (!value) return undefined;

    const shorthands: Record<string, string> = {
        github: 'github.com',
        gitlab: 'gitlab.com',
        bitbucket: 'bitbucket.org',
        gist: 'gist.github.com',
    };
    let normalized = value.trim().replace(/^git\+/, '');
    const shorthand = normalized.match(/^(github|gitlab|bitbucket|gist):(.+)$/i);
    if (shorthand)
        normalized = `https://${shorthands[shorthand[1]!.toLowerCase()]}/${shorthand[2]}`;
    normalized = normalized
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/^ssh:\/\/git@([^/]+)\//, 'https://$1/')
        .replace(/^git:\/\//, 'https://');
    if (/^[\w.-]+\/[\w.-]+$/.test(normalized)) normalized = `https://github.com/${normalized}`;

    const safe = safeExternalUrl(normalized);
    if (!safe) return undefined;
    const url = new URL(safe);
    url.pathname = url.pathname.replace(/\.git$/, '');
    const directory = typeof repository === 'object' ? repository.directory : undefined;
    if (directory) {
        const tree = url.hostname === 'gitlab.com' ? '/-/tree/HEAD/' : '/tree/HEAD/';
        url.pathname = `${url.pathname.replace(/\/$/, '')}${tree}${directory.replace(/^\//, '')}`;
    }
    return url.href.replace(/\/$/, '');
};

const exportedPaths = (value: unknown) => {
    if (!value) return [];
    if (typeof value === 'string' || Array.isArray(value)) return ['.'];
    if (typeof value !== 'object') return [];

    const keys = Object.keys(value);
    const paths = keys.filter((key) => key.startsWith('.'));
    return paths.length > 0 ? paths.toSorted() : ['.'];
};

const binaryNames = (value: PackageJson['bin'], packageName: string) => {
    if (!value) return [];
    if (typeof value === 'string') return [packageName.replace(/^@[^/]+\//, '')];
    return Object.keys(value).toSorted();
};

const uniquePush = <T>(items: T[], value: T | undefined) => {
    if (value !== undefined && !items.includes(value)) items.push(value);
};

export const discoverDependencies = async (
    projectRoot = process.cwd(),
): Promise<DependencyProject> => {
    const root = resolve(projectRoot);
    let rootPackage: PackageJson;
    try {
        rootPackage = await readPackageJson(root);
    } catch (error) {
        throw new Error(
            `Could not read the project package.json in ${root}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        );
    }

    const packages = new Map<string, DependencyPackage>();
    const packageLoads = new Map<
        string,
        Promise<{ dependency: DependencyPackage; pkg: PackageJson } | undefined>
    >();
    const expanded = new Set<string>();
    const warnings: string[] = [];

    const loadPackage = (packageRoot: string, requestedName: string) => {
        const existing = packageLoads.get(packageRoot);
        if (existing) return existing;

        const pending = (async () => {
            let pkg: PackageJson;
            try {
                pkg = await readPackageJson(packageRoot);
            } catch (error) {
                warnings.push(
                    `Skipped ${requestedName} at ${packageRoot}: ${error instanceof Error ? error.message : String(error)}`,
                );
                return undefined;
            }

            const [readme, changelog] = await Promise.all([
                findFirstFile(packageRoot, [
                    'README.md',
                    'readme.md',
                    'Readme.md',
                    'README.markdown',
                    'readme.markdown',
                ]),
                findFirstFile(packageRoot, [
                    'CHANGELOG.md',
                    'Changelog.md',
                    'changelog.md',
                    'CHANGES.md',
                    'HISTORY.md',
                ]),
            ]);
            const dependency: DependencyPackage = {
                id: packageRoot,
                name: pkg.name ?? requestedName,
                version: pkg.version ?? 'unknown',
                root: packageRoot,
                description: pkg.description,
                license: pkg.license,
                homepage: safeExternalUrl(pkg.homepage),
                repository: repositoryUrl(pkg.repository),
                readme,
                changelog,
                directKinds: [],
                requirements: [],
                dependencies: [],
                dependents: [],
                entrypoints: {
                    main: pkg.main,
                    module: pkg.module,
                    types: pkg.types ?? pkg.typings,
                    exports: exportedPaths(pkg.exports),
                    binaries: binaryNames(pkg.bin, pkg.name ?? requestedName),
                },
                engines: pkg.engines ?? {},
            };
            packages.set(packageRoot, dependency);
            return { dependency, pkg };
        })();
        packageLoads.set(packageRoot, pending);
        return pending;
    };

    const visit = async ({
        ancestors,
        directKind,
        from,
        name,
        parentId,
        requirement,
    }: {
        ancestors: Set<string>;
        directKind?: DependencyKind;
        from: string;
        name: string;
        parentId?: string;
        requirement?: string;
    }): Promise<DependencyPackage | undefined> => {
        const packageRoot = await findPackageRoot(from, name);
        if (!packageRoot) return undefined;

        const loaded = await loadPackage(packageRoot, name);
        if (!loaded) return undefined;
        const { dependency, pkg } = loaded;
        const id = dependency.id;

        uniquePush(dependency.directKinds, directKind);
        uniquePush(dependency.requirements, requirement);
        uniquePush(dependency.dependents, parentId);
        if (parentId) {
            const parent = packages.get(parentId);
            if (!parent)
                throw new Error(`Internal dependency graph error: missing parent ${parentId}.`);
            uniquePush(parent.dependencies, id);
        }

        if (ancestors.has(id) || expanded.has(id)) return dependency;
        expanded.add(id);

        const nextAncestors = new Set(ancestors).add(id);
        // Peer dependencies describe host requirements and are intentionally not installed children.
        await Promise.all(
            Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })
                .toSorted(([left], [right]) => left.localeCompare(right))
                .map(([child, range]) =>
                    visit({
                        name: child,
                        requirement: range,
                        from: packageRoot,
                        parentId: id,
                        ancestors: nextAncestors,
                    }),
                ),
        );

        return dependency;
    };

    const groupPackages: Partial<Record<DependencyKind, DependencyPackage[]>> = {};
    for (const kind of dependencyKinds) {
        const dependencies = Object.entries(rootPackage[kind] ?? {}).toSorted(([left], [right]) =>
            left.localeCompare(right),
        );
        if (dependencies.length === 0) continue;
        groupPackages[kind] = (
            await Promise.all(
                dependencies.map(([name, range]) =>
                    visit({
                        name,
                        requirement: range,
                        directKind: kind,
                        from: root,
                        ancestors: new Set(),
                    }),
                ),
            )
        ).filter((dependency): dependency is DependencyPackage => dependency !== undefined);
    }

    for (const dependency of packages.values()) {
        dependency.directKinds.sort();
        dependency.requirements.sort();
        dependency.dependencies.sort();
        dependency.dependents.sort();
    }

    const branchFor = (
        dependency: DependencyPackage,
        ancestors = new Set<string>(),
    ): DependencyBranch => {
        if (ancestors.has(dependency.id)) return { package: dependency, children: [] };
        const nextAncestors = new Set(ancestors).add(dependency.id);
        return {
            package: dependency,
            children: dependency.dependencies
                .map((id) => packages.get(id))
                .filter((child): child is DependencyPackage => child !== undefined)
                .map((child) => branchFor(child, nextAncestors)),
        };
    };
    const groups = Object.fromEntries(
        Object.entries(groupPackages).map(([kind, dependencies]) => [
            kind,
            dependencies.map((dependency) => branchFor(dependency)),
        ]),
    ) as DependencyProject['groups'];

    return {
        name: rootPackage.name ?? 'Project',
        version: rootPackage.version,
        root,
        packages: [...packages.values()].toSorted(
            (left, right) =>
                left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
        ),
        groups,
        warnings: warnings.toSorted(),
    };
};
