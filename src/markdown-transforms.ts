export const preserveEscapedTemplatePlaceholders = (markdown: string) =>
    markdown
        .replace(/\\+`/g, (escapedBacktick) => {
            const backslashes = escapedBacktick.length - 1;
            return backslashes % 2 === 0 ? escapedBacktick : `\\${escapedBacktick}`;
        })
        .replace(/\\+\$\{/g, (placeholder) => {
            const backslashes = placeholder.length - 2;
            return backslashes % 2 === 0 ? placeholder : `\\${placeholder}`;
        });
