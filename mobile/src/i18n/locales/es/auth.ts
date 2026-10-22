/**
 * Traducciones para las pantallas de autenticación.
 * Úsalas con: const { t } = useTranslation('auth')
 */
const auth = {
  login: {
    // {{nombre}}: el nombre visible de la app, de la configuración del negocio (useNombreApp).
    brand: '{{nombre}}',
    tagline: 'Deliciosa comida, a un toque de distancia',
    title_first: '¡Bienvenido!',
    title_returning: 'Bienvenido de vuelta',
    subtitle_first: 'Inicia sesión o crea una cuenta para comenzar',
    subtitle_returning: 'Inicia sesión para continuar',
    loading: 'Iniciando sesión...',

    forgot_password: '¿Olvidaste tu contraseña?',
    no_account: '¿No tienes cuenta?',
    register_link: 'Regístrate',

    forgot_modal: {
      title: 'Recuperar contraseña',
      description:
        'Ingresa tu email y te enviaremos un enlace para restablecerla',
      success_title: 'Email enviado',
      success_description:
        'Revisa tu bandeja de entrada para restablecer tu contraseña',
    },
  },

  register: {
    title: 'Crear cuenta',
    subtitle: 'Únete a {{nombre}} y disfruta de la mejor comida',
    loading: 'Creando cuenta...',

    member: {
      question: '¿Eres socio?',
      not_member: 'No soy socio',
      is_member: 'Soy socio',
    },

    password_strength: {
      weak: 'Débil',
      fair: 'Regular',
      strong: 'Fuerte',
    },

    terms: {
      prefix: 'Al registrarte aceptas nuestros',
      terms_link: 'Términos de Servicio',
      conjunction: 'y',
      privacy_link: 'Política de Privacidad',
    },

    already_have_account: '¿Ya tienes cuenta?',
    login_link: 'Inicia sesión',
  },
} as const;

export default auth;
