import * as yup from 'yup';
import {
  PALETA_CLAVES,
  type MarcaConfig,
  type PaletaTokens,
} from '@odin6/types';

export interface MarcaFormulario {
  appName: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  iconUrl: string;
  defaultTheme: MarcaConfig['defaultTheme'];
  claro: PaletaTokens;
  oscuro: PaletaTokens;
}

export function aFormulario(m: MarcaConfig): MarcaFormulario {
  return {
    appName: m.appName,
    logoLightUrl: m.logoLightUrl,
    logoDarkUrl: m.logoDarkUrl,
    iconUrl: m.iconUrl,
    defaultTheme: m.defaultTheme,
    claro: { ...m.palette.light },
    oscuro: { ...m.palette.dark },
  };
}

export function aValor(f: MarcaFormulario): MarcaConfig {
  return {
    appName: f.appName.trim(),
    logoLightUrl: f.logoLightUrl.trim(),
    logoDarkUrl: f.logoDarkUrl.trim(),
    iconUrl: f.iconUrl.trim(),
    defaultTheme: f.defaultTheme,
    palette: {
      light: { ...f.claro },
      dark: { ...f.oscuro },
    },
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const url = yup
  .string()
  .defined()
  .trim()
  .max(1000, 'La dirección no puede pasar de 1000 caracteres.')
  .test(
    'url',
    'Use una dirección que empiece con https:// o con /.',
    (v) => !v || /^(https?:\/\/|\/(?!\/))/i.test(v),
  );

const color = yup
  .string()
  .defined()
  .trim()
  .matches(HEX, 'Use el formato #RRGGBB, ej. #1D4ED8.');

const esquemaPaleta = Object.fromEntries(
  PALETA_CLAVES.map((clave) => [clave, color]),
);

export const marcaEsquema = yup.object({
  appName: yup
    .string()
    .defined()
    .trim()
    .max(60, 'El nombre de la aplicación no puede pasar de 60 caracteres.'),
  logoLightUrl: url,
  logoDarkUrl: url,
  iconUrl: url,
  defaultTheme: yup
    .mixed<MarcaConfig['defaultTheme']>()
    .oneOf(['light', 'dark', 'system'], 'Elija un tema de la lista.')
    .defined(),
  claro: yup.object(esquemaPaleta).defined(),
  oscuro: yup.object(esquemaPaleta).defined(),
});
