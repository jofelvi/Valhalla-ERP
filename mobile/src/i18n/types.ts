/**
 * Tipos de i18next para autocompletado de namespaces.
 *
 * NOTE: La augmentación estricta de CustomTypeOptions se omite
 * intencionalmente porque genera conflictos al pasar TFunction
 * a funciones de schema (Yup) y helpers fuera de componentes React.
 * Los namespaces y claves están documentados en src/i18n/locales/es/.
 */

export type I18nNamespace = 'shared' | 'auth';
