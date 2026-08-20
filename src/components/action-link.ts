import { html } from '@grainular/nord';
import { decode, type EncodedDataProps } from './data';
import { Icon, type IconName } from './icon';

type ActionLinkData = { href: string; label: string; icon: IconName };

export const ActionLink = ({ data }: EncodedDataProps) => {
    const value = decode<ActionLinkData>(data);
    return html`<a class="de-action-link" href="${value.href}">
        ${value.icon === 'arrow-left'
            ? Icon({ name: value.icon })
            : null}<span>${value.label}</span>${value.icon !== 'arrow-left'
            ? Icon({ name: value.icon })
            : null}
    </a>`;
};

export default ActionLink;
