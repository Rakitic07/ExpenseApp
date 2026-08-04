const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const emptyModule = path.resolve(__dirname, 'empty-module.js');

const config = {
  resolver: {
    // `xlsx` statically requires Node core modules (fs / stream / crypto) that
    // do not exist in React Native. Point them at an empty stub so Metro can
    // bundle. Those code paths are never executed on-device — we only use
    // `XLSX.write({ type: 'base64' })`, which is pure JS.
    extraNodeModules: {
      fs: emptyModule,
      stream: emptyModule,
      crypto: emptyModule,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
