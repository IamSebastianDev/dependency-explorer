import { html } from '@grainular/nord';
import { decode, type EncodedDataProps } from './data';

export const Lead = ({ data }: EncodedDataProps) =>
    html`<p class="de-lead">${decode<string>(data)}</p>`;

export default Lead;
