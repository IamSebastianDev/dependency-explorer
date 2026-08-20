import type { AuroraNavigationItem } from '@grainular/aurora';
import type { DependencyKind, DependencyPackage, DependencyProject } from './discover-dependencies';

export const groupLabels: Record<DependencyKind, string> = {
    dependencies: 'Runtime dependencies',
    devDependencies: 'Development dependencies',
    optionalDependencies: 'Optional dependencies',
    peerDependencies: 'Peer dependencies',
};

export const routeSegment = (value: string) => encodeURIComponent(value.replaceAll('/', '__'));
export const assetSegment = (value: string) => value.replaceAll('/', '__');
export const packageRoute = ({ name, version }: Pick<DependencyPackage, 'name' | 'version'>) =>
    `/packages/${routeSegment(name)}/${routeSegment(version)}`;

const unique = <Value extends string>(values: Value[][]): Value[] =>
    [...new Set<Value>(values.flat())].toSorted();

const mergePackages = (packages: DependencyPackage[]): DependencyPackage => {
    const candidates = packages.toSorted(
        (left, right) =>
            Number(Boolean(right.readme && right.changelog)) -
                Number(Boolean(left.readme && left.changelog)) ||
            Number(Boolean(right.readme)) - Number(Boolean(left.readme)) ||
            left.root.localeCompare(right.root),
    );
    const source = candidates[0]!;
    return {
        ...source,
        description: candidates.find(({ description }) => description)?.description,
        license: candidates.find(({ license }) => license)?.license,
        homepage: candidates.find(({ homepage }) => homepage)?.homepage,
        repository: candidates.find(({ repository }) => repository)?.repository,
        directKinds: unique(candidates.map(({ directKinds }) => directKinds)),
        requirements: unique(candidates.map(({ requirements }) => requirements)),
        dependencies: unique(candidates.map(({ dependencies }) => dependencies)),
        dependents: unique(candidates.map(({ dependents }) => dependents)),
        workspaces: unique(candidates.map(({ workspaces }) => workspaces)),
        entrypoints: {
            main: candidates.find(({ entrypoints }) => entrypoints.main)?.entrypoints.main,
            module: candidates.find(({ entrypoints }) => entrypoints.module)?.entrypoints.module,
            types: candidates.find(({ entrypoints }) => entrypoints.types)?.entrypoints.types,
            exports: unique(candidates.map(({ entrypoints }) => entrypoints.exports)),
            binaries: unique(candidates.map(({ entrypoints }) => entrypoints.binaries)),
        },
        engines: Object.assign({}, ...candidates.map(({ engines }) => engines)),
    };
};

export const documentedPackages = (packages: DependencyPackage[]) => {
    const grouped = new Map<string, DependencyPackage[]>();
    for (const dependency of packages) {
        const key = `${dependency.name}\0${dependency.version}`;
        const matches = grouped.get(key);
        if (matches) matches.push(dependency);
        else grouped.set(key, [dependency]);
    }
    return [...grouped.values()]
        .map(mergePackages)
        .filter((dependency) => dependency.readme !== undefined);
};

const navigationGroups = (groups: DependencyProject['groups']): AuroraNavigationItem[] =>
    (Object.entries(groups) as [DependencyKind, DependencyProject['groups'][DependencyKind]][])
        .map(([kind, branches]) => ({
            label: groupLabels[kind],
            children: (branches ?? [])
                .filter(({ package: dependency }) => dependency.readme)
                .map(({ package: dependency }) => ({
                    path: packageRoute(dependency),
                    label: `${dependency.name} ${dependency.version}`,
                })),
        }))
        .filter(({ children }) => children.length > 0);

export const createNavigation = (
    project: DependencyProject,
    packages: DependencyPackage[],
): AuroraNavigationItem[] => [
    { path: '/', label: 'Project overview' },
    { path: '/packages', label: `All packages (${packages.length})` },
    ...(project.workspaces.length > 1
        ? project.workspaces
              .map((workspace) => ({
                  label: workspace.name,
                  children: navigationGroups(workspace.groups),
              }))
              .filter(({ children }) => children.length > 0)
        : navigationGroups(project.groups)),
];
