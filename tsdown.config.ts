import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        cli: 'src/cli.ts',
        'components/action-link': 'src/components/action-link.ts',
        'components/lead': 'src/components/lead.ts',
        'components/outline': 'src/components/outline.ts',
        'components/package-grid': 'src/components/package-grid.ts',
        'components/package-info': 'src/components/package-info.ts',
        'components/package-list': 'src/components/package-list.ts',
        'components/sidebar': 'src/components/sidebar.ts',
        'components/stats': 'src/components/stats.ts',
    },
    platform: 'node',
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    minify: false,
});
