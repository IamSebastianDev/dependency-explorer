import { $each, html } from '@grainular/nord';
import { decode, type EncodedDataProps } from './data';

type Stat = { value: number; label: string };

export const Stats = ({ data }: EncodedDataProps) => html`
    <div class="de-stats">
        ${$each(() => decode<Stat[]>(data)).$as(
            (item) => html`<div><strong>${item.value}</strong><span>${item.label}</span></div>`,
        )}
    </div>
`;

export default Stats;
