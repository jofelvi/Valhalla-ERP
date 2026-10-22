import { registerRootComponent } from 'expo';

import './src/i18n'; // inicializar i18next antes de cualquier componente
import { installGlobalErrorHandler } from './src/utils/globalErrorHandler';

// Instalar handlers globales lo antes posible — antes que cualquier otro
// codigo ejecute, para capturar errores que ocurran durante la inicializacion.
installGlobalErrorHandler();

import ArranqueConfig from './src/config/ArranqueConfig';

// La raíz espera la configuración del negocio y luego carga App (ver ArranqueConfig).
registerRootComponent(ArranqueConfig);
