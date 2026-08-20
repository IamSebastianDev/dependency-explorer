import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { explorerTitle } from '../constants';
import { mapConcurrent } from './concurrency';
import { discoverDependencies } from './discover-dependencies';
import {
    changelogDocument,
    packageDocument,
    packageIndexDocument,
    projectIndexDocument,
} from './explorer-documents';
import { createNavigation, documentedPackages, routeSegment } from './explorer-routes';
import { findPackageRoot, linkRuntimePackages } from './link-runtime-packages';

export type ExplorerProjectOptions = {
    root?: string;
    temporaryDirectory?: string;
};

export type ExplorerProject = {
    root: string;
    packageCount: number;
    warnings: string[];
    remove: () => Promise<void>;
};

const packageDirectory = (docsRoot: string, name: string, version: string) =>
    join(docsRoot, 'packages', routeSegment(name), routeSegment(version));

const explorerPackageRoot = async () => {
    try {
        return await findPackageRoot('@iasd/explorer');
    } catch (error) {
        const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
        try {
            const manifest = JSON.parse(
                await readFile(join(sourceRoot, 'package.json'), 'utf8'),
            ) as {
                name?: string;
            };
            if (manifest.name === '@iasd/explorer') return sourceRoot;
        } catch {
            // The source-layout fallback is only valid while running this repository directly.
        }
        throw error;
    }
};

export const createExplorerProject = async ({
    root = process.cwd(),
    temporaryDirectory,
}: ExplorerProjectOptions = {}): Promise<ExplorerProject> => {
    const project = await discoverDependencies(root);
    const temporaryParent = temporaryDirectory ?? tmpdir();
    await mkdir(temporaryParent, { recursive: true });
    const generatedRoot = await mkdtemp(join(temporaryParent, 'explorer-'));

    try {
        const docsRoot = join(generatedRoot, 'docs');
        const publicRoot = join(generatedRoot, 'public');
        const packages = documentedPackages(project.packages);
        const navigation = createNavigation(project, packages);
        const packageRoot = await explorerPackageRoot();

        await Promise.all([
            mkdir(join(docsRoot, 'packages'), { recursive: true }),
            mkdir(publicRoot, { recursive: true }),
            symlink(
                join(packageRoot, 'dist', 'components'),
                join(generatedRoot, 'components'),
                process.platform === 'win32' ? 'junction' : 'dir',
            ),
            linkRuntimePackages(generatedRoot),
        ]);

        await mapConcurrent(packages, 16, async (dependency) => {
            const directory = packageDirectory(docsRoot, dependency.name, dependency.version);
            await mkdir(directory, { recursive: true });
            await Promise.all([
                writeFile(
                    join(directory, 'index.md'),
                    await packageDocument(dependency, publicRoot),
                ),
                dependency.changelog
                    ? writeFile(
                          join(directory, 'changelog.md'),
                          await changelogDocument(dependency, publicRoot),
                      )
                    : undefined,
            ]);
        });

        await Promise.all([
            writeFile(
                join(docsRoot, 'index.md'),
                projectIndexDocument(project, packages, explorerTitle),
            ),
            writeFile(join(docsRoot, 'packages', 'index.md'), packageIndexDocument(packages)),
            copyFile(join(packageRoot, 'src', 'custom.css'), join(generatedRoot, 'custom.css')),
            copyFile(
                join(packageRoot, 'src', 'markdown-transforms.ts'),
                join(generatedRoot, 'markdown-transforms.ts'),
            ),
            writeFile(
                join(generatedRoot, 'explorer.json'),
                JSON.stringify({ title: explorerTitle, navigation }, null, 4),
            ),
            copyFile(
                join(packageRoot, 'src', 'aurora-config.ts'),
                join(generatedRoot, 'aurora.config.ts'),
            ),
        ]);

        return {
            root: generatedRoot,
            packageCount: packages.length,
            warnings: project.warnings,
            remove: () => rm(generatedRoot, { recursive: true, force: true }),
        };
    } catch (error) {
        await rm(generatedRoot, { recursive: true, force: true });
        throw error;
    }
};
