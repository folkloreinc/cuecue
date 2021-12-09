import path from 'path';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
// import svgo from 'rollup-plugin-svgo';
import json from '@rollup/plugin-json';

export const plugins = [
    json(),
    resolve({
        extensions: ['.mjs', '.js', '.jsx', '.json', '.node'],
        jail: path.join(process.cwd(), 'src'),
        preferBuiltins: true,
    }),
    commonjs(),
    babel({
        extensions: ['.mjs', '.js', '.jsx', '.json', '.node'],
        exclude: 'node_modules/**',
        rootMode: 'upward',
        babelHelpers: 'runtime',
    }),
];

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
    },
    plugins,
};
