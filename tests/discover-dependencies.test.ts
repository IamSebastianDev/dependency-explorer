import { afterAll, describe, expect, test } from 'bun:test';
import { access, lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExplorerProject } from '../src/lib/create-explorer-project';
import { discoverDependencies, repositoryUrl } from '../src/lib/discover-dependencies';
import { preserveEscapedTemplatePlaceholders } from '../src/markdown-transforms';
import { ExplorerOutline } from '../src/components/outline';
import { PackageInfo } from '../src/components/package-info';
import { Sidebar } from '../src/components/sidebar';

const fixture = await mkdtemp(join(tmpdir(), 'explorer-test-'));

const writePackage = async (root: string, pkg: Record<string, unknown>, readme?: string) => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
    if (readme) await writeFile(join(root, 'README.md'), readme);
};

await writePackage(fixture, {
    name: 'fixture',
    dependencies: { alpha: '^1.0.0' },
    devDependencies: { beta: '^2.0.0' },
});
await writePackage(
    join(fixture, 'node_modules', 'alpha'),
    {
        name: 'alpha',
        version: '1.0.0',
        dependencies: { shared: '^3.0.0' },
        repository: 'git+https://github.com/example/alpha.git',
    },
    '# Alpha\n\n![Logo](./logo.svg)',
);
await writeFile(join(fixture, 'node_modules', 'alpha', 'logo.svg'), '<svg></svg>');
await writeFile(join(fixture, 'node_modules', 'alpha', 'CHANGELOG.md'), '# Changes\n\n## 1.0.0');
await writePackage(
    join(fixture, 'node_modules', 'beta'),
    { name: 'beta', version: '2.0.0', dependencies: { shared: '^3.0.0' } },
    '# Beta',
);
await writePackage(
    join(fixture, 'node_modules', 'shared'),
    { name: 'shared', version: '3.0.0' },
    '# Shared',
);

afterAll(() => rm(fixture, { recursive: true, force: true }));

