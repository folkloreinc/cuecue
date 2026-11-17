import config, { external, onwarn, plugins } from '../../rollup.config.mjs';

export default [
    config,
    {
        input: 'src/cli.js',
        output: {
            file: 'dist/cli.js',
            format: 'cjs',
            banner: '#!/usr/bin/env node',
        },
        external,
        onwarn,
        plugins,
    },
];
