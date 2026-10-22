<p align="center">
  <img src="assets/marca/valhalla-claro.png" alt="Valhalla ERP" width="320">
</p>

# Valhalla ERP

Sistema de punto de venta y gestión para restaurantes, bares y locales de consumo. Una instalación
por cliente: el nombre, el logo, los porcentajes de servicio y comisión, los impuestos, el
vocabulario y los módulos se configuran desde el panel, sin tocar el código.

## Qué lo compone

| Parte         | Ruta             | Tecnología                                                    |
| ------------- | ---------------- | ------------------------------------------------------------- |
| API           | `apps/api/`      | NestJS 10, Mongoose, MongoDB, WebSockets                      |
| Panel web     | `src/`           | Next.js 15, React 19, Tailwind v4                             |
| App móvil/PWA | `mobile/`        | Expo 54 (React Native); se exporta también como PWA           |
| Impresión     | `print-service/` | Node, Express, ESC/POS (rollo de 58 mm), corre en la caja     |
| Tipos         | `packages/types` | `@odin6/types`: contrato de configuración y enums compartidos |

## Configuración por cliente

Todo lo propio de un negocio vive en la colección `configs` (negocio, marca, tarifas, nómina,
operación, vocabulario, módulos) y se publica en `GET /api/config/publico`. El contrato completo
está en [docs/contrato-config.md](docs/contrato-config.md).

## Instalar una instancia

Un servidor, un cliente, un puerto propio y su propia base de datos. Pasos y comandos en
[docs/instancia.md](docs/instancia.md); el estado de lo que falta en [docs/estado.md](docs/estado.md).

```bash
bash scripts/instancia/nueva-instancia.sh --dry-run   # muestra qué haría, sin tocar nada
bash scripts/deploy/desplegar-servidor.sh <instancia> # compila solo lo que cambió y verifica
```

## Desarrollo

```bash
pnpm install
pnpm dev                                  # panel web
cd apps/api && pnpm start:dev             # API con recarga
cd print-service && pnpm test             # pruebas de los tickets
```

Se exige que pasen `eslint` y `prettier`; no se usa `any`.

## Marca

Los logos están en [assets/marca/](assets/marca/): versión para fondo claro, para fondo oscuro y el
emblema solo. Se cargan desde el panel (Configuración → Marca) y la web y la app móvil los comparten.
