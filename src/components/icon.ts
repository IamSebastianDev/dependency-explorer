import { html, type ComponentFragment } from '@grainular/nord';

export type IconName =
    | 'arrow-left'
    | 'arrow-right'
    | 'chevron-down'
    | 'external-link'
    | 'git-branch'
    | 'history'
    | 'package';

const icons: Record<IconName, () => ComponentFragment> = {
    'arrow-left': () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M19 12H5m6 6-6-6 6-6"></path>
        </svg>`,
    'arrow-right': () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M5 12h14m-6-6 6 6-6 6"></path>
        </svg>`,
    'chevron-down': () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="m7 10 5 5 5-5"></path>
        </svg>`,
    'external-link': () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M14 5h5v5M10 14l9-9M19 13v6H5V5h6"></path>
        </svg>`,
    'git-branch': () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <circle cx="6" cy="5" r="2"></circle>
            <circle cx="18" cy="6" r="2"></circle>
            <circle cx="6" cy="19" r="2"></circle>
            <path d="M6 7v10M8 7c3 0 3 5 6 5h2M18 8v5"></path>
        </svg>`,
    history: () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
            <path d="M3 3v5h5M12 7v5l3 2"></path>
        </svg>`,
    package: () =>
        html`<svg
            class="de-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path>
            <path d="m4.3 7.6 7.7 4.3 7.7-4.3M12 12v9"></path>
        </svg>`,
};

export const Icon = ({ name }: { name: IconName }) => icons[name]();
