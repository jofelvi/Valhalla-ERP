# Estado del producto (22/10/2026)

POS de restaurante genérico: sin nombre propio, todo lo del negocio (nombre, RIF, colores, tarifas,
comisión, vocabulario, módulos) se configura desde Ajustes. Contrato en `docs/contrato-config.md`;
alta de un cliente en `docs/instancia.md`.

## Qué funciona y está probado

| Área | Evidencia |
| ---- | --------- |
| Instalación nueva arranca neutra ("Punto de venta", paleta azul, sin RIF ni logo) | API real con base vacía + web compilada en producción, navegador con video; el HTML compilado no contiene ninguna marca ajena |
| Configurar el negocio en Ajustes cambia la marca en toda la app, también al recargar | Recorrido en navegador (guardar nombre → barra, título y páginas siguientes) |
| El servidor calcula el dinero: servicio adicional / incluido / ninguno, impuesto sumado o incluido, comisión sobre ventas o sobre servicio | Humo contra la API real: el cliente manda 99/199, el servidor guarda 10/110 con su tasa; al cambiar la tarifa la orden nueva sale distinta y la vieja no se mueve |
| Seguridad por defecto: sin sesión todo lo no público responde 401 | `GET /api/products`, `/api/orders`, `PATCH /api/configs/*`, `POST /api/orders` → 401; `/api/config/publico` y `/api/version` abiertos |
| Pruebas | API 1709, web 239, móvil 161, print-service 8; `tsc` en 0 errores en las cuatro apps |

## Lo que NO está hecho

1. **Despliegue.** Nada se ha subido al VPS. Falta: dominio de la instalación, repo remoto, secreto del
   webhook, SMTP. El script `scripts/instancia/nueva-instancia.sh <nombre> --dry-run` está probado solo en seco.
2. **App móvil.** Compila y exporta el bundle de Android, pero no se ha corrido en un teléfono ni compilado
   un APK/IPA. EAS y cualquier copia aislada de `mobile/` deben incluir `packages/types/src`.
3. **Impresión física.** El print-service pasa sus pruebas, pero no se imprimió en papel. El QR informativo de
   Pago Móvil cambió de formato (`PM-<banco>|…`); el print-service lo acepta, falta probar en una impresora.
4. **Vocabulario.** Los nombres de rol/estación son configurables, pero solo se aplicaron al menú y a las
   pantallas de cobro y nómina. Quedan literales ("Mesonero", "Cocina", "Barra") en otras pantallas web y móvil.
5. **Localización.** Sigue fijo a Venezuela: Bs/VES y tasa BCV, catálogo de bancos, módulo BDV, OCR de facturas,
   formato de cédula/RIF. Son funcionalidades, no parámetros; un cliente de otro país exige trabajo nuevo.
6. **Packs/tobos y fichas de barra.** El registro nace vacío (`configs/packs`) y los módulos están apagados. Web y
   móvil todavía no descargan ese registro de la API: encender el módulo exige además ese enlace.
7. **Campos que el contrato aún no tiene** (los pidieron los carriles): tasa de cambio configurable, jornal
   diario del mesonero (hoy 5), validez de presupuestos, `mobilePayment.qrImageUrl`, prefijos móviles por país.
8. **Pendientes menores.** `features/settings/GeneralSettingsForm.tsx` quedó sin uso; las constantes
   `SETTINGS_*` viven en `settings/secciones.ts` y no en `routes.ts`; ~40 archivos web usan colores crudos
   de Tailwind en vez de tokens; el registro de un cliente desde la app llama a un endpoint de correo de
   bienvenida que exige rol ADMIN/MANAGER y falla en silencio; `tsc` con `incremental` se cae con "Debug Failure"
   en el CLI (sin esa opción compila limpio).

## Para continuar

```bash
node_modules/.bin/tsc -p packages/types/tsconfig.json        # compilar tipos compartidos
cd apps/api && npx jest && npx tsc --noEmit -p tsconfig.build.json --incremental false
npx tsc --noEmit && node --experimental-strip-types --test "src/shared/**/*.test.ts" "src/features/**/*.test.ts"
```

Antes de entregar el código a un tercero: auditar el historial (es corto y sin el del original), rotar toda
clave que haya vivido en el negocio de origen, y definir licencia.

## Hallazgos de la prueba de la PWA como mesonero (22/10/2026)

Probado en teléfono virtual (390×844) con el dominio final simulado; la venta por API (orden de zona →
cobro en efectivo) funciona con el stock en 0. Lo que sigue quedó del sistema de origen y estorba al revender:

- **Zonas fijas de club deportivo** (`ZoneSectorEnum`: Piscina, Tenis, Fútbol, Béisbol, Canchas, Salón
  principal) en el selector de zonas de la app móvil (`ZonesScreen`, `CartScreen`, `TransferModal`,
  `Cashier*`), la web (`ZoneOrdersSection`, `ZonesCompactPanel`, `sectorLabels`), los avisos push
  (`push-message.ts`) y el print-service. Debe pasar a una lista configurable en `operacion`.
- **Cliente obligatorio** al crear un pedido por zona en la app móvil ("Asignar cliente (obligatorio)",
  búsqueda por "acción" de socio). La API no lo exige (`customerId` es opcional): es solo la pantalla.
- **Textos**: "Escribí…" (voseo, no es de Venezuela) y el subtítulo fijo "Deliciosa comida, a un toque de
  distancia" en el login móvil (debería salir de `negocio.tagline`).
- **Mesas**: la instancia no trae ninguna; sin ellas el mesonero solo puede vender por zona.
