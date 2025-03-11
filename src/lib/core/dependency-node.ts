import { join, resolve } from 'node:path';
import type { DependencyType } from '../models/dependency-type';

type NodeArgs = {
	root: string;
	name: string;
	version: string;
	type: DependencyType;
};

export class DependencyNode {
	private readonly _root: string;
	readonly type: DependencyType;
	readonly name: string;
	readonly version: string;
	constructor(args: NodeArgs) {
		this._root = resolve(args.root);
		this.type = args.type;
		this.name = args.name;
		this.version = args.version;
	}

	get id() {
		return `${this.name}@${this.version}`;
	}

	get pkg() {
		return join(this._root, 'node_modules', this.name, 'package.json');
	}

	get root() {
		return join(this._root, 'node_modules', this.name);
	}

	get entry() {
		return {
			...this,
			id: this.id,
			pkg: this.pkg,
			root: this.root
		};
	}
}
