import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DependencyPackage } from '../src/lib/discover-dependencies';
import { preparePackageMarkdown } from '../src/lib/prepare-package-markdown';

const fixture = await mkdtemp(join(tmpdir(), 'explorer-markdown-'));
const packageRoot = join(fixture, 'package');
const publicRoot = join(fixture, 'public');
const readme = join(packageRoot, 'README.md');
await mkdir(packageRoot, { recursive: true });
await writeFile(readme, '# Demo');

const dependency: DependencyPackage = {
    id: packageRoot,
    name: 'demo',
    version: '1.0.0',
    root: packageRoot,
    directKinds: [],
    requirements: [],
    dependencies: [],
    dependents: [],
    entrypoints: { exports: [], binaries: [] },
    engines: {},
};

afterAll(() => rm(fixture, { recursive: true, force: true }));

describe('preparePackageMarkdown', () => {
    test('copies nested badge images and their enclosing local links', async () => {
        await writeFile(join(packageRoot, 'logo.png'), 'image');
        await writeFile(join(packageRoot, 'guide.md'), '# Guide');

        const markdown = await preparePackageMarkdown(
            '[![Build](./logo.png)](./guide.md)',
            dependency,
            readme,
            publicRoot,
        );

        expect(markdown).toBe(
            '[![Build](/package-assets/demo/1.0.0/logo.png)](/package-assets/demo/1.0.0/guide.md)',
        );
        await access(join(publicRoot, 'package-assets', 'demo', '1.0.0', 'logo.png'));
        await access(join(publicRoot, 'package-assets', 'demo', '1.0.0', 'guide.md'));
    });

    test('rewrites the target rather than an identical reference label', async () => {
        const markdown = await preparePackageMarkdown(
            '[logo.png]: logo.png',
            dependency,
            readme,
            publicRoot,
        );

        expect(markdown).toBe('[logo.png]: /package-assets/demo/1.0.0/logo.png');
    });

    test('does not follow package symlinks outside the package root', async () => {
        const secret = join(fixture, 'secret.txt');
        const linked = join(packageRoot, 'linked-secret.txt');
        await writeFile(secret, 'TOP SECRET');
        await symlink(secret, linked);

        const markdown = await preparePackageMarkdown(
            '![Secret](./linked-secret.txt)',
            dependency,
            readme,
            publicRoot,
        );

        expect(markdown).toBe('![Secret](./linked-secret.txt)');
        await expect(
            access(join(publicRoot, 'package-assets', 'demo', '1.0.0', 'linked-secret.txt')),
        ).rejects.toThrow();
    });

    test('normalizes missing in-package fallbacks and preserves query fragments', async () => {
        const markdown = await preparePackageMarkdown(
            '![Missing](./images/../missing.png?raw=1#preview)\n[Outside](../outside.md)',
            dependency,
            readme,
            publicRoot,
        );

        expect(markdown).toContain('https://unpkg.com/demo@1.0.0/missing.png?raw=1#preview');
        expect(markdown).toContain('[Outside](../outside.md)');
    });

    test('copies HTML src and href targets locally', async () => {
        await writeFile(join(packageRoot, 'page.html'), '<p>Page</p>');
        const markdown = await preparePackageMarkdown(
            '<a href="./page.html">Page</a>',
            dependency,
            readme,
            publicRoot,
        );

        expect(markdown).toContain('href="/package-assets/demo/1.0.0/page.html"');
        expect(
            await readFile(
                join(publicRoot, 'package-assets', 'demo', '1.0.0', 'page.html'),
                'utf8',
            ),
        ).toBe('<p>Page</p>');
    });
});
