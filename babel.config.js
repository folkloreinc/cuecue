module.exports = {
    babelrcRoots: ['.', 'packages/*'],
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
