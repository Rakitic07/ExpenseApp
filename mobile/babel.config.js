module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 ships its worklets plugin separately; it MUST be listed last.
  // victory-native (Skia charts) and any reanimated animations depend on it.
  plugins: ['react-native-worklets/plugin'],
};
