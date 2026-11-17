import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const packages = fileURLToPath(new URL('./packages/', import.meta.url));

export default defineConfig({
    resolve: {
        // Tests import the packages' sources, so nothing needs to be built first. The smoke test
        // checks the builds themselves.
        alias: [{ find: /^@cuecue\/([^/]+)$/, replacement: `${packages}$1/src/index.js` }],
    },
    test: {
        include: ['packages/*/src/**/*.test.js', 'test/**/*.test.js'],
        // Some tests start servers: keep their output out of the way.
        silent: 'passed-only',
    },
});
