const path = require('path');
const lernaJSON = require('./lerna.json');

module.exports = {
    babelrcRoots: ['.', ...lernaJSON.packages.map((packagePath) => path.join('./', packagePath))],
    presets: [
        [
            require.resolve('@babel/preset-env'),
            {
                targets: {
                    node: 12,
                },
                useBuiltIns: false,
            },
        ],
    ],

    plugins: [[require.resolve('@babel/plugin-transform-runtime'), {}]],
};
