import { readFile } from 'node:fs/promises';
import type { DependencyKind, DependencyPackage, DependencyProject } from './discover-dependencies';
import { groupLabels, packageRoute } from './explorer-routes';
import { preparePackageMarkdown } from './prepare-package-markdown';

// JSON strings are valid YAML 1.2 scalars and avoid maintaining a second escaping implementation.
const yaml = (value: string) => JSON.stringify(value);
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const component = (name: string, data: unknown) => `:::${name}{data="${encode(data)}"}\n:::`;

type PackageAction = {
    href: string;
    label: string;
    external: boolean;
    icon: 'git-branch' | 'external-link' | 'history';
};

const packageActions = (dependency: DependencyPackage): PackageAction[] =>
    [
        dependency.repository
            ? {
                  href: dependency.repository,
                  label: 'Repository',
                  external: true,
                  icon: 'git-branch' as const,
              }
            : undefined,
        dependency.homepage
            ? {
                  href: dependency.homepage,
                  label: 'Homepage',
                  external: true,
                  icon: 'external-link' as const,
              }
            : undefined,
        dependency.changelog
            ? {
                  href: `${packageRoute(dependency)}/changelog`,
                  label: 'Changelog',
                  external: false,
                  icon: 'history' as const,
              }
            : undefined,
    ].filter((action): action is PackageAction => action !== undefined);

export const packageDocument = async (dependency: DependencyPackage, publicRoot: string) => {
    const readme = await preparePackageMarkdown(
        await readFile(dependency.readme!, 'utf8'),
        dependency,
        dependency.readme!,
        publicRoot,
    );
    const explorerMeta = encode({
        name: dependency.name,
        version: dependency.version,
        badges: dependency.directKinds.length
            ? dependency.directKinds.map((kind) => groupLabels[kind])
            : ['Transitive'],
        actions: packageActions(dependency),
    });

    return `---
title: ${yaml(dependency.name)}
description: ${yaml(dependency.description ?? `${dependency.name} ${dependency.version}`)}
layout: docs
dependencyExplorer: ${yaml(explorerMeta)}
${dependency.repository ? `source: ${yaml(dependency.repository)}\n` : ''}---

${readme}
`;
};

export const changelogDocument = async (dependency: DependencyPackage, publicRoot: string) => `---
title: ${yaml(`${dependency.name} changelog`)}
description: ${yaml(`Release history bundled with ${dependency.name} ${dependency.version}`)}
layout: docs
${dependency.repository ? `source: ${yaml(dependency.repository)}\n` : ''}---

# ${dependency.name} changelog

${component('ActionLink', {
    href: packageRoute(dependency),
    label: `Back to ${dependency.name}`,
    icon: 'arrow-left',
})}

${await preparePackageMarkdown(
    await readFile(dependency.changelog!, 'utf8'),
    dependency,
    dependency.changelog!,
    publicRoot,
)}
`;

export const packageIndexDocument = (packages: DependencyPackage[]) => `---
title: All packages
description: Every installed package with bundled documentation.
layout: docs
---

# All packages

${component('Lead', `${packages.length} installed packages include documentation. Direct packages are marked separately for quick scanning.`)}

${component(
    'PackageList',
    packages.map((dependency) => ({
        href: packageRoute(dependency),
        name: dependency.name,
        version: dependency.version,
        description: dependency.description ?? 'No package description',
        direct: dependency.directKinds.length > 0,
    })),
)}
`;

export const projectIndexDocument = (
    project: DependencyProject,
    packages: DependencyPackage[],
    siteTitle: string,
) => {
    const direct = packages.filter((dependency) => dependency.directKinds.length > 0);
    const groups = (Object.keys(groupLabels) as DependencyKind[])
        .filter((kind) => project.groups[kind]?.length)
        .map(
            (kind) => `## ${groupLabels[kind]}

${component(
    'PackageGrid',
    direct
        .filter((dependency) => dependency.directKinds.includes(kind))
        .map((dependency) => ({
            href: packageRoute(dependency),
            name: dependency.name,
            version: dependency.version,
            description: dependency.description ?? 'Open bundled documentation',
        })),
)}`,
        )
        .join('\n\n');

    return `---
title: Overview
description: Installed package documentation and dependency relationships.
layout: docs
---

# ${siteTitle}

${component('Lead', 'Documentation for the exact package versions installed in this project—not whatever happens to be latest online.')}

${component('Stats', [
    { value: packages.length, label: 'documented packages' },
    { value: direct.length, label: 'direct dependencies' },
    { value: packages.length - direct.length, label: 'transitive packages' },
    {
        value: packages.filter((dependency) => dependency.changelog).length,
        label: 'bundled changelogs',
    },
])}

${component('ActionLink', { href: '/packages', label: 'Browse every package', icon: 'arrow-right' })}

${groups}
`;
};
