import * as yup from 'yup';

/**
 * Tipo permisivo para la función de traducción.
 * Acepta tanto useTranslation('shared') como useTranslation(['auth','shared']).
 */
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Crea el schema de validación para el login.
 * Uso: const schema = useMemo(() => createLoginSchema(t), [t])
 */
export const createLoginSchema = (t: TranslateFn) =>
  yup.object({
    email: yup
      .string()
      .required(t('validation.required', { ns: 'shared' }))
      .email(t('validation.email_invalid', { ns: 'shared' })),
    password: yup.string().required(t('validation.required', { ns: 'shared' })),
  });

export type LoginFormValues = yup.InferType<
  ReturnType<typeof createLoginSchema>
>;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea el schema de validación para el registro.
 * Incluye validación condicional del número de socio.
 */
export const createRegisterSchema = (t: TranslateFn) =>
  yup.object({
    name: yup.string().required(t('validation.required', { ns: 'shared' })),
    email: yup
      .string()
      .required(t('validation.required', { ns: 'shared' }))
      .email(t('validation.email_invalid', { ns: 'shared' })),
    phone: yup.string().optional(),
    isMember: yup.boolean().required(),
    memberNumber: yup
      .string()
      .optional()
      .when('isMember', {
        is: true,
        then: (schema) =>
          schema.required(
            t('validation.member_number_required', { ns: 'shared' }),
          ),
        otherwise: (schema) => schema,
      }),
    password: yup
      .string()
      .required(t('validation.required', { ns: 'shared' }))
      .min(6, t('validation.min_length', { ns: 'shared', count: 6 })),
    confirmPassword: yup
      .string()
      .required(t('validation.required', { ns: 'shared' }))
      .oneOf(
        [yup.ref('password')],
        t('validation.passwords_mismatch', { ns: 'shared' }),
      ),
  });

// InferType de yup convierte .optional() en `T | undefined` (requerido pero indefinible).
// Definimos el tipo manualmente con `?` para compatibilidad con useForm<RegisterFormValues>.
export type RegisterFormValues = {
  name: string;
  email: string;
  phone?: string;
  isMember: boolean;
  memberNumber?: string;
  password: string;
  confirmPassword: string;
};
