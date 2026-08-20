import { describe, expect, test } from 'bun:test';
import { nordMarkdown } from 'vite-plugin-nord-md';
import { preserveEscapedTemplatePlaceholders } from '../src/markdown-transforms';

describe('Markdown transforms', () => {
    test('preserves escaped template placeholders through Nørd Markdown compilation', () => {
        expect(preserveEscapedTemplatePlaceholders('\\${license:ISC}')).toBe('\\\\${license:ISC}');
        expect(preserveEscapedTemplatePlaceholders('\\\\${alreadyEven}')).toBe(
            '\\\\${alreadyEven}',
        );
        expect(preserveEscapedTemplatePlaceholders('${alreadyHandled}')).toBe('${alreadyHandled}');
    });

    test('preserves escaped backticks in code fences', async () => {
        const oddEscape = `${'\\'.repeat(3)}\``;
        const markdown = ['```js', `// → \`${oddEscape}Lorem${oddEscape}\``, '```'].join('\n');
        const plugin = nordMarkdown({
            components: [],
            transforms: [preserveEscapedTemplatePlaceholders],
        });
        const transform = plugin.transform;
        if (typeof transform !== 'function') throw new TypeError('Expected a transform function.');

        const result = await transform.call({} as never, markdown, 'edge-case.md');
        const code = typeof result === 'string' ? result : result?.code;
        expect(code).toBeString();

        const parsable = code!
            .replace(/^import .*;$/m, 'const html = String.raw;')
            .replaceAll('export const', 'const');
        expect(() => new Function(parsable)).not.toThrow();
    });
});
