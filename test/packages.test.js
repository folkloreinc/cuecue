import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

// Smoke test of the builds: every package's `main` exists after `npm run build`, and loads with
// require() as the apps load it, with the exports they use.

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

const expectedExports = {
    '@cuecue/app': ['default', 'MemoryStore', 'utils'],
    '@cuecue/cli': [],
    '@cuecue/core': [
        'BasePlugin',
        'BaseInput',
        'BaseOutput',
        'parseStoreInputId',
        'parseStoreOutputId',
    ],
    '@cuecue/http': ['createApi', 'Input', 'ApiInput', 'Output', 'Server'],
    '@cuecue/osc': ['Input', 'Output'],
    '@cuecue/pingpong': ['Output'],
    '@cuecue/pubnub': ['Input', 'Output'],
    '@cuecue/socketio': ['Input', 'Output', 'ServerInput', 'ServerOutput'],
    '@cuecue/store-mysql': [],
};

// What each package publishes: its build, and the MySQL store's migrations, which apps run from
// node_modules.
const expectedFiles = {
    '@cuecue/store-mysql': ['dist', 'migrations'],
};

const packages = readdirSync(path.join(root, 'packages')).map((directory) => {
    const packagePath = path.join(root, 'packages', directory);
    const manifest = JSON.parse(readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
    return { packagePath, manifest };
});

describe('packages', () => {
    it('are all listed here', () => {
        expect(packages.map(({ manifest }) => manifest.name).sort()).toEqual(
            Object.keys(expectedExports).sort(),
        );
    });

    describe.each(packages)('$manifest.name', ({ packagePath, manifest }) => {
        const main = path.join(packagePath, manifest.main);

        it('is built', () => {
            expect(existsSync(main), `${main} is missing: run npm run build`).toBe(true);
        });

        it('loads with require()', () => {
            const exported = require(main);
            expect(exported).toBeDefined();
            (expectedExports[manifest.name] ?? []).forEach((name) => {
                expect(exported[name], `${manifest.name} exports ${name}`).toBeDefined();
            });
        });

        it('publishes only what it builds', () => {
            expect(manifest.files).toEqual(expectedFiles[manifest.name] ?? ['dist']);
            expect(manifest.publishConfig).toEqual({ access: 'public' });
        });

        it('requires Node 22 or later', () => {
            expect(manifest.engines).toEqual({ node: '>=22' });
        });
    });

    it('@cuecue/store-mysql exports its store', () => {
        expect(require(path.join(root, 'packages/store-mysql'))).toBeTypeOf('function');
    });

    it('@cuecue/store-mysql publishes its migrations', () => {
        const packed = JSON.parse(
            execFileSync(
                'npm',
                ['pack', '--dry-run', '--json', '--ignore-scripts', '-w', '@cuecue/store-mysql'],
                { cwd: root, encoding: 'utf8' },
            ),
        );
        // npm 10 and 11 give an array, npm 12 an object by package name.
        const [{ files }] = Array.isArray(packed) ? packed : Object.values(packed);
        const published = files.map(({ path: file }) => file);
        const migrations = readdirSync(path.join(root, 'packages/store-mysql/migrations'));
        expect(migrations).toContain('config.json');
        expect(migrations).toContain('20261117120000-extra.js');
        migrations.forEach((file) => {
            expect(published).toContain(`migrations/${file}`);
        });
        expect(published).toContain('README.md');
    });

    it('the cuecue command prints its version', () => {
        const cli = path.join(root, 'packages/cli/dist/cli.js');
        const { version } = JSON.parse(
            readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8'),
        );
        expect(
            execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).trim(),
        ).toBe(version);
    });
});
