#!/usr/bin/env node

import { dev } from '@grainular/aurora';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createExplorerProject } from './lib/create-explorer-project';

const usage = `explorer [project] [options]

Instantly browse the README documentation for a project's installed packages.

Options:
  --host <host>  Server host (default: localhost)
  --port <port>  Server port (default: 31415)
  --open         Open the explorer in a browser
  -h, --help     Show this help
`;

export const main = async (args = process.argv.slice(2)) => {
    const { positionals, values } = parseArgs({
        args,
        allowPositionals: true,
        options: {
            host: { type: 'string', default: 'localhost' },
            port: { type: 'string', default: '31415' },
            open: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
    });

    if (values.help) {
        console.log(usage);
        return;
    }
    if (positionals.length > 1) throw new Error('Expected at most one project directory.');

    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error(`Invalid port: ${values.port}`);
    }

    const sourceRoot = resolve(positionals[0] ?? process.cwd());
    const generated = await createExplorerProject({ root: sourceRoot });
    let server: Awaited<ReturnType<typeof dev>> | undefined;
    let closing = false;

    const close = async () => {
        if (closing) return;
        closing = true;
        await server?.close();
        await generated.remove();
    };

    process.once('SIGINT', () => void close());
    process.once('SIGTERM', () => void close());

    try {
        if (!['localhost', '127.0.0.1', '::1'].includes(values.host)) {
            console.warn(
                `Warning: --host ${values.host} exposes installed package documentation and copied README assets to the network.`,
            );
        }
        server = await dev({
            root: generated.root,
            host: values.host,
            port,
            open: values.open,
        });
        for (const warning of generated.warnings) console.warn(`Warning: ${warning}`);
        console.log(`\nExplører found ${generated.packageCount} documented packages.`);
        server.printUrls();
    } catch (error) {
        await close();
        throw error;
    }
};

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
