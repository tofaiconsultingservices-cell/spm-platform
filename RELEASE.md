# Documento Tecnico de Lanzamiento — SanPedroMotoCare Platform v1.3.0

**Fecha:** 18 de abril de 2026  
**Produccion:** https://spm-platform.vercel.app  
**Repositorio:** https://github.com/tofaiconsultingservices-cell/spm-platform<br>
**Commits totales:** 47  
**Tests:** 110 (14 archivos)  
**Coverage:** Statements 87.85% · Branches 73.09% · Functions 74.50% · Lines 89.86%

---

## 1. Resumen ejecutivo

SanPedroMotoCare Platform es un sistema unificado que consolida tres aplicaciones independientes (PWA de tracking, CRM en Vercel, y sistema de voz en Render) en una sola plataforma bajo un dominio, un repositorio y una fuente de datos.

La plataforma gestiona el ciclo de vida completo de un servicio de mecanica a domicilio: desde la captacion del lead, asignacion de mecanico, rastreo GPS en tiempo real, ejecucion del servicio, cobro (Stripe o efectivo), hasta la facturacion y reporte.

**Estado actual: produccion activa con CI/CD automatizado y testing profesional.**

---

## 2. Cronologia de desarrollo

### Fase 0 — Fundacion (commits 1-5)
- Scaffold Next.js 16 con App Router y TypeScript
- Landing page con video hero, servicios, cotizador
- Firebase Auth (Google + email) con RBAC de 5 roles
- Estructura de route groups por audiencia

### Fase 1 — Integraciones core (commits 6-15)
- Firestore como base de datos (tickets, clientes, mecanicos)
- CRM funcional: modulos Tickets, Clientes, Mecanicos
- Stripe para cobros en linea + webhooks
- Twilio para call center (voz saliente + TwiML)
- FCM para push notifications
- WhatsApp Business via Twilio
- Google Gemini chatbot 24/7
- PWA instalable con shortcuts

### Fase 2 — CRM completo y portal (commits 16-25)
- Portal de cliente autenticado (servicios, pagos, moto, perfil)
- Pagos parciales, anticipos y pagos finales
- Recibos PDF con branding SPM
- Modulos CRM: Facturas, Reportes, Configuracion
- Stepper visual de estados en tickets
- Poliza de mantenimiento para repartidores ($99/mes Stripe)

### Fase 3 — Estabilizacion (commits 26-40)
- Fix: login Google loop (popup en vez de redirect para evitar COOP cross-origin)
- Fix: pantalla blanca en login + errores al crear ticket
- Fix: Firestore rechazaba `undefined` en statusHistory (causa raiz de error al cambiar estatus)
- Fix: drawer de tickets no reflejaba cambios en tiempo real (patron selectedId + useMemo)
- Fix: datos de moto en clientes, seguridad del portal, perfil de usuario
- Fix: 4 errores de consola (Stripe 502, Firestore index, permisos, COOP)
- Paginas legales: privacidad y terminos

### Fase 4 — Testing y CI (commits 41-47)
- Vitest + happy-dom + @vitest/coverage-v8
- 110 tests unitarios en 14 archivos
- GitHub Actions CI con coverage gates (70% minimo)
- Coverage actual supera thresholds en todas las metricas

---

## 3. Stack tecnologico

| Capa | Tecnologia | Version | Proposito |
|------|-----------|---------|-----------|
| Framework | Next.js | 16.2.3 | App Router, SSR/SSG, API Routes |
| Runtime | React | 19.2.4 | UI declarativa |
| Lenguaje | TypeScript | 5.x | Tipos en toda la base de codigo |
| Estilos | Tailwind CSS | 4.x | CSS-first config con `@theme` |
| Animaciones | Framer Motion | 12.x | Transiciones y microinteracciones |
| Auth | Firebase Authentication | 12.x | Google OAuth + email/password |
| Database | Firebase Firestore | 12.x | NoSQL — tickets, usuarios, mecanicos |
| Realtime | Firebase Realtime DB | 12.x | GPS del mecanico en ruta |
| Push | Firebase Cloud Messaging | 12.x | Notificaciones web + movil |
| IA | Google Gemini | 2.0-flash-exp | Chatbot 24/7 |
| Pagos | Stripe | 22.x | Cobros + webhooks + suscripciones |
| Voz | Twilio | 5.x | Call center + WhatsApp |
| Testing | Vitest | 3.x | Tests unitarios + coverage |
| CI | GitHub Actions | — | Pipeline automatizado |
| Hosting | Vercel | — | Edge network, deploy automatico |

