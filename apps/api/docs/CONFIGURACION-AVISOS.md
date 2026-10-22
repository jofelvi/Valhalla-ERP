# Configuración de Avisos (SMS, WhatsApp, Correo)

Documento para configurar los canales de notificaciones del sistema Negocio.

---

## 1. Variables de Entorno Requeridas

El archivo `.env` en el VPS (`/var/www/negocio-api/.env`) debe incluir:

```env
# ─────────────────────────────────────────
# WHATSAPP
# ─────────────────────────────────────────

# URL del servicio WhatsApp (whatsapp-service local en el VPS)
WHATSAPP_SERVICE_URL=http://127.0.0.1:6000

# Clave API del servicio WhatsApp
WHATSAPP_API_KEY=<token del whatsapp-service>

# ─────────────────────────────────────────
# SMS
# ─────────────────────────────────────────

# URL del SMS bridge (httpsms o similar)
SMS_BRIDGE_URL=http://127.0.0.1:3020

# Clave API del SMS bridge
SMS_BRIDGE_KEY=<token>

# ─────────────────────────────────────────
# ALERTAS DE DIVISAS (BDV)
# ─────────────────────────────────────────

# Telefono (E.164: +58...) para recibir SMS del vigilante de subastas
DIVISAS_NOTIFY_PHONE=+584140000002

# Correo para recibir avisos del vigilante
DIVISAS_NOTIFY_EMAIL=dueno@ejemplo.com

# ─────────────────────────────────────────
# ALERTAS DE RESERVAS (evento de ejemplo)
# ─────────────────────────────────────────

# Telefono (E.164: +58...) para recibir SMS/WhatsApp de nuevas reservas
RESERVATIONS_NOTIFY_PHONE=+584140000002

# ─────────────────────────────────────────
# OPCIONAL: Personalizacion
# ─────────────────────────────────────────

# URL publica de la app (para links en los avisos)
PUBLIC_APP_URL=https://app.ejemplo.com

# Nombre del template de presupuestos en Meta
WHATSAPP_TEMPLATE_BUDGET=presupuesto

# Idioma del template de presupuestos
WHATSAPP_TEMPLATE_LANG=es
```

**IMPORTANTE:** Si alguna variable está vacía o no existe, el sistema sigue arrancando pero registra un WARN en los logs. Revisa `pm2 logs negocio-api` para ver si falta algo.

---

## 2. Avisos que Requieren Plantilla en Meta

### 2.1 Pago Pendiente (`pago_pendiente`)

**Uso:** Cuando se envía un comprobante de pago pendiente por WhatsApp con PDF adjunto.

**Variables (en orden):**
1. Nombre del cliente
2. Monto adeudado (USD)
3. Código de la orden
4. Fecha del consumo

**Ejemplo:**
```
Hola {{1}},

Vemos que debes {{2}} por tu consumo {{3}} del {{4}}.

Ingresa aquí para confirmar tu pago: [BOTÓN]

Demo Sabor
```

**Pasos para crear:**
1. Ir a Meta Business Suite → Gestor de WhatsApp → Plantillas
2. Crear nueva plantilla
3. Nombre: `pago_pendiente`
4. Idioma: Español
5. Categoría: `TRANSACTIONAL` (por si acaso)
6. Agregar:
   - **Header:** Tipo "Documento PDF" (el sistema lo adjunta automáticamente)
   - **Body:** Texto con placeholders `{{1}}`, `{{2}}`, etc.
   - **Footer:** Opcional
   - **Botón:** "Botón de URL dinámico" con parámetro para el código de orden
7. Enviar a revisión
8. Esperar aprobación (~24-48h)
9. Copiar el nombre exacto (debe ser `pago_pendiente`)

**Verificación:**
```bash
# Desde el VPS
curl -X POST http://127.0.0.1:6000/api/v1/messages/template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WHATSAPP_API_KEY}" \
  -d '{
    "to": "584140000002",
    "template": "pago_pendiente",
    "language": "es",
    "variables": ["Juan Perez", "150.00", "ORD-001", "15/09/2026"],
    "headerPdfBase64": "JVBERi0xLjQK...",
    "headerFilename": "consumo-ORD-001.pdf",
    "headerMimeType": "application/pdf",
    "buttonUrlParam": "ORD-001"
  }'
```

