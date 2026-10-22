/**
 * Claves compartidas en toda la app.
 * Úsalas con el prefijo de namespace: t('shared:actions.save')
 */
const shared = {
  actions: {
    login: 'Iniciar Sesión',
    register: 'Crear cuenta',
    save: 'Guardar',
    cancel: 'Cancelar',
    back: 'Volver',
    send: 'Enviar',
    understood: 'Entendido',
    send_link: 'Enviar enlace',
    confirm: 'Confirmar',
    retry: 'Reintentar',
  },

  fields: {
    email: 'Email',
    password: 'Contraseña',
    confirm_password: 'Confirmar contraseña',
    full_name: 'Nombre completo',
    phone: 'Teléfono (opcional)',
    member_number: 'Número de socio',
  },

  validation: {
    required: 'Este campo es requerido',
    email_invalid: 'Email inválido',
    min_length: 'Mínimo {{count}} caracteres',
    passwords_mismatch: 'Las contraseñas no coinciden',
    member_number_required: 'Ingresa tu número de socio',
  },

  errors: {
    generic: 'Ocurrió un error. Intenta de nuevo',
    no_connection: 'Sin conexión a internet',
    invalid_credentials: 'Email o contraseña incorrectos',
    email_in_use: 'Este email ya está registrado',
    sign_in_failed: 'No se pudo iniciar sesión. Intenta de nuevo',
    sign_up_failed: 'No se pudo crear la cuenta. Intenta de nuevo',
  },
} as const;

export default shared;