---

## 4. Arquitectura de la plataforma

### 4.1 Organizacion por audiencia

```
app/
├── (public)/          Sin auth requerida
│   ├── page.tsx       Landing
│   ├── cotizar/       Cotizador publico
│   ├── tracking/      Rastreo por SPM-XXXX
│   ├── privacidad/    Aviso de privacidad
│   └── terminos/      Terminos y condiciones
│
├── (auth)/
│   └── login/         Email + Google Sign-In
│
├── (portal)/          Auth: role viewer+
│   └── portal/
│       ├── page.tsx       Resumen de servicios
│       ├── servicios/     Historial completo
│       ├── pagar/         Checkout Stripe
│       ├── moto/          Datos del vehiculo
│       └── perfil/        Perfil de usuario
│
├── (field)/           Auth: role mecanico
│   └── mecanico/      App de campo
│
├── (crm)/             Auth: role operador+
│   └── crm/
│       ├── dashboard/       Metricas + mapa GPS
│       ├── tickets/         Pipeline de servicio
│       ├── clientes/        Base de datos
│       ├── mecanicos/       Disponibilidad
│       ├── pagos/           Cobros y pagos
│       ├── facturas/        Facturacion + PDF
│       ├── reportes/        Analytics
│       ├── contact-center/  Cola de llamadas
│       └── configuracion/   Settings
│
└── api/               11 endpoints server-side
```

### 4.2 Modelo de datos (Firestore)

**Colecciones principales:**

| Coleccion | Documentos | Proposito |
|-----------|-----------|-----------|
| `service_tickets` | Tickets SPM-XXXX | Ciclo de vida del servicio |
| `clients` | CLT-XXXX | Base de clientes con datos de moto |
| `mechanics` | MEC-XXX | Mecanicos con zona, skills, status |
| `users` | Firebase UID | Usuarios autenticados con rol |
| `leads` | Auto-generated | Leads del cotizador |
| `_counters` | `service_tickets` | Contador atomico para IDs |

**Pipeline de estados del ticket:**

```
lead-recibido → diagnostico-pendiente → en-camino → en-servicio → completado → pagado
                                                                       ↓
                                                                  [cancelado]
```

Cada transicion se registra en `statusHistory[]` con timestamp, userId y nota opcional.

### 4.3 Sistema de pagos

```
                    ┌─────────────────┐
                    │   Tipos de pago │
                    └─────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     anticipo          parcial           final
     (deposito)     (abono parcial)   (saldo completo)
          │                │                │
          ▼                ▼                ▼
  anticipoPagado=true  totalPaid += N   status="pagado"
  anticipo=amount                      paymentMethod set
                                       statusHistory += event
```

**Metodos soportados:** Stripe (tarjeta), efectivo, transferencia.

### 4.4 Seguridad implementada

| Capa | Medida |
|------|--------|
| Transporte | HSTS max-age=63072000 con preload |
| Autenticacion | HttpOnly cookie `__session` (Secure, SameSite=Lax, 5 dias) |
| Autorizacion | RBAC de 5 niveles (viewer → admin) en proxy.ts + AuthContext |
| API publica | Rate limiting por IP (sliding window en memoria) |
| Pagos | Webhook verificado con firma HMAC de Stripe |
| Inputs | Sanitizacion + truncado + whitelist de campos |
| Headers | CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff |
| Firebase | Admin SDK solo server-side, Security Rules activas |
| Secrets | 100% variables de entorno encriptadas en Vercel |

---

## 5. Infraestructura de testing

### 5.1 Configuracion

- **Runner:** Vitest 3.x (ESM-nativo, compatible con Next.js 16)
- **Entorno:** happy-dom (ligero, suficiente para logica server-side)
- **Coverage:** @vitest/coverage-v8 con thresholds de 70%
- **Mocking:** Firebase Client SDK y Admin SDK mockeados globalmente en `tests/setup.ts`

### 5.2 Suite de tests (110 tests en 14 archivos)

