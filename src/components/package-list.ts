import { $each, html } from '@grainular/nord';
import { decode, type EncodedDataProps } from './data';

type PackageListItem = {
    href: string;
    name: string;
    version: string;
    description: string;
    direct: boolean;
};

export const PackageList = ({ data }: EncodedDataProps) => html`
    <div class="de-package-list">
        ${$each(() => decode<PackageListItem[]>(data)).$as(
            (item) =>
                html`<a href="${item.href}">
                    <span><strong>${item.name}</strong><small>${item.description}</small></span>
                    <span class="de-package-list-meta"
                        ><code>${item.version}</code>${item.direct
                            ? html`<span class="de-badge de-badge-direct">direct</span>`
                            : null}</span
                    >
                </a>`,
        )}
    </div>
`;

export default PackageList;
