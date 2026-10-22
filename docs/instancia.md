# Alta de un cliente nuevo (instancia)

Cada cliente es una **instancia separada** en el VPS compartido: su propia API, web, webhook,
base de Mongo y procesos PM2, todos con el prefijo de su nombre (`<instancia>-api`, `-web`,
`-webhook`). Dar de alta un cliente no toca a las demás instancias ni a los servicios del VPS.

## 1. Cuentas que el cliente (o el operador, por él) debe abrir

| Cuenta                                                   | Para qué                                                                                             | Quién la abre      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| Dominio (`pos.<cliente>` y `pos-api.<cliente>`)          | Web y API públicas. El DNS debe apuntar a la IP del VPS **antes** de dar de alta (certbot lo exige). | Cliente            |
| Correo transaccional (SMTP o servicio de notificaciones) | Avisos de despliegue, correos al personal                                                            | Cliente u operador |
| Apple Developer                                          | Solo si hay app iOS (TestFlight / App Store)                                                         | Cliente            |
| Google Play Console                                      | Solo si hay app Android                                                                              | Cliente            |
| Proyecto Firebase / FCM                                  | Notificaciones push de la app Android                                                                | Operador           |
| Cuenta de Expo (EAS)                                     | Builds de la app móvil                                                                               | Operador           |
| GitHub (repo del cliente o acceso del operador)          | Repo que despliega la instancia y webhook de push                                                    | Operador           |

El cliente no necesita cuenta en el VPS: la administra el operador.

## 2. Dónde van las claves

**Nunca en el repositorio.** Cada instancia tiene su carpeta de secretos en el VPS:

| Archivo                              | Contenido                                                                            | Permisos |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------- |
| `/etc/<instancia>/instancia.env`     | Copia de la configuración no secreta (`instancias/<nombre>.env`)                     | 644      |
| `/etc/<instancia>/api.env`           | Claves de la API (`JWT_SECRET`, correo, push, etc.). Se enlaza como `.env` de la API | 600      |
| `/etc/<instancia>/web.env`           | Variables de la web (`NEXT_PUBLIC_*` se hornean en el build)                         | 600      |
| `/etc/<instancia>/webhook.env`       | `WEBHOOK_SECRET` del webhook de GitHub (lo genera el alta)                           | 600      |
| `/etc/<instancia>/deploy-notify.env` | Servicio de correo de los avisos de despliegue                                       | 600      |

Los `CAMBIAR` que deja el alta en `api.env` y `web.env` son las claves externas que faltan.
Mientras existan, el primer despliegue **no se lanza** y el alta lo dice.

## 3. Orden de pasos

1. **DNS**: `pos.<cliente>` y `pos-api.<cliente>` apuntan a la IP del VPS.
2. **Clon de arranque** del repo en cualquier carpeta del VPS (no es el checkout de la instancia):
   ```bash
   git clone <REPO_URL> /root/alta-<instancia>
   cd /root/alta-<instancia>
   ```
3. **Configuración de la instancia**: copiar la plantilla y completarla.
   ```bash
   cp instancias/odin6.env.example instancias/<instancia>.env
   nano instancias/<instancia>.env     # INSTANCIA, dominios, puertos, BASE_MONGO, REPO_URL, EMAIL_AVISOS
   ```
   Los puertos deben estar libres. Los reservados (de otros servicios del VPS) están en el guion.
4. **Simulacro** (no toca nada):
   ```bash
   bash scripts/instancia/nueva-instancia.sh <instancia> --dry-run
   ```
   Debe terminar con `Fin del dry-run` y sin errores. Los avisos de herramientas ausentes
   (`ss`, `pm2`, `mongosh`) son esperables fuera del VPS.
5. **Alta real** (como root en el VPS):
   ```bash
   bash scripts/instancia/nueva-instancia.sh <instancia>
   ```
   Crea las carpetas y los secretos, clona el repo en `/var/www/<instancia>-build`, certbot,
   vhosts de nginx y el proceso `<instancia>-webhook`. Si hay secretos cargados, también
   hace el primer despliegue y la siembra de la base.
6. **Claves**: editar `/etc/<instancia>/api.env` y `web.env` (quitar los `CAMBIAR`).
7. **Primer despliegue** (si el paso 5 no lo hizo):
   ```bash
   bash /var/www/<instancia>-build/scripts/deploy/desplegar-servidor.sh <instancia> --todo
   ```