| Archivo | Tests | Area cubierta |
|---------|-------|---------------|
| `firestore-tickets.test.ts` | 17 | CRUD tickets, pipeline de estados, pagos, historial |
| `notifications-messages.test.ts` | 16 | Mensajes por status (push, voz, WhatsApp) |
| `quotes.test.ts` | 9 | Creacion de cotizaciones, validacion, rate limiting |
| `rate-limit.test.ts` | 10 | Sliding window, aislamiento por IP, retryAfter |
| `stripe-client.test.ts` | 8 | Checkout sessions, verificacion de firma, MXN→centavos |
| `index.test.ts` (types) | 7 | Constantes del sistema, STATUS_LABELS, STATUS_COLORS |
| `firestore-clients.test.ts` | 6 | CRUD clientes, campos de moto opcionales |
| `voice-say.test.ts` | 6 | TwiML XML, XSS escaping, truncado |
| `webhook.test.ts` | 6 | Webhooks Stripe, firma invalida, tipos de pago |
| `auth-session.test.ts` | 5 | Session cookie, token validation, DELETE |
| `tracking.test.ts` | 4 | Tracking publico, campos ocultos, 404 |
| `firestore-mechanics.test.ts` | 3 | CRUD mecanicos, status updates |
| `voice-status.test.ts` | 3 | Callback Twilio, body vacio/malformado |
| `firestore-invoices.test.ts` | 1 | Listener de facturas |

### 5.3 Metricas de coverage

| Metrica | Cobertura | Threshold | Estado |
|---------|-----------|-----------|--------|
| Statements | 87.85% | 70% | PASS |
| Branches | 73.09% | 70% | PASS |
| Functions | 74.50% | 70% | PASS |
| Lines | 89.86% | 70% | PASS |

### 5.4 Exclusiones de coverage (justificadas)

Archivos excluidos por ser wrappers delgados de SDKs de terceros donde testear solo verifica el mock:

- `lib/firebase.ts` — Singleton de inicializacion Firebase
- `lib/firebase-admin.ts` — Singleton Admin SDK
- `lib/invoice-pdf.ts` — Generacion PDF (dependencia de browser APIs)
- `lib/notifications/whatsapp.ts` — Wrapper Twilio WhatsApp
- `lib/notifications/push.ts` — Wrapper FCM
- `lib/notifications/voice.ts` — Wrapper Twilio Voice
- `app/api/chat/route.ts` — Proxy Gemini
- `app/api/payments/create-link/**` — NextRequest cookies incompatible con happy-dom

---

## 6. CI/CD Pipeline

### 6.1 GitHub Actions (`.github/workflows/ci.yml`)

```
Push to master / Pull Request
         │
         ▼
  ┌──────────────────┐
  │ Lint & TypeCheck  │  tsc --noEmit + ESLint
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ Tests & Coverage  │  vitest run --coverage
  └──────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Coverage   Upload        En PRs: comentario
 gates      artifacts     automatico con tabla
 (70% min)  (14 dias)     de metricas
```

### 6.2 Deploy a produccion

```
GitHub (master) → Vercel (build automatico) → Produccion (~45s)
```

- Variables de entorno encriptadas en Vercel (scope Production)
- Rollback instantaneo con `vercel rollback`

---

## 7. Bugs criticos resueltos

### 7.1 Error al cambiar estatus de ticket

**Sintoma:** Al avanzar un ticket de estado, no pasaba nada. Sin errores en consola F12.

**Causa raiz:** Firestore rechaza silenciosamente documentos con valores `undefined`. La funcion `advanceTicketStatus` construia el evento de historial con `note: note || undefined`, lo cual escribia un campo `undefined` cuando la nota estaba vacia.

**Fix:** Cambio de tipo `TicketEvent` a `Record<string, unknown>` con asignacion condicional:
```typescript
const event: Record<string, unknown> = {
  status: newStatus,
  timestamp: Timestamp.now(),
  userId,
};
if (note) event.note = note;
```

Mismo patron aplicado a `recordPayment` para campos opcionales (note, stripeSessionId, stripeUrl, registeredByName).

**Segundo problema:** Los `catch` blocks en el frontend usaban `catch { toast.error(...) }` sin capturar ni loggear el error, resultando en cero visibilidad en consola.

**Fix:** `catch (err) { console.error("advanceTicketStatus:", err); toast.error(...); }`

### 7.2 Drawer de tickets no reflejaba cambios en tiempo real

**Sintoma:** Al cambiar el estado de un ticket en el drawer lateral, los datos mostrados no se actualizaban hasta cerrar y reabrir.