describe('discoverDependencies', () => {
    test('preserves escaped template placeholders through Nørd Markdown compilation', () => {
        expect(preserveEscapedTemplatePlaceholders('\\${license:ISC}')).toBe('\\\\${license:ISC}');
        expect(preserveEscapedTemplatePlaceholders('\\\\${alreadyEven}')).toBe(
            '\\\\${alreadyEven}',
        );
        expect(preserveEscapedTemplatePlaceholders('${alreadyHandled}')).toBe('${alreadyHandled}');
    });

    test('discovers grouped direct dependencies and deduplicates shared packages', async () => {
        const project = await discoverDependencies(fixture);

        expect(project.name).toBe('fixture');
        expect(project.groups.dependencies?.[0]?.package.name).toBe('alpha');
        expect(project.groups.devDependencies?.[0]?.package.name).toBe('beta');
        expect(project.packages.map(({ name }) => name)).toEqual(['alpha', 'beta', 'shared']);

        const shared = project.packages.find(({ name }) => name === 'shared');
        expect(shared?.dependents).toHaveLength(2);
    });

    test('retains every reverse edge when siblings share a dependency concurrently', async () => {
        const root = await mkdtemp(join(tmpdir(), 'explorer-race-'));
        const dependencies = Object.fromEntries(
            Array.from({ length: 12 }, (_, index) => [`direct-${index}`, '1.0.0']),
        );
        await writePackage(root, { name: 'race-fixture', dependencies });
        await Promise.all(
            Object.keys(dependencies).map((name) =>
                writePackage(join(root, 'node_modules', name), {
                    name,
                    version: '1.0.0',
                    dependencies: { shared: '^3.0.0' },
                }),
            ),
        );
        await writePackage(join(root, 'node_modules', 'shared'), {
            name: 'shared',
            version: '3.0.0',
        });

        try {
            const project = await discoverDependencies(root);
            expect(project.packages.find(({ name }) => name === 'shared')?.dependents).toHaveLength(
                12,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    test('skips malformed dependency manifests with a contextual warning', async () => {
        const root = await mkdtemp(join(tmpdir(), 'explorer-malformed-'));
        await writePackage(root, { name: 'malformed-fixture', dependencies: { broken: '1.0.0' } });
        const broken = join(root, 'node_modules', 'broken');
        await mkdir(broken, { recursive: true });
        await writeFile(join(broken, 'package.json'), '{ invalid json');

        try {
            const project = await discoverDependencies(root);
            expect(project.packages).toHaveLength(0);
            expect(project.warnings[0]).toContain('Skipped broken');
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    test('normalizes supported repository forms and rejects unsafe schemes', () => {
        expect(repositoryUrl('gitlab:grainular/nord')).toBe('https://gitlab.com/grainular/nord');
        expect(repositoryUrl('git@gitlab.com:grainular/nord.git')).toBe(
            'https://gitlab.com/grainular/nord',
        );
        expect(repositoryUrl('git+ssh://git@github.com/grainular/nord.git')).toBe(
            'https://github.com/grainular/nord',
        );
        expect(repositoryUrl('https://github.com/grainular/nord.git#main')).toBe(
            'https://github.com/grainular/nord#main',
        );
        expect(repositoryUrl('javascript:alert(1)//a/b')).toBeUndefined();
    });

    test('normalizes repository URLs and locates README files', async () => {
        const project = await discoverDependencies(fixture);
        const alpha = project.packages.find(({ name }) => name === 'alpha');

        expect(alpha?.repository).toBe('https://github.com/example/alpha');
        expect(alpha?.readme).toEndWith('node_modules/alpha/README.md');
        expect(alpha?.directKinds).toEqual(['dependencies']);
        expect(alpha?.entrypoints.exports).toEqual([]);
    });

    test('reports a contextual error when the project manifest cannot be read', async () => {
        await expect(discoverDependencies(join(fixture, 'missing-project'))).rejects.toThrow(
            'Could not read the project package.json',
        );
    });

    test('generates rich Aurora pages using packaged components and local README assets', async () => {
        const temporaryParent = join(fixture, '.generated');
        const marker = join(temporaryParent, 'keep.txt');
        await mkdir(temporaryParent, { recursive: true });
        await writeFile(marker, 'keep');
        const generated = await createExplorerProject({
            root: fixture,
            temporaryDirectory: temporaryParent,
        });
        const output = generated.root;

        const page = await readFile(
            join(output, 'docs', 'packages', 'alpha', '1.0.0', 'index.md'),
            'utf8',
        );
        const config = await readFile(join(output, 'aurora.config.ts'), 'utf8');
        const sourceConfig = await readFile(
            join(import.meta.dir, '..', 'src', 'aurora-config.ts'),
            'utf8',
        );
        const explorer = JSON.parse(await readFile(join(output, 'explorer.json'), 'utf8')) as {
            title: string;
            navigation: unknown[];
        };
        const overview = await readFile(join(output, 'docs', 'index.md'), 'utf8');
        const changelog = await readFile(
            join(output, 'docs', 'packages', 'alpha', '1.0.0', 'changelog.md'),
            'utf8',
        );

        expect(generated.packageCount).toBe(3);
        expect(page).toContain('dependencyExplorer:');
        expect(page).toContain('# Alpha');
        expect(page).not.toContain(':::PackageInfo');
        expect(page).not.toContain('## Relationships');
        expect(page).not.toContain('## README');
        expect(page).toContain('/package-assets/alpha/1.0.0/logo.svg');
        expect(config).toContain("component: () => import('./components/sidebar')");
        expect(config).toBe(sourceConfig);
        expect(config).not.toContain('JSON.stringify');
        expect(config).toContain('title: explorer.title');
        expect(explorer.title).toBe('Explører');
        expect(explorer.navigation).toHaveLength(4);
        expect(overview).toContain('title: Overview');
        expect(overview).toContain('# Explører');
        expect(config).toContain("name: 'ActionLink'");
        expect(config).toContain("name: 'Lead'");
        expect(config).toContain('beforeContent:');
        expect(config).toContain("component: () => import('./components/package-info')");
        expect(config).toContain("component: () => import('./components/outline')");
        expect(config).toContain('client: true');
        expect(Sidebar).toBeFunction();
        expect(PackageInfo).toBeFunction();
        expect(ExplorerOutline).toBeFunction();
        expect((await lstat(join(output, 'components'))).isSymbolicLink()).toBeTrue();
        expect(changelog).not.toContain('←');
        await access(join(output, 'public', 'package-assets', 'alpha', '1.0.0', 'logo.svg'));
        await generated.remove();
        await expect(access(output)).rejects.toThrow();
        expect(await readFile(marker, 'utf8')).toBe('keep');
    });
});
