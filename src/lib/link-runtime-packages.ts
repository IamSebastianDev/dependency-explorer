import { mkdir, readFile, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimePackages = ['@grainular/aurora', '@grainular/grains', '@grainular/nord'];

export const findPackageRoot = async (name: string) => {
    let directory = dirname(fileURLToPath(import.meta.resolve(name)));
    while (true) {
        try {
            const manifest = JSON.parse(
                await readFile(join(directory, 'package.json'), 'utf8'),
            ) as {
                name?: string;
            };
            if (manifest.name === name) return directory;
        } catch {
            // Keep walking from the resolved entry until its owning package is found.
        }
        const parent = dirname(directory);
        if (parent === directory) throw new Error(`Could not locate installed package ${name}.`);
        directory = parent;
    }
};

export const linkRuntimePackages = async (root: string) => {
    await Promise.all(
        runtimePackages.map(async (name) => {
            const target = join(root, 'node_modules', ...name.split('/'));
            await mkdir(dirname(target), { recursive: true });
            await symlink(await findPackageRoot(name), target, 'junction');
        }),
    );
};
