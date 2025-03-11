#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '../build/index.js');

const child = spawn('node', [serverPath], {
	stdio: 'inherit',
	env: {
		INIT_CWD: process.cwd()
	}
});

child.on('close', (code) => {
	process.exit(code);
});
