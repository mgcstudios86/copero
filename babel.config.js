module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // SDK 57 / reanimated 4.x: el plugin vive en react-native-worklets.
    // react-native-reanimated/plugin sigue funcionando como re-export, pero
    // apuntar directo al paquete worklets evita la indirección.
    plugins: ['react-native-worklets/plugin'],
  };
};
