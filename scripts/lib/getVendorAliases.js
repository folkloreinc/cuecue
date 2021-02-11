const getVendorAliases = () => ({
    react: require.resolve('react'),
    'react-dom/server': require.resolve('react-dom/server'),
    'react-dom': require.resolve('react-dom'),
});

module.exports = getVendorAliases;