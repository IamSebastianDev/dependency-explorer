import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DependencyType } from '../models/dependency-type';
import { DependencyNode } from './dependency-node';

export class Manifest {
	private nodes = new Map<string, DependencyNode['entry']>();
	constructor(private readonly opts: { root: string; pkg: string }) {}

	private createNode(name: string, version: string, type: DependencyType) {
		return new DependencyNode({ root: dirname(this.opts.pkg), name, version, type });
	}

	async createDependencyMap() {
		const pkg = JSON.parse(await readFile(this.opts.pkg, { encoding: 'utf-8' }));

		for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
			const node = this.createNode(name, version as string, DependencyType.APP);
			this.nodes.set(node.id, node.entry);
		}
		for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
			const node = this.createNode(name, version as string, DependencyType.DEV);
			this.nodes.set(node.id, node.entry);
		}
		for (const [name, version] of Object.entries(pkg.peerDependencies ?? {})) {
			const node = this.createNode(name, version as string, DependencyType.PEER);
			this.nodes.set(node.id, node.entry);
		}
	}

	async write() {
		const data = JSON.stringify(Object.fromEntries(this.nodes.entries()));
		await writeFile(this.opts.root, data, { encoding: 'utf-8' });
	}
	async remove() {
		await rm(this.opts.root, { force: true });
	}
}
