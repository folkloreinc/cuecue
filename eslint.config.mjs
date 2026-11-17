import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['**/node_modules/', '**/dist/'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': ['error', { allow: ['warn', 'error'] }],
        },
    },
    {
        files: ['babel.config.js', 'packages/store-mysql/migrations/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    {
        files: ['packages/cli/src/**/*.js', 'examples/**/*.js'],
        rules: {
            'no-console': 'off',
        },
    },
    prettier,
];
