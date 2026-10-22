// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Excluir 'module' de resolverMainFields para evitar que Metro use el build
// de ES modules (dist/es/) de paquetes como react-i18next, que usan imports
// con extensión .js que Metro no puede resolver correctamente.
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// El contrato compartido (configuración y dinero) vive en packages/types/src y se importa
// por ruta relativa desde src/shared/contrato.ts. Metro solo bundlea lo que vigila: sin
// esta línea, un import fuera de mobile/ no se resuelve.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../packages/types/src'),
];

// Forzar CJS para zustand/middleware: la versión ESM (esm/middleware.mjs) contiene
// import.meta.env.MODE que causa SyntaxError en scripts no-módulo, dejando la PWA web
// con pantalla blanca. El CJS (middleware.js) es idéntico en funcionalidad.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware') {
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, 'node_modules/zustand/middleware.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
