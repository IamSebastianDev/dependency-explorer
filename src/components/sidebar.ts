import type { AuroraRuntimeNavigationItem } from '@grainular/aurora';
import { context } from '@grainular/aurora/runtime';
import { $each, html } from '@grainular/nord';
import { explorerTitle } from '../constants';
import { Icon } from './icon';

const containsActive = (item: AuroraRuntimeNavigationItem): boolean =>
    item.active || item.children.some(containsActive);

const NavigationNode = (item: AuroraRuntimeNavigationItem) => {
    if (item.children.length === 0) {
        return item.active
            ? html`<a
                  class="de-navigation-link"
                  href="${item.path}"
                  title="${item.label}"
                  aria-current="page"
                  >${item.label}</a
              >`
            : html`<a class="de-navigation-link" href="${item.path}" title="${item.label}"
                  >${item.label}</a
              >`;
    }

    const summary = html`<summary>
        ${item.label}<span class="de-chevron" aria-hidden="true"
            >${Icon({ name: 'chevron-down' })}</span
        >
    </summary>`;
    const children = html`<div class="de-navigation-children">
        ${$each(() => item.children).$as(NavigationNode)}
    </div>`;

    return containsActive(item)
        ? html`<details class="de-navigation-group" open>${summary}${children}</details>`
        : html`<details class="de-navigation-group">${summary}${children}</details>`;
};

export const Sidebar = () => {
    const current = context();
    const routes = current.routes ?? [];
    const base = current.base ?? '/';
    const title = current.title ?? explorerTitle;

    return html`<aside class="aurora-sidebar de-sidebar">
        <a class="aurora-brand" href="${base}" aria-label="${title} home">
            <span class="de-brand-mark" aria-hidden="true">${Icon({ name: 'package' })}</span
            ><span>${title}</span>
        </a>
        <div class="aurora-sidebar-body">
            <nav
                id="aurora-sidebar-navigation"
                class="de-navigation"
                aria-label="Package navigation"
            >
                ${$each(() => routes).$as(NavigationNode)}
            </nav>
        </div>
    </aside>`;
};

export default Sidebar;