---

### 2.2 Presupuesto (`presupuesto` - default)

**Uso:** Envío de presupuestos/cotizaciones a clientes.

**Variables:**
1. Nombre del cliente
2. Número del presupuesto
3. Nombre del evento
4. Total en USD

**Pasos:** Similar a `pago_pendiente`, crear plantilla con:
- **Header:** Documento PDF (opcional)
- **Body:** Template con 4 variables
- **Botón:** URL dinámico con código del presupuesto

---

### 2.3 Bono Pizzero (`bono_pizzero_semanal` - futuro)

**Uso:** Reporte semanal del bono al pizzero (lunes 8am VE).

**Variables:**
1. Semana (ej: "13/01 al 19/01")
2. Cantidad pizzas grandes
3. Cantidad pizzas medianas
4. Cantidad pizzas pequeñas
5. Cantidad combos
6. Total en USD

**Pasos:**
1. Crear plantilla con nombre `bono_pizzero_semanal`
2. Body con 6 variables
3. Crear en Meta y esperar aprobación
4. Actualizar config en Mongo:

```bash
# En el VPS
mongosh negocio

# En mongosh:
db.configs.updateOne(
  { _id: 'pizza_bonus' },
  {
    $set: {
      'whatsapp.enabled': true,
      'whatsapp.template': 'bono_pizzero_semanal',
      'whatsapp.recipients': ['+584140000002'],
    }
  }
)
```

---

## 3. Configuración de Canales por Modulo

### 3.1 Bono Pizzero (Lunes 8am VE)

**Archivo config en MongoDB:**
```
db.configs
  _id: 'pizza_bonus'
```

**Estructura:**
```javascript
{
  _id: 'pizza_bonus',
  enabled: true,
  rates: {
    grande: 0.20,        // Bonificacion por pizza grande ($)
    mediana: 0.15,       // Bonificacion por pizza mediana ($)
    pequena: 0.10,       // Bonificacion por pizza pequeña ($)
    combo: 0.30          // Bonificacion por combo ($)
  },
  excludePattern: 'extra|focaccia|cachapa|panzerott|bandeja|maíz|salsa|masa',
  email: {
    enabled: true,
    recipients: ['dueno@ejemplo.com', 'contador@ejemplo.com']
  },
  sms: {
    enabled: false,       // SMS: entrega de verdad, pero fuera de 24h
    recipients: ['+584140000002']
  },
  whatsapp: {
    enabled: false,       // CAMBIAR A TRUE una vez aprobada la plantilla
    template: 'bono_pizzero_semanal',
    recipients: ['+584140000002']
  }
}
```

**Verificación:** El script se ejecuta cada lunes a las 8am VE (configurado en crontab del VPS):
```bash
# En el VPS
crontab -l | grep pizza

# Debe verse algo como:
# 0 8 * * 1 root cd /var/www/negocio-api && node scripts/reporte-bono-pizzero.cjs >> /var/log/pizza-bonus.log 2>&1
```

---

### 3.2 Vigilante de Divisas (BDV)

**Archivo config en MongoDB:**
```
db.configs
  _id: 'divisas_subasta'
```

**Variables de entorno requeridas:**
- `DIVISAS_NOTIFY_PHONE` (SMS del dueno)
- `DIVISAS_NOTIFY_EMAIL` (Correo del dueno)

**Avisos que manda:**
1. **Al abrir la subasta:** SMS + Correo inmediato
2. **Resumen diario:** Correo con el resumen de la franja

**Cron en el VPS:**
```bash
# En el VPS
crontab -l | grep divisas

# Debe verse:
# 55 7 * * * root /usr/bin/node /var/www/negocio-api/dist/scripts/subasta-watcher.js 2>&1 | logger -t negocio-divisas
```

---

