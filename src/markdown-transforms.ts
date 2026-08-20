export const preserveEscapedTemplatePlaceholders = (markdown: string) =>
    markdown.replace(/\\+\$\{/g, (placeholder) => {
        const backslashes = placeholder.length - 2;
        return backslashes % 2 === 0 ? placeholder : `\\${placeholder}`;
    });
