import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { es } from './locales/es';

/**
 * Recursos de traducción.
 * Para agregar un idioma nuevo:  { en: { shared: enShared, auth: enAuth, ... } }
 */
export const resources = { es } as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng: 'es',
  ns: ['shared', 'auth'],
  defaultNS: 'shared',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
  // Fuerza inicialización síncrona. Sin esto, i18next termina de inicializarse
  // después del primer render y dispara un re-render que cierra el teclado en Android.
  initImmediate: false,
});

export default i18n;
