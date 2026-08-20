import { Outline } from '@grainular/aurora/runtime';
import { html } from '@grainular/nord';
import type { PackagePageMeta } from './package-page-meta';

// Package READMEs have arbitrary heading hierarchies, so Aurora's generated outline is misleading.
export const ExplorerOutline = ({ meta }: { meta: PackagePageMeta }) =>
    meta.dependencyExplorer ? html`` : Outline({ headings: meta.headings ?? [] });

export default ExplorerOutline;
