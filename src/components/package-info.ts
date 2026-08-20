import { $each, html } from '@grainular/nord';
import { decode } from './data';
import { Icon, type IconName } from './icon';
import type { PackagePageMeta } from './package-page-meta';

type PackageAction = {
    href: string;
    label: string;
    external: boolean;
    icon: IconName;
};

type PackageInfoData = {
    name: string;
    version: string;
    badges: string[];
    actions: PackageAction[];
};

export const PackageInfo = ({ meta }: { meta: PackagePageMeta }) => {
    if (!meta.dependencyExplorer) return html``;

    const value = decode<PackageInfoData>(meta.dependencyExplorer);
    return html`<header class="de-package-header">
        <h1>${value.name}</h1>
        <ul class="de-package-tags" aria-label="Package details">
            <li>
                <span class="de-package-tag"><code>${value.version}</code></span>
            </li>
            ${$each(() => value.badges).$as(
                (badge) =>
                    html`<li><span class="de-package-tag de-package-tag-kind">${badge}</span></li>`,
            )}
            ${$each(() => value.actions).$as((action) =>
                action.external
                    ? html`<li>
                          <a
                              class="de-package-tag"
                              href="${action.href}"
                              rel="noopener noreferrer"
                              target="_blank"
                              >${Icon({ name: action.icon })}<span>${action.label}</span></a
                          >
                      </li>`
                    : html`<li>
                          <a class="de-package-tag" href="${action.href}"
                              >${Icon({ name: action.icon })}<span>${action.label}</span></a
                          >
                      </li>`,
            )}
        </ul>
    </header>`;
};

export default PackageInfo;
