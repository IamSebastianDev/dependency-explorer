import { copyFile, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { createLimiter } from './concurrency';
import type { DependencyPackage } from './discover-dependencies';
import { assetSegment } from './explorer-routes';

const asyncReplace = async (
    value: string,
    pattern: RegExp,
    replace: (match: RegExpExecArray) => Promise<string>,
) => {
    let result = '';
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
        result += value.slice(cursor, match.index) + (await replace(match));
        cursor = (match.index ?? 0) + match[0].length;
    }
    return result + value.slice(cursor);
};

const replaceLast = (value: string, target: string, replacement: string) => {
    const index = value.lastIndexOf(target);
    return index < 0
        ? value
        : value.slice(0, index) + replacement + value.slice(index + target.length);
};

const isExternalTarget = (target: string) => /^(?:[a-z]+:|#|\/\/)/i.test(target);
const io = createLimiter(32);

type RewriteTargetOptions = {
    dependency: DependencyPackage;
    source: string;
    publicRoot: string;
    assetBase: string;
    target: string;
    packageRealRoot: string;
};

const rewriteTarget = async ({
    dependency,
    source,
    publicRoot,
    assetBase,
    target,
    packageRealRoot,
}: RewriteTargetOptions) => {
    const wrapped = target.startsWith('<') && target.endsWith('>');
    const raw = wrapped ? target.slice(1, -1) : target;
    if (!raw || isExternalTarget(raw) || raw.startsWith('data:')) return target;

    const [, pathname = raw, suffix = ''] = raw.match(/^([^?#]*)([?#].*)?$/) ?? [];
    let decoded = pathname;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        // Keep malformed escape sequences as authored.
    }

    const candidate = resolve(
        pathname.startsWith('/') ? dependency.root : dirname(source),
        decoded.replace(/^\//, ''),
    );
    const localPath = relative(dependency.root, candidate);
    const insidePackage =
        localPath !== '..' && !localPath.startsWith(`..${sep}`) && !isAbsolute(localPath);

    if (!insidePackage) return target;

    try {
        const [entry, resolved] = await Promise.all([
            io(() => lstat(candidate)),
            io(() => realpath(candidate)),
        ]);
        const resolvedPath = relative(packageRealRoot, resolved);
        const resolvedInsidePackage =
            resolvedPath !== '..' &&
            !resolvedPath.startsWith(`..${sep}`) &&
            !isAbsolute(resolvedPath);
        if (!resolvedInsidePackage) return target;

        if (!entry.isSymbolicLink() && (await io(() => stat(resolved))).isFile()) {
            const destination = join(publicRoot, assetBase, localPath);
            await io(() => mkdir(dirname(destination), { recursive: true }));
            await io(() => copyFile(resolved, destination));
            const href = `/${[...assetBase.split(sep), ...localPath.split(sep)]
                .map(encodeURIComponent)
                .join('/')}${suffix}`;
            return wrapped ? `<${href}>` : href;
        }
    } catch {
        // Fall through to the immutable package CDN URL.
    }

    const fallbackPath = posix.normalize(localPath.split(sep).join('/'));
    return `https://unpkg.com/${dependency.name}@${dependency.version}/${encodeURI(fallbackPath)}${suffix}`;
};

export const preparePackageMarkdown = async (
    markdown: string,
    dependency: DependencyPackage,
    source: string,
    publicRoot: string,
) => {
    const assetBase = join(
        'package-assets',
        assetSegment(dependency.name),
        assetSegment(dependency.version),
    );
    const packageRealRoot = await io(() => realpath(dependency.root));
    const rewrite = (target: string) =>
        rewriteTarget({ dependency, source, publicRoot, assetBase, target, packageRealRoot });

    let prepared = await asyncReplace(
        markdown,
        /!\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g,
        async (match) => replaceLast(match[0], match[1], await rewrite(match[1])),
    );
    prepared = await asyncReplace(
        prepared,
        /(?<!!)\[(?:!\[[^\]\n]*\]\([^\n)]*\)|[^\]\n])*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g,
        async (match) => replaceLast(match[0], match[1], await rewrite(match[1])),
    );
    prepared = await asyncReplace(prepared, /^\s*\[[^\]\n]+\]:\s*(<[^>]+>|\S+)/gm, async (match) =>
        replaceLast(match[0], match[1], await rewrite(match[1])),
    );
    return asyncReplace(prepared, /\b(?:src|href)=(['"])([^'"]+)\1/gi, async (match) =>
        match[0].replace(match[2], await rewrite(match[2])),
    );
};
