/**
 * Funciones que esta instalación ofrece en pantalla. Apagar una oculta su botón; el código y los
 * datos que ya existan no se tocan.
 */

/** Dar crédito: "Solicitar crédito" (mesonero) y "Dejar Pendiente (Crédito)" (caja). */
export const CREDITO_HABILITADO = true;

/** Propina: bloque "Propina (Bs)" de la pantalla de cobro del mesonero. Apagada, la orden lleva propina 0. */
export const PROPINA_HABILITADA = false;

/**
 * La comanda (y la ficha de barra) sale al COBRAR, no al enviar el pedido. Encendida, crear un
 * pedido lleva directo al cobro, y cocina, barra y pizza solo ven pedidos ya cobrados.
 */
export const COMANDA_AL_PAGAR = false;