**Causa raiz:** `useState<ServiceTicket | null>` guardaba una copia del objeto ticket. La suscripcion de Firestore actualizaba el array `tickets`, pero el objeto `selected` era una referencia anterior.

**Fix:** Patron `selectedId` + `useMemo`:
```typescript
const [selectedId, setSelectedId] = useState<string | null>(null);
const selected = useMemo(
  () => tickets.find(t => t.id === selectedId) ?? null,
  [tickets, selectedId]
);
```

### 7.3 Login loop con Google Sign-In

**Sintoma:** Al iniciar sesion con Google, el usuario quedaba en un loop de redirect infinito.

**Causa raiz:** `signInWithRedirect` causaba problemas de COOP (Cross-Origin-Opener-Policy) con Firebase Auth en el dominio de Vercel.

**Fix:** Cambio a `signInWithPopup` que no requiere navegacion cross-origin.

### 7.4 Pantalla blanca en login

**Sintoma:** La pagina de login mostraba pantalla blanca sin errores visibles.

**Causa raiz:** `authStateReady()` entraba en loop y `fetchOrCreateUser` fallaba silenciosamente cuando `photoURL` era `undefined` (Firestore no acepta `undefined`).

**Fix:** Excluir `photoURL` del documento si no existe + capturar errores en `fetchOrCreateUser`.

---

## 8. Metricas del sistema

| Metrica | Valor |
|---------|-------|
| Paginas (routes) | 20 |
| API Routes | 11 |
| Componentes | 50+ |
| Lineas de codigo (src) | ~15,000 |
| Tests unitarios | 110 |
| Archivos de test | 14 |
| Commits | 47 |
| Idiomas soportados | 2 (ES/EN, 285+ strings) |
| Roles de usuario | 5 (viewer, mecanico, operador, manager, admin) |
| Estados de ticket | 7 (incluyendo cancelado) |
| Integraciones externas | 5 (Firebase, Stripe, Twilio, Gemini, FCM) |
| Tiempo de deploy | ~45 segundos |

---

## 9. Limitaciones conocidas

| Limitacion | Impacto | Mitigacion planificada |
|------------|---------|----------------------|
| Rate limiting en memoria | No persiste entre instancias serverless | Redis/Upstash distribuido |
| Sin CAPTCHA en cotizador | Vulnerable a spam automatizado | hCaptcha o Cloudflare Turnstile |
| Sin Firebase App Check | Llamadas directas a Firestore posibles | Activar App Check |
| Coverage de functions al 74.5% | Algunas funciones sin test | Incrementar a 80%+ |
| NextRequest cookies en tests | Algunos endpoints no testeables con happy-dom | Evaluar node test environment |
| Sin tests E2E | No se valida flujo completo de usuario | Playwright o Cypress |
| GPS tracking sin tests | Realtime DB no mockeado | Mock de Realtime DB |

---

## 10. Roadmap tecnico

### Corto plazo (Q2 2026)
- [ ] CAPTCHA en cotizador y login
- [ ] Firebase App Check
- [ ] Tests E2E con Playwright (flujos criticos)
- [ ] Subir coverage de functions a 80%+

### Mediano plazo (Q3 2026)
- [ ] Rate limiting distribuido con Upstash Redis
- [ ] Monitoreo con Sentry o Datadog
- [ ] Webhook retry con dead letter queue
- [ ] App nativa con React Native (mecanicos)

### Largo plazo (Q4 2026)
- [ ] Multi-tenancy para franquicias
- [ ] Integracion con sistemas contables (SAT/CFDI)
- [ ] Machine learning para estimacion de costos
- [ ] Expansion geografica (Guadalajara, CDMX)

---

## 11. Instrucciones de operacion

### Deploy a produccion

```bash
git push origin master
```

El deploy es automatico via Vercel. GitHub Actions ejecuta lint + tests + coverage antes.

### Rollback de emergencia

```bash
vercel rollback
```

### Ejecutar tests localmente

```bash
npm test                # 110 tests, ~5 segundos
npm run test:coverage   # Con reporte de coverage
npm run test:watch      # Watch mode
```

### Verificar tipos

```bash
npm run typecheck
```

### Variables de entorno

```bash
vercel env ls production    # Listar variables
vercel env add VAR production  # Agregar nueva
```

---

*Documento generado el 18 de abril de 2026. SanPedroMotoCare Platform v1.3.0.*
