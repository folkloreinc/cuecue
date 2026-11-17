const path = require('path');
const lernaJSON = require('./lerna.json');

module.exports = {
    babelrcRoots: ['.', ...lernaJSON.packages.map((packagePath) => path.join('./', packagePath))],
    presets: [
        [
            require.resolve('@babel/preset-env'),
            {
                targets: {
                    node: 22,
                },
            },
        ],
    ],
};
