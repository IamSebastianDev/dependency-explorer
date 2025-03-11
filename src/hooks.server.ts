import type { Handle } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// We need to manually add the variable in dev mode,
// so that we can use the same env variable access
// in prod & dev
if (import.meta.env.DEV) {
	process.env.MANIFEST_PATH = (() => {
		return resolve(join(process.cwd(), '.dependencies.manifest.json'));
	})();
}

export const handle: Handle = async ({ event, resolve }) => {
	// Check and make sure that the manifest path environment variable
	// exists and is correctly set.
	const path = process.env.MANIFEST_PATH;
	if (!path) {
		throw new Error(`.env does not contain the needed 'MANIFEST_PATH' property.`);
	}

	// Check if the path exists and read the dependency manifest
	// If there is an error, we log it to the console and terminate
	// the process
	try {
		const manifest = await readFile(path, { encoding: 'utf-8' });
		event.locals.manifest = manifest;
		return resolve(event);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
};
