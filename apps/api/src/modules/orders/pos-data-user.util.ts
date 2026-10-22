/**
 * Lo unico de un usuario que viaja en `GET /api/orders/pos-data`.
 *
 * Ese endpoint lo pide el POS al abrir y al volver a la pestaña, y el
 * telefono del mesonero. Devolvia `userModel.find({})` entero: `passwordHash`,
 * y `pin` (el PIN de admin EN TEXTO PLANO de quien aun no migro a `pinHash`),
 * que es el que autoriza descuentos, cortesias, creditos y anulaciones.
 * Encontrado el 27/09/2026. Los consumidores (POS, verificar pagos, mesonero)
 * solo leen id, nombre, rol y si esta activo.
 *
 * Dos capas a proposito: la proyeccion en la consulta (no sale de Mongo) y
 * esta lista blanca al armar la respuesta (si alguien quita la proyeccion,
 * igual no sale).
 */
export const CAMPOS_DE_USUARIO_EN_POS = '_id name role isActive';

export interface UsuarioEnPos {
  id: string;
  _id: string;
  name?: string;
  role?: string;
  isActive?: boolean;
}

export const usuarioParaPos = (user: {
  _id: unknown;
  name?: unknown;
  role?: unknown;
  isActive?: unknown;
}): UsuarioEnPos => {
  const id = String(user._id);
  return {
    id,
    _id: id,
    name: typeof user.name === 'string' ? user.name : undefined,
    role: typeof user.role === 'string' ? user.role : undefined,
    isActive: typeof user.isActive === 'boolean' ? user.isActive : undefined,
  };
};
