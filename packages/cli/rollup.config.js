import { createConfig } from '../../rollup.config';

export default [
    createConfig({
        file: 'index.js',
        format: 'cjs',
    }),
    createConfig({
        input: 'src/bin/cuecue.js',
        output: 'bin/cuecue.js',
        banner: '#!/usr/bin/env node',
        format: 'node',
    })
];
