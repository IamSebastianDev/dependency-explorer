import { defineConfig, type AuroraNavigationItem } from '@grainular/aurora';
import { Docs } from '@grainular/aurora/runtime';
import { readFileSync } from 'node:fs';
import { preserveEscapedTemplatePlaceholders } from './markdown-transforms';
import './custom.css';

type ExplorerConfigData = {
    title: string;
    navigation: AuroraNavigationItem[];
};

const explorer = JSON.parse(
    readFileSync(new URL('./explorer.json', import.meta.url), 'utf8'),
) as ExplorerConfigData;

export default defineConfig({
    content: 'docs/**/*.md',
    navigation: explorer.navigation,
    search: true,
    llms: false,
    markdown: {
        transforms: [preserveEscapedTemplatePlaceholders],
    },
    components: [
        { name: 'Stats', client: false, component: () => import('./components/stats') },
        { name: 'Lead', client: false, component: () => import('./components/lead') },
        {
            name: 'PackageGrid',
            client: false,
            component: () => import('./components/package-grid'),
        },
        {
            name: 'PackageList',
            client: false,
            component: () => import('./components/package-list'),
        },
        {
            name: 'ActionLink',
            client: false,
            component: () => import('./components/action-link'),
        },
    ],
    layouts: [
        {
            name: 'docs',
            layout: async () => ({ default: Docs }),
            slots: {
                sidebar: {
                    client: false,
                    component: () => import('./components/sidebar'),
                    host: { class: 'de-sidebar-host' },
                },
                beforeContent: {
                    client: false,
                    component: () => import('./components/package-info'),
                    host: { class: 'de-package-info-host' },
                },
                outline: {
                    client: true,
                    component: () => import('./components/outline'),
                },
            },
        },
    ],
    site: {
        title: explorer.title,
        description: 'Documentation for the exact package versions installed in this project.',
        navigation: [{ text: 'All packages', link: '/packages' }],
        footer: false,
    },
});
