/**
 * A DONDE va cada cosa cuando el bot vive en un grupo.
 *
 * El grupo es el buzon y el privado la mesa de trabajo: la factura se puede
 * soltar en el grupo —asi los socios ven entrar cada gasto— pero las preguntas
 * se hacen en el chat privado de quien la mando. La sesion de la conversacion
 * va por chat, y en privado el chat ES la persona: dos socios cargando a la vez
 * no se pisan.
 */

export interface ChatRef {
  id: number;
  type: string;
}

export interface DestinoFoto {
  /** Chat donde se hacen las preguntas (el privado del socio). */
  destino: number;
  /** Chat donde avisar que la foto entro (el grupo), o null si ya es privado. */
  avisarEn: number | null;
}

/**
 * Donde se atiende una foto. En privado, todo ocurre en el mismo chat; en un
 * grupo, la conversacion se muda al privado de quien la mando.
 *
 * Sin remitente no hay a donde mudarse (mensajes de canal o reenvios
 * anonimos): se descarta en vez de adivinar.
 */
export function destinoDeFoto(chat: ChatRef, fromId?: number): DestinoFoto | null {
  if (chat.type === 'private') return { destino: chat.id, avisarEn: null };
  if (!fromId) return null;
  return { destino: fromId, avisarEn: chat.id };
}

export interface UpdateResumen {
  tieneFoto: boolean;
  texto?: string;
  esCallback: boolean;
}

/**
 * Si el bot tiene algo que hacer con este mensaje.
 *
 * Con el modo privacidad APAGADO —necesario para ver las fotos del grupo—
 * Telegram le entrega TODA la conversacion de los socios. Sin este filtro,
 * cada "ok" entre ellos dejaria un WARN de "no autorizado" en el log y
 * enterraria los avisos que si importan.
 */
export function esAccionable(u: UpdateResumen): boolean {
  if (u.tieneFoto || u.esCallback) return true;
  return (u.texto ?? '').trimStart().startsWith('/');
}

/**
 * Si un estado de `getChatMember` es de alguien que esta HOY en el grupo.
 * "restricted" puede ser un miembro silenciado (sigue adentro) o alguien que
 * ya salio: lo decide `is_member`.
 */
export function esMiembroDelGrupo(m: { status: string; is_member?: boolean }): boolean {
  if (m.status === 'creator' || m.status === 'administrator' || m.status === 'member') return true;
  return m.status === 'restricted' && m.is_member === true;
}

/**
 * Con que nombre queda un socio nuevo. Es el nombre que sale en los informes
 * y en "pagó X", asi que no puede repetirse: si ya hay una Mariale, la nueva
 * lleva la inicial del apellido.
 */
export function nombreDeSocio(first: string, last: string | undefined, existentes: string[]): string {
  const base = first.trim() || 'Socio';
  const usados = new Set(existentes.map((n) => n.toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  const conInicial = last?.trim() ? `${base} ${last.trim()[0].toUpperCase()}.` : base;
  if (!usados.has(conInicial.toLowerCase())) return conInicial;
  let n = 2;
  while (usados.has(`${conInicial} ${n}`.toLowerCase())) n++;
  return `${conInicial} ${n}`;
}

export interface ImagenRecibida {
  fileId: string;
  extension: 'jpg' | 'png' | 'webp';
}

interface MensajeConImagen {
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; mime_type?: string; file_name?: string };
}

/**
 * La imagen de la factura, venga como foto o como ARCHIVO.
 *
 * Telegram comprime las fotos; mandarla como archivo ("jpg" desde el clip)
 * llega entera, y es justo lo que conviene para una factura larga. El bot solo
 * escuchaba fotos: el archivo se ignoraba sin decir nada (18/09/2026).
 */
export function imagenDelMensaje(m: MensajeConImagen | undefined): ImagenRecibida | null {
  if (!m) return null;
  const fotos = m.photo ?? [];
  if (fotos.length) return { fileId: fotos[fotos.length - 1].file_id, extension: 'jpg' };
  const doc = m.document;
  if (!doc) return null;
  const tipo = (doc.mime_type ?? '').toLowerCase();
  const nombre = (doc.file_name ?? '').toLowerCase();
  if (tipo === 'image/png' || nombre.endsWith('.png')) return { fileId: doc.file_id, extension: 'png' };
  if (tipo === 'image/webp' || nombre.endsWith('.webp')) return { fileId: doc.file_id, extension: 'webp' };
  if (tipo === 'image/jpeg' || tipo === 'image/jpg' || /\.jpe?g$/.test(nombre)) return { fileId: doc.file_id, extension: 'jpg' };
  return null;
}