### 3.3 Alertas de Reservas (evento de ejemplo)

**Variable de entorno requerida:**
- `RESERVATIONS_NOTIFY_PHONE` (WhatsApp/SMS del dueno)

**Avisos que manda:**
- Texto por WhatsApp cuando hay nueva reserva online

**Configuración:**
```javascript
// Mongo: configs/event_reservations
{
  _id: 'event_reservations',
  enabled: true,
  eventName: 'Evento de ejemplo',
  eventDate: ISODate('2026-06-27'),
  // ... mas config
}
```

---

## 4. Verificar Que Todo Esta Funcionando

### 4.1 Ver logs de la app
```bash
ssh root@<ip-del-servidor>
pm2 logs negocio-api --lines 100
```

**Busca:**
- `[ENV-VALIDATION]` — aviso sobre variables faltantes
- `pago_pendiente enviado` — confirmación de envío
- `WhatsApp pago_pendiente fallo` — errores

### 4.2 Probar template de pago pendiente
```bash
# Desde el VPS
curl -X POST http://127.0.0.1:6000/api/v1/messages/template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WHATSAPP_API_KEY}" \
  -d '{
    "to": "TU_NUMERO_DE_PRUEBA",
    "template": "pago_pendiente",
    "language": "es",
    "variables": ["Juan", "150.00", "TEST-001", "15/09"],
    "headerPdfBase64": "JVBERi0xLjQKCjEgMCBvYmo=",
    "headerFilename": "test.pdf",
    "headerMimeType": "application/pdf",
    "buttonUrlParam": "TEST-001"
  }'
```

Espera respuesta:
```json
{
  "success": true,
  "messageId": "wamid_12345..."
}
```

---

## 5. Diagnostico de Problemas

### "TIMEOUT (30s excedido)"
- `whatsapp-service` puede estar caido o muy lento
- Verificar: `pm2 describe negocio-whatsapp-service` en el VPS
- O reiniciar: `pm2 restart negocio-whatsapp-service`

### "CONEXION RECHAZADA (ECONNREFUSED)"
- `whatsapp-service` no esta escuchando en `127.0.0.1:6000`
- Verificar puerto: `netstat -tulpn | grep 6000`
- Iniciar servicio: `pm2 start negocio-whatsapp-service`

### "DNS NO RESUELTO (ENOTFOUND)"
- La variable `WHATSAPP_SERVICE_URL` tiene un hostname invalido
- Cambiar a `http://127.0.0.1:6000` (localhost)

### Plantilla rechazada en Meta
- Meta pide revisar el formato de variables
- Verificar placeholders: `{{1}}`, `{{2}}`, etc.
- Reintentar solo después de 24h

---

## 6. Resumen: Qué Tiene Que Cargar el Dueno

| Variable | Dónde | Valor Ejemplo | Urgencia |
|----------|-------|---------------|----------|
| `DIVISAS_NOTIFY_PHONE` | .env VPS | `+584140000002` | ALTA |
| `DIVISAS_NOTIFY_EMAIL` | .env VPS | `dueno@ejemplo.com` | MEDIA |
| `RESERVATIONS_NOTIFY_PHONE` | .env VPS | `+584140000002` | ALTA (si hay reservas de eventos) |
| Plantilla `pago_pendiente` | Meta | Crear + aprobar | ALTA |
| Plantilla `bono_pizzero_semanal` | Meta | Crear + aprobar | MEDIA |
| `pizza_bonus` config | Mongo | Habilitar WhatsApp | MEDIA |

---

## 7. Testing (sin enviar reales)

En desarrollo local o PRE, usar env vars que apunten a mock services:

```env
# .env.local / .env.pre
WHATSAPP_SERVICE_URL=http://127.0.0.1:6000      # Mock local
WHATSAPP_API_KEY=test-key-do-not-send

# Telefonos de TEST (no enviara reales)
DIVISAS_NOTIFY_PHONE=
RESERVATIONS_NOTIFY_PHONE=
```

Así los logs muestran "fallo" pero nunca llega un SMS/WhatsApp a un numero real.
