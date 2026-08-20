import { $each, html } from '@grainular/nord';
import { decode, type EncodedDataProps } from './data';

type PackageCard = { href: string; name: string; version: string; description: string };

export const PackageGrid = ({ data }: EncodedDataProps) => html`
    <div class="de-package-grid">
        ${$each(() => decode<PackageCard[]>(data)).$as(
            (item) =>
                html`<a href="${item.href}"
                    ><strong>${item.name}</strong><code>${item.version}</code
                    ><span>${item.description}</span></a
                >`,
        )}
    </div>
`;

export default PackageGrid;
