import { build } from 'bun';
import { join, resolve } from 'node:path';

await build({
	entrypoints: [resolve(join(process.cwd(), './src/bin/index.ts'))],
	outdir: resolve(join(process.cwd(), './bin')),
	banner: '#!/usr/bin/env node\n',
	target: 'node'
});