8. **Siembra** de la base (si no se hizo en el paso 7): el sembrador escribe los documentos
   `configs/*` de la instancia (`apps/api/scripts/sembrar-instancia.mjs`).
9. **Webhook de GitHub** en el repo del cliente: Settings → Webhooks → Add webhook.
   - Payload URL: `https://pos-api.<cliente>/webhook/deploy`
   - Content type: `application/json`
   - Secret: el de `/etc/<instancia>/webhook.env` (`WEBHOOK_SECRET`)
   - Eventos: solo `push`.

## 4. Cómo verificar

```bash
curl -s https://pos-api.<cliente>/api/version      # sha y versión de la API
curl -s https://pos.<cliente>/api/version          # sha y versión de la web
pm2 status                                          # <instancia>-api, -web, -webhook online
tail -40 /var/log/<instancia>-deploy.log            # último despliegue
cat /var/lib/<instancia>-deploy/ultimo              # resultado: EXITOSO | REVERTIDO | FALLIDO
```

El `sha` que devuelve `/api/version` debe ser el del último commit de la rama. Que el sha
coincida no basta para dar por bueno el despliegue: la web se verifica también por el CSS que
sirve (el guion lo mide).

Un push a la rama de la instancia despliega solo: el webhook lanza el guion, que compila lo que
cambió, respalda Mongo antes de tocar la API y revierte si no responde.

## 5. Si algo falla a medias

- **El alta aborta antes de tocar nada** (puerto ocupado, nombre de PM2 o vhost existente,
  base de Mongo existente): corregir el `.env` de la instancia y reintentar.
- **El alta falla después de crear archivos** (por ejemplo, certbot porque el DNS aún no
  apunta): el log indica en qué paso quedó. Lo creado (carpetas, `/etc/<instancia>`, vhosts)
  se revisa y se borra a mano antes de reintentar; el guion no deshace solo.
- **El despliegue revirtió**: el correo de aviso dice a qué versión volvió. El log completo está
  en `/var/log/<instancia>-deploy.log`.

## Módulos

`configs/modulos` enciende lo opcional (`ModulosConfig` en el contrato). Apagado = la ruta responde
404, el menú lo oculta y su tarea programada no corre. Dónde se aplica cada uno:

| Módulo | Dónde se aplica | Cuándo se revisa |
| ------ | --------------- | ---------------- |
| `packsAndBuckets` | Packs y tobos (`configs/packs`): rutas `/:id/opciones-conversion` y `/:id/convertir-pack` (404). Sin el módulo el registro es vacío y no se convierte ni se ofrece nada. | En cada operación. |
| `barTokens` | Fichas de barra: rutas `/api/orders/ficha/*` y `/:id/ficha*` (404), creación de fichas en la cola de impresión y movimiento de stock de barra. | En cada operación. |
| `bankReconciliation` | Verificación automática de Pago Móvil contra el banco (cola con el scraper) y `POST /api/pago-movil/bank-verify`. La reserva de la referencia y la verificación manual **no** se apagan: son el control de cobro doble y de caja. | En cada operación (la cola se vacía si se apaga con cola pendiente). |
| `telegramBot` | Bot de gastos y su informe programado. | **Solo al arrancar la API.** Ver abajo. |
| `currencyWatcher` | Vigilante de la subasta (`apps/api/src/scripts/watch-subasta.ts`): revisa el módulo al arrancar el script. | Al arrancar el script. |

**Límite del bot de Telegram:** `TelegramBotService.onModuleInit` lee `telegramBot` una sola vez.
Encenderlo o apagarlo exige reiniciar la API (`pm2 restart`). Las tareas programadas sí lo
revisan en cada tick. Hacerlo reactivo implicaría parar y arrancar el polling en caliente; no se
hizo por riesgo.

**Datos que hay que sembrar al migrar una instancia que ya tiene packs o fichas:** el documento
`configs/packs` (`{ packs: { <id>: { totalUnits, label } }, individualAPacks: { <id>: [<id pack>] } }`)
con los IDs de productos de ESE negocio, y `modulos.packsAndBuckets` / `modulos.barTokens` en `true`.
Sin esto, la instancia sigue funcionando pero sin packs ni fichas. Los IDs ya no están en el código.

