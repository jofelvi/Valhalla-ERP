# Contrato de configuración (CONGELADO)

Fuente única: `packages/types/src/config/` (tipos, valores neutros, normalizadores) y
`packages/types/src/rules/index.ts` (dinero). **Nadie modifica `packages/types` salvo el
coordinador.** Si un carril necesita otro campo, lo pide.

Este producto **no tiene nombre propio**. Una instalación nueva arranca neutra ("Punto de venta",
paleta azul genérica, sin RIF, sin logo) y el cliente la vuelve suya desde Ajustes.

## Documentos (`configs/<id>`)

Guardados como `{ _id: <id>, valor: <objeto>, updatedAt, updatedBy }`. Siempre se leen con
`ConfigsService` (API) o `GET /api/config/publico` (clientes). **Nunca** `findOne({_id:'tarifas'})`
suelto.

| id | Tipo | Qué controla |
| -- | ---- | ------------ |
| `negocio` | `NegocioConfig` | nombre comercial, razón social, RIF, domicilio, teléfono, correos, textos de ticket/legal, Pago Móvil, transferencia |
| `marca` | `MarcaConfig` | nombre visible de la app, logos, ícono, paleta clara/oscura (17 tokens), tema por defecto |
| `tarifas` | `TarifasConfig` | monedas, **modo del servicio** (`additional` / `included` / `none`), tasa, solo-con-mesonero, impuesto (activo, tasa, etiqueta, incluido en precio, aplica al servicio), propinas sugeridas |
| `nomina` | `NominaConfig` | **comisión del mesonero** (tasa y base: `sales` / `service`), cortesías, descuento a empleados, retenciones de ley |
| `operacion` | `OperacionConfig` | país, zona horaria, locale, prefijo telefónico, hora de inicio de jornada, día de inicio de semana |
| `vocabulario` | `VocabularioConfig` | "Mesonero", "Mesa", "Cocina", "Barra"… (solo etiquetas; los enums no cambian) |
| `modulos` | `ModulosConfig` | interruptores: socios, packs/tobos, fichas de barra, Telegram, divisas, BDV, bono por producto, mesa conectada, reservas |

## Endpoints

| Método y ruta | Acceso | Respuesta |
| ------------- | ------ | --------- |
| `GET /api/config/publico` | sin sesión | `ConfigPublica` (todo menos `nomina`) |
| `GET /api/configs/:id` | ADMIN, MANAGER | `ConfigEnvelope<T>` (`:id` ∈ `CONFIG_IDS`, otro = 404) |
| `PATCH /api/configs/:id` | ADMIN | body `{ valor: Partial<T> }` → `ConfigEnvelope<T>`; se mezcla sobre lo vigente y se normaliza; `updatedBy` = usuario |

## El dinero (una sola fórmula)

`computeOrderTotals(items, tieneMesonero, tarifas, nomina)` y `calcularComision(comisionBase, nomina)`.
Ningún cliente multiplica por una constante (`* 0.1` está prohibido).

- `serviceMode='additional'`: `serviceCharge = (subtotal − descuentos) × serviceRate`, se suma al total.
- `'included'`: no se suma; `servicioIncluido` informa cuánto contiene el precio.
- `'none'`: sin servicio.
- Impuesto: `tax.enabled` (apagado por defecto). Sumado o incluido según `includedInPrice`.
- `comisionBase` = **ventas atribuibles al mesonero** (consumo − descuentos − cortesías si la nómina
  excluye cortesías), o ese valor × `serviceRate` si `commissionBasis='service'`. La comisión es
  `calcularComision(comisionBase, nomina)`. *(Cambio respecto a la versión original: antes `comisionBase` ya era el 10 %
  y la nómina dividía entre 10; esa división desaparece.)*
- El resultado trae `tasaServicio`, `modoServicio`, `tasaIva`, `ivaIncluido`: **se guardan en cada
  orden**. Cambiar la tarifa no reescribe órdenes cerradas.
- **El servidor manda**: la API calcula y no confía en un monto de servicio enviado por el cliente.

## Reglas para todo el código nuevo

1. Cero literales de un negocio: nombre, RIF, teléfono, dominio, correo, banco, ciudad.
2. Los textos de marca salen de `nombreVisible(marca, negocio)`; los de roles/estaciones de `vocabulario`.
3. Colores solo con tokens del design system (que ahora salen de `marca.palette`), nunca crudos.
4. Fechas, jornada y semana: solo con `operacion` (hay que usar la utilidad única, no `-4` ni `America/Caracas` sueltos).
5. Un módulo apagado en `modulos` se oculta del menú, su ruta responde 404 y su cron no corre.
