import path from 'path';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

const extensions = ['.mjs', '.js', '.json', '.node'];

// Dependencies stay external: only the package's own files are bundled.
export const external = (id, importer) =>
    importer !== undefined && !id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('\0');

// @cuecue/app exports its Application as `default` next to named exports, as it always has.
export const onwarn = (warning, warn) => {
    if (warning.code !== 'MIXED_EXPORTS') {
        warn(warning);
    }
};

export const plugins = [
    json(),
    resolve({
        extensions,
        preferBuiltins: true,
    }),
    commonjs(),
    babel({
        extensions,
        exclude: 'node_modules/**',
        rootMode: 'upward',
        babelHelpers: 'bundled',
    }),
];

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'cjs',
        exports: 'auto',
    },
    external,
    onwarn,
    plugins,
};