## Sembrado

Script: `apps/api/scripts/sembrar-instancia.mjs`. Es idempotente: se puede correr de nuevo sin
romper nada. Lo llama `scripts/instancia/nueva-instancia.sh`.

```bash
node apps/api/scripts/sembrar-instancia.mjs --instancia <nombre> --base <db> --uri <mongo> [--demo]
```

| Opción | Qué hace |
| ------ | -------- |
| `--instancia` | Nombre de la instalación; solo se muestra en el log. |
| `--base` | Base de Mongo donde se siembra (si se omite, la de la URI). |
| `--uri` | URI de Mongo. Si se omite, usa `MONGODB_URI`. |
| `--demo` | Escribe el perfil de prueba ficticio "Demo Sabor" en `configs`. |

Sin `--demo` **no escribe configuración**: la instalación arranca neutra (sin nombre, sin RIF,
paleta genérica) y el cliente la completa desde Ajustes.

**Primer administrador.** Solo si la base no tiene usuarios, y con estas variables:

- `ADMIN_EMAIL`: correo del administrador.
- `ADMIN_PASSWORD`: clave de al menos 8 caracteres. Se guarda con bcrypt (10 rondas), igual que el
  registro de la API.
- `ADMIN_NAME`: nombre visible (por defecto "Administrador").

Si la base ya tiene usuarios, el script avisa y no crea nada.

**Perfil demo (`--demo`).** Solo para probar. Escribe los documentos `negocio`, `marca`, `tarifas`,
`operacion`, `vocabulario` y `modulos` con datos inventados (RIF `J-00000000-0`, correo
`demo@ejemplo.com`, servicio del 12 %, vocabulario "Camarero/Camareros", zona horaria de Nueva
York). Sirve para comprobar que ninguna pantalla, aviso ni recibo muestra otro nombre. **No correrlo
en una instalación real**: sobrescribe la configuración.

Ejemplo de prueba local:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/pos_demo ADMIN_EMAIL=admin@ejemplo.com ADMIN_PASSWORD=cambiar-esta-clave \
  node apps/api/scripts/sembrar-instancia.mjs --instancia demo-local --demo
```

## Probar por IP o por túnel antes del subdominio

`nueva-instancia.sh <nombre> --sin-nginx` instala todo menos los vhosts y los certificados. En
`instancias/<nombre>.env` se pueden poner `URL_API_PUBLICA` y `URL_WEB_PUBLICA` (p. ej.
`http://localhost:3201` y `http://localhost:3202` con un túnel
`ssh -N -L 3201:127.0.0.1:3201 -L 3202:127.0.0.1:3202 root@<vps>`): se hornean en la web y en la API.
Al lanzar el subdominio hay que cambiarlas en `/etc/<nombre>/{api,web}.env`, crear los vhosts
(correr el guion sin `--sin-nginx` sobre una instancia nueva, o copiar las plantillas) y recompilar con
`desplegar-servidor.sh <nombre> --todo`, porque `NEXT_PUBLIC_*` se hornea en el build.

## Importar un catálogo ya hecho

`apps/api/scripts/importar-catalogo.mjs` copia categorías, productos y fórmulas de otra base Mongo
(solo lectura en el origen; upsert por `_id` en el destino; nunca borra). Ver el encabezado del
script para las opciones (`--excluir-categorias`, `--categoria-de-arrastrados`, `--renombres`,
`--imagenes-de`, `--con-almacenes`, `--dry-run`). El archivo de renombres es del cliente: no va al repo.

## Proteger recetas al dar acceso a un tercero

Si el catálogo viene de un negocio real y la instancia se le da a otro (p. ej. un competidor), importar
con `--ofuscar-recetas` y la semilla en la variable `OFUSCAR_SEMILLA` (guardada fuera del repo, p. ej.
`/etc/<instancia>/ofuscacion.seed`, 600). Cada ingrediente sube con un factor propio (cambian las
proporciones, nunca baja un valor), el rendimiento y los costos suben coherentes y los preparados pierden
las cantidades de sus descripciones. Es determinista: reimportar con la misma semilla da los mismos
valores. Ver `apps/api/scripts/lib/ofuscar-recetas.mjs` (tests: `node --test apps/api/scripts/lib/`).
Los valores resultantes son un estimado por encima de la realidad, no la receta.
