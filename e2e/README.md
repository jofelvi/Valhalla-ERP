# Suite end-to-end de la web del POS

Guiones de Playwright que hacen lo que haria una persona: entrar, navegar,
mirar. **Todos son de SOLO LECTURA** — no crean ni modifican ordenes, ni
cobran, ni imprimen. Por eso se pueden correr contra produccion.

## Por que existe

Hasta ahora cada verificacion de pantalla era un guion de un solo uso que se
borraba (regla del repo: los `test-*.mjs` no se commitean). Resultado: cada
vez que se tocaba algo habia que rehacer la prueba a mano, y nadie sabia que
estaba cubierto. Esto es lo que queda guardado.

## Correrla

```bash
cp e2e/.env.example e2e/.env.local   # y poner las credenciales
npm run test:e2e                      # o: npx playwright test
npm run test:e2e:report               # el informe HTML del ultimo run
```

Para una corrida rapida, acortar la ventana de observacion de la red:

```bash
E2E_VENTANA_REPOSO_SEG=10 npx playwright test
```

## Que cubre

| Guion                            | Que vigila                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.login.spec.ts`             | Que cada rol aterrice donde le toca (`getDefaultRouteByRole`). El dia que `UserRoleEnum.PIZZA` valio `undefined`, el pizzero vio las 101 recetas del negocio en vez de sus 42 pizzas, y nada fallo. |
| `pos.sidebar-navigation.spec.ts` | La regresion de `043c571`: el menu lateral quedaba muerto en `/private/pos/order` por un bucle de renders en `ProductSelector`. El dueno lo reporto; no habia nada que lo vigilara.                 |
| `pos.pack-conversion.spec.ts`    | Que el precio del pack que muestra la pantalla sea el que devuelve el servidor, no uno cableado. La tabla vieja decia $11 cuando el tobo de lata vale $14.                                          |
| `network-at-rest.spec.ts`        | **Red en reposo = 0.** Regla del dueno, dicha asi: "es vital". Se carga la pantalla, no se toca nada, y si algun endpoint se repite, falla.                                                         |

## Cosas que cuestan un rato si no se saben

- **Corre EN SERIE (`workers: 1`), a proposito.** Todos los guiones entran con
  la misma cuenta; con 6 workers en paralelo los logins se pisan y fallan 9 de
  20 — los mismos que pasan cuando se corren solos. Con un usuario por rol se
  puede volver a paralelizar.
- **Sin credencial para un rol, sus tests se SALTAN** diciendo cual falta. No
  fallan: un rojo por un usuario que no existe no se distingue de un rojo por
  una app rota.
- **Con solo el admin ya corre casi todo**: los guiones del POS usan la caja si
  hay credencial, y si no, el admin.
- **Las etiquetas del sidebar llevan tilde** ("Órdenes"). Buscar `/Ordenes/`
  no encuentra nada.
- **`e2e/.env.local` no se commitea** (`.gitignore`, `.env*.local`).
- Apuntando a `localhost` se levanta `pnpm dev` solo; contra un ambiente
  remoto no.

## Lo que NO cubre todavia

- Cobrar, comandar, entregar con ficha e imprimir: son escrituras, y para
  probarlas hace falta un ambiente que se pueda ensuciar (PRE o `pos_local`)
  con usuarios por rol.
- La PWA (`/app/`) y el APK.
- El presupuesto de renders por interaccion (el `<Profiler>` de la etapa 5.4).
