# Scripts de la PC de caja

Scripts de Windows para que el servicio de impresión sobreviva a cortes de luz y reinicios.
Todo lo específico de la instalación va en `caja.env` (copiar de `caja.env.example`); los
scripts no tienen rutas, nombres ni direcciones propias.

| Archivo                      | Qué hace                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caja-config.ps1`            | Lee `caja.env`. Lo cargan los demás scripts con dot-sourcing.                                                                                                              |
| `supervisor-impresion.ps1`   | Bucle principal, cada 30 s: amarra las impresoras a su conector físico, verifica que el servicio responda y lo levanta si no. Se corre como tarea `<INSTANCIA>-impresion`. |
| `vigilante.ps1`              | Cada 60 s: si el servicio no responde y el supervisor no corre, reinicia la tarea del supervisor.                                                                          |
| `vpstunnel-system.ps1`       | Túnel SSH inverso al VPS, como SYSTEM. Solo si `VPS_HOST` está definido.                                                                                                   |
| `identificar-impresoras.ps1` | Manda a cada impresora un ticket rotulado con su conector, para saber cuál es cuál.                                                                                        |
| `setup-resiliencia.ps1`      | Se corre una vez como Administrador: energía sin suspensión, USB sin ahorro y las tareas SYSTEM al arranque. Es idempotente.                                               |

## Puesta en marcha

1. Instalar el servicio (`print-service/`: `pnpm install`, `pnpm build`, `.env` con `API_URL`).
2. Copiar `caja.env.example` a `caja.env` en la carpeta de estos scripts y completarlo.
3. Ejecutar `identificar-impresoras.ps1` y anotar el conector de cada impresora en `MAPA_PUERTOS`.
4. Como Administrador: `powershell -ExecutionPolicy Bypass -File setup-resiliencia.ps1`.
5. Verificar en `http://127.0.0.1:<PUERTO_SERVICIO>/status` y en `/printers`.

## Por qué el mapa de conectores

Las impresoras de igual modelo no traen número de serie, y Windows les reparte el puerto USB
en cada arranque. Lo único estable es el conector físico. Si una impresora cambia de conector,
hay que actualizar `MAPA_PUERTOS` y reiniciar la tarea `<INSTANCIA>-impresion`.
