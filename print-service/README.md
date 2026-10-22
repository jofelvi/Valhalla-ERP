# Print service

Servicio local de impresión térmica ESC/POS (58 mm). Corre en la PC que tiene las impresoras:
escucha la cola de impresión del backend (WebSocket + polling), arma los tickets y los envía a
la impresora. Funciona en Windows y en Linux (la detección de sistema es en tiempo de ejecución).

No trae datos de ningún negocio: el ticket imprime lo que trae el pedido. Nombre del negocio,
dirección, RIF, pie, Pago Móvil y etiquetas de servicio o impuesto llegan en cada pedido.

## Requisitos

- Node.js 20 o superior y pnpm (`pnpm install --ignore-workspace`, este paquete no es parte del workspace).
- Una impresora térmica de 58 mm instalada en el sistema operativo.
- Un `.env` a partir de `.env.example`, con al menos `API_URL`.

## Uso

```bash
pnpm install --ignore-workspace
pnpm build                  # compila a dist/
pnpm start                  # arranca (pregunta el modo de estación)
pnpm test                   # pruebas de los tickets
```

Verificación: `http://127.0.0.1:6441/status` y `http://127.0.0.1:6441/printers`.

## Configuración

Todo sale del `.env`. Ver `.env.example`. Lo obligatorio es `API_URL`; si falta, el servicio
no arranca y dice qué falta.

Modos de estación (`STATION_MODE` o argumento `--both`, `--kitchen`, `--bar`, `--bar-1`, `--bar-2`,
`--kitchen+1`):

| Modo              | Qué imprime                                         |
| ----------------- | --------------------------------------------------- |
| `both`            | Factura, cocina, pizza y barra                      |
| `kitchen`         | Comandas de cocina y resumen de caja                |
| `bar`             | Comandas de barra                                   |
| `bar-1` / `bar-2` | Reparto de la barra por zona (ver `BARRA_1_PATRON`) |
| `kitchen+1`       | Cocina y barra 1                                    |

## Endpoints locales (`127.0.0.1`)

| Ruta               | Método   | Descripción                                                    |
| ------------------ | -------- | -------------------------------------------------------------- |
| `/status`          | GET      | Estado, modo y estado de impresoras                            |
| `/printers`        | GET      | Impresoras del sistema y cuáles de las configuradas existen    |
| `/print`           | POST     | Factura                                                        |
| `/print-precuenta` | POST     | Precuenta (no es factura)                                      |
| `/print-comanda`   | POST     | Comandas, un papel por `station`                               |
| `/preview-comanda` | GET/POST | Vista previa SIN imprimir: papeles, impresoras y avisos        |
| `/print-ronda`     | POST     | Ticket de ronda (productos por tandas)                         |
| `/print-ficha`     | POST     | Ficha con QR de entrega                                        |
| `/test/:objetivo`  | GET      | Ticket de prueba (`receipt`, `kitchen`, `bar`, `ficha`, `all`) |

## Tickets: etiquetas dinámicas

- Servicio: `serviceCharge` con `serviceLabel`. Sin `serviceLabel` no se imprime la línea.
  Con `serviceLabel` y monto en 0 (p. ej. "Servicio incluido") se imprime solo la etiqueta.
- Impuesto: `tax` con `taxLabel`. Sin etiqueta no hay línea. `taxMode: 'included'` lo imprime como
  desglose después del TOTAL; por defecto (`added`) va antes.
- Pago Móvil: solo si el pedido trae `pagoMovil` (banco, teléfono, documento).
- Encabezado, marca y pie: solo si el pedido los trae (`businessName`, `address`, `phone`, `rif`,
  `footerMessage`, `footerBrand`). Un campo vacío no deja línea.

## Qué sale por cada pedido (y cómo verlo sin gastar papel)

Por cada comanda sale **un papel por estación** que tenga productos (cocina, pizza, barra), cada uno
con su título, el número de orden, dónde/mesonero/hora, los productos (a doble alto), los ingredientes
quitados y las notas. Sin bandas, sin pie y sin la hora de cada producto. Con `RESUMEN_CAJA=1` sale
además un resumen en la impresora de caja (apagado por defecto).

Con el servicio corriendo, abre **http://127.0.0.1:6441/preview-comanda**: muestra un pedido de ejemplo
tal como saldría, qué impresora recibe cada papel y los **avisos** (p. ej. "COCINA + PIZZA salen por la
MISMA impresora"). Para un pedido propio, `POST /preview-comanda` con el mismo cuerpo que
`/print-comanda`.

Si salen papeles de más, casi siempre es una de estas causas:

- Varias estaciones comparten impresora: `KITCHEN_PRINTER`, `PIZZA_PRINTER` y `BAR_PRINTER` caen por
  defecto en la de caja. Defínelas en el `.env` si hay más de una impresora.
- `STATION_MODE=both` en un equipo que solo debería sacar una estación (usa `kitchen`, `bar`, …).
- `RESUMEN_CAJA=1` encendido sin necesitarlo.

## Instalar como servicio

- **Windows**: `scripts/install-service-windows.bat` (como Administrador). Instala el servicio con NSSM
  con el nombre `PrintService`.
- **Linux**: `scripts/install-service-linux.sh` (systemd, unidad `print-service`).
- **PC de caja (Windows)**: scripts de supervisión, reinicio y blindaje contra cortes de luz en
  `caja/`. Ver `caja/README.md`.

## Pruebas

```bash
pnpm test
```

`test/ticket.test.ts` comprueba que un pedido mínimo no deja texto ajeno en el ticket, que las
etiquetas de servicio e impuesto aparecen solo cuando el pedido las trae, y que el Pago Móvil sale
solo con sus datos.

## Problemas frecuentes

| Síntoma                                 | Qué revisar                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| El servicio no arranca y pide `API_URL` | Completar `.env`                                                                          |
| "Print failed: Cannot open printer"     | El nombre de la impresora en `.env` no coincide con Windows; ver `/printers`              |
| No imprime, pero la cola se conecta     | Ver el log (`logs/print-service.log`) y confirmar que la API encola en `/api/print-queue` |
| Error CORS desde el navegador           | El servicio usa `origin: '*'` porque solo escucha en loopback; no restringirlo            |
| HTTPS bloqueado (mixed content)         | Ver `scripts/setup-https.ps1` y `PFX_PASSPHRASE`                                          |
