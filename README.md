# Explører

> This repo was basically entirely vibe coded. No in depth review was performed, and this serves mostly as interesting proof of concept. Use at your own risk.

Instant local documentation for the packages installed in a JavaScript project.

```sh
npx @iasd/explorer
```

Explører walks the installed dependency tree, collects every bundled package README, and serves a temporary searchable [Aurora](https://aurora.nordjs.dev) documentation site. It documents the versions that are actually installed—not whichever version happens to be latest online.

The generated explorer includes:

- Separate runtime, development, optional, and peer dependency sections
- A grouped package sidebar and full-text documentation search
- Workspace-aware discovery with package usage badges for monorepos
- Exact installed versions and direct or transitive dependency status
- Repository, homepage, and bundled changelog links when packages provide them
- Bundled changelogs when packages ship them
- Locally copied README images and stable links for other package files
- A responsive, accessible interface built with Aurora and Nørd

The temporary site is deleted during normal shutdown. An abrupt process termination may leave its isolated directory in the operating system's temporary folder. Explører does not modify the inspected project.

Pass another project directory when needed:

```sh
npx @iasd/explorer ../my-project --open
```

Use `--host` and `--port` to change the local server address.

The target project must have a `package.json` and installed dependencies.

## Programmatic use

```ts
import { createExplorerProject, discoverDependencies } from '@iasd/explorer';

const dependencyTree = await discoverDependencies(process.cwd());
const site = await createExplorerProject({ root: process.cwd() });

console.log(site.root, site.packageCount);
await site.remove();
```

`discoverDependencies` returns normalized package metadata and graph relationships. `createExplorerProject` materializes an Aurora project that can be passed to Aurora's programmatic `dev` or `build` functions.

## Development

Install dependencies and the repository's Git hooks:

```sh
bun install
bun run hooks:install
```

Lefthook checks formatting and linting before commits, validates Conventional Commit messages, and runs the type-check and tests before pushes.
