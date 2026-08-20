import type { AuroraNavigationItem } from '@grainular/aurora';
import type { DependencyKind, DependencyPackage, DependencyProject } from './discover-dependencies';

export const groupLabels: Record<DependencyKind, string> = {
    dependencies: 'Runtime dependencies',
    devDependencies: 'Development dependencies',
    optionalDependencies: 'Optional dependencies',
    peerDependencies: 'Peer dependencies',
};

export const routeSegment = (value: string) => encodeURIComponent(value.replaceAll('/', '__'));
export const assetSegment = (value: string) => value.replaceAll('/', '__');
export const packageRoute = ({ name, version }: Pick<DependencyPackage, 'name' | 'version'>) =>
    `/packages/${routeSegment(name)}/${routeSegment(version)}`;

export const documentedPackages = (packages: DependencyPackage[]) => {
    const unique = new Map<string, DependencyPackage>();
    for (const dependency of packages) {
        if (dependency.readme) unique.set(packageRoute(dependency), dependency);
    }
    return [...unique.values()];
};

export const createNavigation = (
    project: DependencyProject,
    packages: DependencyPackage[],
): AuroraNavigationItem[] => [
    { path: '/', label: 'Project overview' },
    { path: '/packages', label: `All packages (${packages.length})` },
    ...(
        Object.entries(project.groups) as [
            DependencyKind,
            (typeof project.groups)[DependencyKind],
        ][]
    )
        .map(([kind, branches]) => ({
            label: groupLabels[kind],
            children: (branches ?? [])
                .filter(({ package: dependency }) => dependency.readme)
                .map(({ package: dependency }) => ({
                    path: packageRoute(dependency),
                    label: `${dependency.name} ${dependency.version}`,
                })),
        }))
        .filter(({ children }) => children.length > 0),
];
