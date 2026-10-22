# Safe Internal Navigation

`SafeNavAnchor` estandariza la navegacion interna en zonas criticas (como sidebars del POS), evitando dependencias directas de `next/link` cuando hay estados de render pesados.

## Que resuelve

- Mantiene navegacion suave con `router.push` para rutas internas.
- Respeta UX nativa de navegador:
  - `Ctrl/Cmd/Shift/Alt + click` abre nueva pestana/ventana.
  - Click medio/derecho no se intercepta.
  - `target="_blank"` conserva comportamiento normal.
- Incluye fallback opcional a hard navigation (`window.location.assign`) si `router.push` falla.

## Uso recomendado

Usar `SafeNavAnchor` en:

- Sidebars y menus persistentes.
- Enlaces de rutas criticas de checkout/pos.
- Cualquier flujo donde la navegacion deba ser robusta bajo carga de re-renders.

Ejemplo:

```tsx
<SafeNavAnchor href="/private/pos/order" className="...">
  Ordenes
</SafeNavAnchor>
```

## Notas

- Solo intercepta rutas internas (`/algo`).
- Para URLs externas, el enlace funciona como un `<a>` normal.
- Si no se quiere fallback a hard nav, usar `disableFallback`.
