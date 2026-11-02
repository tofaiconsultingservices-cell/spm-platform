# SanPedroMotoCare — Documento Descriptivo de la Plataforma

**Versión:** 1.3.0  
**Fecha:** Mayo 2026  
**Dominio:** https://spm-platform.vercel.app  
**Repositorio:** Privado (GitHub)

---

## 1. Visión General

SanPedroMotoCare (SPM) es una plataforma digital de gestión de servicios mecánicos a domicilio para motocicletas, diseñada para operar en San Pedro Garza García y el área metropolitana de Monterrey, México.

El sistema consolida en un único repositorio y un único dominio lo que anteriormente eran tres sistemas separados: una aplicación PWA de rastreo, un CRM independiente y un backend de voz. Esta consolidación elimina silos de información, sincronización manual entre sistemas y duplicación de datos.

La plataforma atiende a cuatro tipos de usuarios: **clientes** que solicitan servicios, **mecánicos** que los ejecutan en campo, **operadores** que coordinan las operaciones, y **administradores** que gestionan la configuración y los reportes del negocio.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Función |
|---|---|---|---|
| Framework | Next.js App Router | 16.2.3 | SSR, rutas, middleware, API Routes |
| Lenguaje | TypeScript | 5.x | Tipado estático en todo el proyecto |
| Estilos | Tailwind CSS v4 + PostCSS | 4.x | Diseño con `@theme` en CSS, sin config.ts |
| UI / Animaciones | React 19 + Framer Motion | 19.2.4 / 12.x | Componentes y transiciones |
| Formularios | React Hook Form | 7.x | Validación declarativa |
| Iconos | Lucide React | 1.8.0 | Sistema de íconos consistente |
| Gráficas | Recharts | 3.x | Visualizaciones en el módulo de reportes |
| Caché cliente | TanStack Query | 5.x | Sincronización y caché de datos |
| Fechas | date-fns | 4.x | Manipulación de fechas |
| Autenticación | Firebase Auth | 12.x | Google OAuth + Email/Contraseña |
| Base de datos | Firestore | 12.x | Almacén NoSQL principal |
| Tiempo real | Firebase RTDB | 12.x | GPS de mecánicos (baja latencia) |
| Push | Firebase Cloud Messaging | 12.x | Notificaciones web + PWA |
| Pagos | Stripe | 22.x | Checkout Sessions + Webhooks (MXN) |
| SMS / WhatsApp / Voz | Twilio | 5.x | Notificaciones y llamadas |
| Chatbot IA | Mistral AI | small-latest | Atención al cliente 24/7 |
| Hosting | Vercel | — | Serverless + CI/CD automático |
| PWA | Web Manifest + next-pwa | 5.6.0 | App instalable en dispositivos |

---

## 3. Arquitectura

### 3.1 Diseño monolítico con Route Groups

La aplicación usa el App Router de Next.js organizado en cinco **route groups** que separan audiencias sin afectar las URLs del usuario:

| Route Group | Audiencia | Requisito de acceso |
|---|---|---|
| `(public)` | Visitantes anónimos | Ninguno |
| `(auth)` | Todos | Flujo de inicio de sesión |
| `(portal)` | Clientes | rol: viewer o superior |
| `(field)` | Mecánicos | rol: mecanico |
| `(crm)` | Operadores y administradores | rol: operador o superior |

### 3.2 Seguridad en capas

La protección de rutas opera en dos niveles independientes:

1. **Middleware (`proxy.ts`):** Detecta la presencia de la cookie de sesión y redirige rápidamente al login si no existe. Es una verificación de UX, no de seguridad.
2. **AuthContext (cliente):** Valida el token de Firebase y el rol del usuario mediante la jerarquía de pesos definida en Firestore. Esta es la capa de seguridad real.

### 3.3 Jerarquía de roles

Los roles tienen un peso numérico que permite comparaciones simples en las reglas de acceso:

| Rol | Peso | Acceso |
|---|---|---|
| viewer | 1 | Portal de clientes |
| mecanico | 2 | App de campo |
| operador | 3 | CRM completo |
| manager | 4 | CRM + Reportes + Configuración |
| admin | 5 | Acceso total, gestión de roles |

---

## 4. Modelo de Datos (Firestore)

### 4.1 `service_tickets` — El núcleo del negocio

Cada servicio genera un ticket con ID secuencial (SPM-XXXX) y sigue un pipeline de estados:

```
lead-recibido → diagnostico-pendiente → en-camino → en-servicio → completado → pagado
```

Campos principales: `ticketId`, `status`, `clientInfo`, `mechanicAssignment`, `costs` (estimado, anticipo, final, totalPagado), `diagnosis`, `photos`, `payment` (Stripe session, historial de pagos parciales), `events` (auditoría completa de cambios de estado).

### 4.2 `users`

Todos los usuarios autenticados. Vinculados al UID de Firebase Auth. Incluyen: rol, datos de contacto, token FCM (para push), métricas de actividad.

### 4.3 `clients`

Base de datos de clientes con: historial de servicios, total pagado, lead score, fuente de adquisición. Las métricas de valor permiten identificar clientes de alto valor y frecuencia.

### 4.4 `mechanics`

Equipo de mecánicos con: estado de disponibilidad, zonas de cobertura, habilidades por tipo de servicio, calificaciones y última posición GPS (referenciada desde RTDB).

### 4.5 `motorcycles`

Vehículos registrados por los clientes. Campos: marca, modelo, año, cilindrada, tipo, color, placa, VIN, fotos. Los mecánicos consultan esta información antes de llegar al servicio para preparar refacciones correctas.

### 4.6 `products`

Catálogo de inventario con: SKU, categoría, unidad, costo, precio de venta, stock actual y umbral mínimo para alertas. Categorías: motor, transmisión, suspensión, frenos, eléctrico, neumáticos, lubricantes, carrocería, encendido, herramientas, accesorios.

### 4.7 `inventory_movements`

Bitácora de todos los movimientos de stock: compra, venta-tienda, uso-servicio, ajustes, devoluciones. Cada movimiento registra producto, cantidad, usuario que lo realizó y ticket asociado (cuando aplica).

### 4.8 `purchase_orders`

Órdenes a proveedores con pipeline: `borrador → enviada → recibida-parcial → recibida-completa → cancelada`. Soporta recepciones parciales de mercancía.

### 4.9 `store_orders`

Pedidos de la tienda en línea con ID secuencial (ORD-YYYY-XXXXX). Incluye: cliente, artículos, dirección de envío, método de entrega (envío a domicilio o recolección en taller), estado de pago.

### 4.10 `settings/platform`

Documento único de configuración operativa: monto de anticipo (por defecto $200 MXN), horarios de atención, zonas de cobertura y canales de notificación. Editable desde el CRM sin redespliegue.

### 4.11 `_counters`

Generadores atómicos de IDs secuenciales usando transacciones de Firestore para evitar colisiones en concurrencia alta. Genera IDs para tickets (SPM-XXXX), clientes (CLT-XXXXXX), mecánicos (MEC-XXXX), inventario (INV-YYYY-XXXXX) y pedidos (ORD-YYYY-XXXXX).

### 4.12 Firebase Realtime Database

Almacena en tiempo real las coordenadas GPS de los mecánicos durante desplazamientos activos: `{lat, lng, updatedAt, ticketId}`. La baja latencia de RTDB permite que el mapa del CRM y el rastreador público se actualicen en tiempo real sin polling.

---

## 5. Módulos de la Plataforma

### 5.1 Módulo Público (sin autenticación)

#### Landing Page (`/`)
Página de inicio con: sección hero con video responsivo comprimido (35 KB escritorio / 447 KB móvil, reducción del 90% respecto al original de 14 MB), catálogo de servicios, widget de rastreo en línea, formulario de cotización, mapa y datos de contacto, chatbot IA y banner de instalación PWA. Disponible en español e inglés.

#### Formulario de Cotización (`/cotizar`)
Formulario público que genera un ticket SPM-XXXX mediante una transacción atómica en Firestore. Campos requeridos: nombre, teléfono, correo, dirección, tipo/marca/año de moto, tipo de servicio, descripción, horario preferido. Implementa: rate limiting (5 solicitudes/min por IP), truncado de inputs, lista blanca de campos y validación server-side. Devuelve el ID del ticket inmediatamente.

#### Rastreo Público (`/tracking`)
Permite consultar el estado de cualquier ticket por su ID (SPM-XXXX). Retorna campos seguros: estado, nombre del mecánico, dirección parcial (calle y colonia, no número exacto), costo estimado y nombre del mecánico. El teléfono del mecánico solo se revela cuando el estado es `en-camino` o `en-servicio`, protegiendo la privacidad del equipo. Se actualiza en tiempo real mediante listeners de Firestore. Rate limiting: 30 solicitudes/min por IP.

#### Tienda en Línea (`/tienda`)
Catálogo de productos por categoría. Detalle de producto con especificaciones, imágenes y stock. Carrito de compras, checkout vía Stripe Payment Link. Opciones de entrega: envío a domicilio o recolección en taller. Rastreo de pedido para clientes.

#### Chatbot IA (widget global)
Disponible en todas las páginas como burbuja fija en la esquina inferior derecha. Alimentado por Mistral AI (`mistral-small-latest`). El prompt del sistema incluye: servicios, precios, zonas de cobertura, horarios, preguntas frecuentes y métodos de pago. Mantiene historial de los últimos 10 mensajes en el cliente. Detecta el idioma del usuario (ES/EN) y responde en consecuencia. Rate limiting: 20 solicitudes/min por IP.

---

### 5.2 Portal del Cliente (`/portal/*`)

Requiere autenticación (rol `viewer` o superior).

**Inicio del portal (`/portal`):** Dashboard con los últimos 5 servicios en tiempo real, accesos rápidos (rastrear, pagar, mis motos) y resumen de pagos pendientes.

**Mis Servicios (`/portal/servicios`):** Historial completo con filtros por estado. Barra de progreso visual del pipeline. Botones de acción contextuales: ver detalle, pagar, confirmar llegada. Actualizaciones en tiempo real.

**Mis Pagos (`/portal/pagar`):** Pagos pendientes con botón "Pagar ahora" y enlace de Stripe. Historial de pagos completados con folio, monto, fecha y confirmación. Notificaciones vía WhatsApp al completar el pago.

**Mis Motos (`/portal/moto`):** CRUD completo para el registro de motos personales. Campos: marca, modelo, año, cilindrada, tipo, color, placa, VIN y fotos (opcionales). Los mecánicos consultan esta información antes del servicio.

**Perfil (`/portal/perfil`):** Edición de nombre, correo y teléfono. Información de cuenta (fecha de creación, último acceso). Botón de cierre de sesión.

---

### 5.3 App de Campo para Mecánicos (`/mecanico`)

Requiere autenticación (rol `mecanico`). Módulo en desarrollo activo.

Capacidades previstas: recibir y aceptar tickets asignados, actualizar estado del servicio, agregar diagnóstico y notas de trabajo, subir fotos antes/después, registrar refacciones utilizadas (con sincronización de inventario), consultar historial de ganancias.

---

### 5.4 CRM — Panel de Operaciones (`/crm/*`)

Requiere autenticación (rol `operador` o superior).

#### Dashboard (`/crm/dashboard`)
Métricas en tiempo real: tickets activos, ingresos del día y del mes, servicios completados hoy, calificación promedio, mecánicos disponibles, total de clientes y pagos pendientes. Mapa con GPS en vivo de mecánicos en tránsito (Firebase RTDB). Botones de acceso rápido: nuevo ticket, asignar mecánico, cobrar.

#### Tickets (`/crm/tickets`)
Lista maestra con filtros por estado, rango de fechas, cliente y mecánico. Búsqueda de texto completo. Panel lateral con: datos completos del ticket, asignación de mecánico (dropdown), edición de costos (estimado, anticipo, final), editor de diagnóstico, registro de refacciones usadas con sincronización de inventario, historial de estados con notas, enlaces de pago (anticipo y final), galería de fotos y calificación del cliente. Avance de estado con confirmación. Notificaciones automáticas vía WhatsApp al cambiar estado.

#### Clientes (`/crm/clientes`)
Base de datos de clientes con: nombre, teléfono, correo, tipo (individual/empresa), total de tickets, total pagado, lead score y fuente. Ordenable por valor, frecuencia y fecha. Acciones: ver historial, crear ticket directo, exportar.

#### Mecánicos (`/crm/mecanicos`)
Roster del equipo con indicadores de estado (disponible/en-servicio/descanso/inactivo). Asignación de zonas (multi-zona). Habilidades por tipo de servicio. Estadísticas de desempeño: servicios completados, calificación promedio, ganancias. Modal de edición para asignación y disponibilidad.

#### Pagos (`/crm/pagos`)
Lista de todos los pagos con filtros por estado y rango de fechas. Registro manual de pagos en efectivo. Estado de integración Stripe (session ID). Seguimiento de pagos parciales. Exportación para contabilidad.

#### Facturas (`/crm/facturas`)
Servicios completados y pagados con ID de factura (INV-YYYY-XXXXX). Filtros por período. Totales y KPIs. Generación de PDF con branding. Campo para URL de CFDI cuando aplica.

#### Reportes (`/crm/reportes`) — rol `manager` o superior
Selector de período (30/90/365 días). Gráficas: ingresos por mes (barras), tickets por estado (pastel), distribución por tipo de servicio, ranking de mecánicos (por tickets, ingresos y calificación). KPIs: ingresos totales, tasa de conversión, ticket promedio, calificación general. Exportación de datos en CSV.

#### Contact Center (`/crm/contact-center`)
Historial de llamadas entrantes y salientes. Integración Twilio para llamadas salientes. Logs con cliente, duración y resultado. Historial de conversaciones por SMS/WhatsApp. Recordatorios de seguimiento sugeridos.

#### Configuración (`/crm/configuracion`) — rol `manager` o superior
Edición en caliente (sin redespliegue) de: monto de anticipo, horarios de atención, zonas de cobertura, canales de notificación y asignación de roles a usuarios. Todos los cambios se guardan en `settings/platform` de Firestore.

---

## 6. API Routes (11 endpoints)

### Autenticación
- **POST/DELETE `/api/auth/session`** — Crea o elimina la cookie de sesión HttpOnly mediante Firebase Admin SDK. Cookie: `__session`, expiración 5 días, Secure + SameSite=Lax.

### Lógica de negocio
- **POST `/api/quotes`** — Crea leads y tickets (transacción atómica). Rate limit: 5 req/min por IP.
- **GET `/api/tracking/[ticketId]`** — Consulta pública de ticket. Retorna campos seguros. Rate limit: 30 req/min por IP.
- **POST `/api/chat`** — Chatbot Mistral AI. Mantiene contexto de 10 mensajes. Rate limit: 20 req/min por IP.

### Pagos
- **POST `/api/payments/create-link`** — Crea Stripe Checkout Session para anticipo o pago final. Retorna URL y sessionId. Rol requerido: operador.
- **POST `/api/payments/webhook`** — Webhook de Stripe. Verificación HMAC con `STRIPE_WEBHOOK_SECRET`. Procesa `checkout.session.completed` y `payment_intent.payment_failed`. Actualiza ticket y envía confirmación por WhatsApp.

### Notificaciones
- **POST `/api/notifications/push`** — Envía FCM push a uno o múltiples tokens. Rol: operador.
- **POST `/api/notifications/whatsapp`** — Envía WhatsApp vía Twilio. Rol: operador.

### Voz (Twilio)
- **POST `/api/voice/outbound`** — Inicia llamada saliente. Rol: operador.
- **POST `/api/voice/say`** — Responde TwiML para voz.
- **POST `/api/voice/status`** — Webhook de estado de llamadas (log de duración, resultado, errores).

---

## 7. Flujo de Pagos

### Anticipo (garantía de visita)
1. El operador hace clic en "Cobrar anticipo" → `/api/payments/create-link` con `type: "anticipo"`.
2. Se genera una Stripe Checkout Session. El enlace se envía automáticamente por WhatsApp al cliente.
3. El cliente paga → el webhook de Stripe actualiza el ticket (`anticipoPagado: true`).
4. El mecánico puede ser despachado. Si el cliente cancela, el anticipo no se reembolsa.

### Pago final del servicio
1. El operador registra el costo final → "Generar enlace de pago" → `type: "servicio"`.
2. El cliente recibe el enlace por WhatsApp y paga.
3. El webhook actualiza el ticket a estado `pagado`.
4. Soporta **pagos parciales**: si el monto pagado es menor al costo final, se registra como `parcial` en el historial. El ticket solo avanza a `pagado` cuando `totalPagado >= costoFinal`.

### Pagos en efectivo
El operador registra el monto en el CRM manualmente. La misma lógica de pagos parciales aplica. Sin interacción con Stripe.

---

## 8. Seguridad

### Headers HTTP
Configurados en `next.config.ts` para todas las respuestas:
- **Content-Security-Policy** — Lista blanca de scripts, estilos, fuentes, imágenes y frames.
- **X-Frame-Options: DENY** — Previene clickjacking.
- **X-Content-Type-Options: nosniff** — Previene MIME sniffing.
- **HSTS** — 2 años con subdomains y preload (solo producción).
- **Permissions-Policy** — Deniega cámara, ubicación y pagos del navegador (permite micrófono para Twilio).

### Sesiones y cookies
- Cookie HttpOnly creada por Firebase Admin SDK en el servidor (inmune a XSS).
- SameSite=Lax previene CSRF.
- Flag Secure en producción.
- Expiración de 5 días.

### Rate limiting
Ventana deslizante en memoria, por IP. Retorna HTTP 429 con `Retry-After` al exceder el límite.

### Validación de inputs
- Truncado a longitud máxima en todos los campos.
- Lista blanca de campos permitidos (sin `Object.assign` sobre el body completo).
- Validación de formato: teléfono (regex), correo (regex), año (rango 1900–actual+1).
- Sanitización server-side en todos los endpoints.

### Verificación de webhooks
- Stripe: verificación HMAC con `STRIPE_WEBHOOK_SECRET` sobre el body crudo (sin parsear).
- Twilio: preparado para verificación vía `X-Twilio-Signature`.
- Firma inválida o ausente retorna HTTP 400.

### Reglas de Firestore
Control de acceso basado en roles implementado directamente en las reglas de seguridad de Firestore:
- Clientes: solo leen sus propios tickets y motos.
- Mecánicos: leen solo los tickets que tienen asignados.
- Operadores (rol 3+): acceso completo a tickets, clientes y mecánicos.
- Administradores (rol 5): gestión de roles de usuarios.
- Lectura pública completamente prohibida (solo vía API con rate limiting).

---

## 9. Integraciones Externas

### Firebase
- **Auth:** Autenticación con Google y correo/contraseña.
- **Firestore:** Base de datos principal de todas las operaciones.
- **RTDB:** Coordenadas GPS de mecánicos en tiempo real (baja latencia).
- **FCM:** Push notifications para web y PWA.

### Stripe
- API Version: `2026-03-25.dahlia`
- Moneda: MXN (pesos mexicanos), convertidos a centavos (`monto × 100`).
- Modo: Payment (Checkout Sessions). Sin suscripciones aún.
- Metadata en cada sesión: `ticketId`, `clientPhone`, `type` (anticipo/parcial/servicio).

### Twilio
- WhatsApp como canal principal de notificaciones al cliente.
- SMS como canal de respaldo.
- Llamadas salientes desde el Contact Center con TwiML para mensajes de voz.
- Webhooks de estado de llamada para log de resultados.

### Mistral AI
- Modelo: `mistral-small-latest`.
- Solo invocado desde el servidor (API Route `/api/chat`).
- Prompt de sistema configurado con información real de SPM: servicios, precios, zonas, horarios, FAQs.

### Vercel
- Región: Washington D.C. (iad1).
- CI/CD automático: push a `master` → GitHub Actions (lint + typecheck + tests con umbral de cobertura 70%) → despliegue en Vercel (~45 segundos).
- Rollback instantáneo con `vercel rollback`.
- 23 variables de entorno encriptadas.

---

## 10. PWA y Capacidades Offline

**Web App Manifest (`public/manifest.json`):**
- Nombre: "SanPedroMotoCare — Mecánico a Domicilio"
- Display: `standalone` (sin UI del navegador)
- Color primario: `#DC2626` (rojo SPM)
- Fondo: `#0f172a` (azul marino oscuro)
- Íconos: 192×192 y 512×512 PNG
- Accesos directos: "Rastrear" (`/tracking`) y "Cotizar" (`/cotizar`)

**Banner de instalación:** Captura el evento `beforeinstallprompt`. Se muestra con 3 segundos de retraso. El rechazo se persiste en `localStorage` para no volver a mostrar. Compatible con Android Chrome, Edge y Samsung Internet.

**Service Worker (`firebase-messaging-sw.js`):** Maneja notificaciones push de FCM en segundo plano. Abre la app con payload de datos al hacer clic en la notificación.

---

## 11. Internacionalización

**Idiomas:** Español (es-MX) y English.

- Implementación: contexto React personalizado (`LanguageContext`), sin librerías externas.
- Persistencia: `localStorage.spm-lang`.
- Cobertura: 285+ elementos de UI traducidos (etiquetas, placeholders, mensajes de error, estados).
- Toggle: botón en la barra de navegación (ES ↔ EN).
- Chatbot: Mistral AI detecta el idioma del mensaje y responde en el mismo.
- Valor por defecto: español (es-MX) para el mercado mexicano.

---

## 12. Modo Oscuro

- **Defecto:** Modo oscuro activo por defecto.
- **Toggle:** Botón sol/luna en la barra de navegación.
- **Persistencia:** `localStorage.spm-theme`.
- **Anti-FOUC:** Script inline en `<head>` que aplica la clase `dark` antes de la hidratación de React, evitando el parpadeo blanco al cargar.
- **Colores:**
  - Fondo principal: `#0f172a` (oscuro) / `#ffffff` (claro)
  - Fondo secundario: `#1e293b` (oscuro) / `#f8fafc` (claro)
  - Texto: `#f1f5f9` (oscuro) / `#0f172a` (claro)

---

## 13. Testing e Infraestructura de Calidad

**Stack:** Vitest + happy-dom + @vitest/coverage-v8

**Comandos:**
```bash
npm test              # 110 tests (~5 segundos)
npm run test:watch    # Modo watch para desarrollo
npm run test:coverage # Reporte de cobertura con umbrales
```

**Cobertura actual (Mayo 2026):**
- Sentencias: 87.85% (umbral: 70%)
- Ramas: 73.09% (umbral: 70%)
- Funciones: 74.50% (umbral: 70%)
- Líneas: 89.86% (umbral: 70%)

**14 módulos de prueba cubren:**
- CRUD de Firestore (tickets, clientes, mecánicos, facturas)
- Endpoints API (auth, cotizaciones, rastreo, webhooks)
- Rate limiter (ventana deslizante, aislamiento por IP)
- Stripe (checkout sessions, verificación de firma HMAC)
- Notificaciones (plantillas de mensaje, payloads de push)
- Tipos y constantes

**Pipeline CI/CD (GitHub Actions):**
1. Lint y typecheck: `tsc --noEmit` + ESLint.
2. Tests y cobertura: `vitest run --coverage` con umbral del 70%.
3. Almacenamiento de artefactos: reporte de cobertura (retención 14 días).
4. Comentario automático en PRs con tabla de cobertura.
5. Despliegue en Vercel: automático tras pasar todos los checks.

---

## 14. Rendimiento

**Video hero comprimido:**
- Original: 14 MB
- Escritorio (1280×720 landscape): 35 KB (h264)
- Móvil (540×960 portrait): 447 KB (h264)
- Reducción total: 90% (492 KB vs 14 MB)
- Poster: JPG 5.5 KB para LCP optimizado
- Estrategia de precarga: `none` en móvil con delay de 600ms para no bloquear el hilo principal

**Imágenes:** Componente `<Image>` de Next.js con formatos AVIF + WebP automáticos, lazy loading fuera del viewport.

**Escalabilidad serverless:** Las API Routes escalan de 0 a miles de instancias bajo demanda. Firestore y RTDB escalan automáticamente con el volumen de datos. El rate limiter en memoria está documentado para migración a Redis/Upstash en escenarios multi-instancia.

---

## 15. Variables de Entorno (23 en producción)

| Grupo | Variables | Descripción |
|---|---|---|
| Firebase (públicas) | 9 vars (`NEXT_PUBLIC_FIREBASE_*`) | SDK del cliente y FCM |
| Firebase (secretas) | 1 var (`FIREBASE_SERVICE_ACCOUNT_KEY`) | Admin SDK (JSON del service account) |
| Stripe | 3 vars | Publishable key, secret key, webhook secret |
| Twilio | 4 vars | Account SID, auth token, número WhatsApp, número SMS |
| Mistral AI | 1 var | API key |
| App | 2 vars | URL pública, secreto interno de webhooks |
| Sistema | 1 var | `NODE_ENV` |

Todas las variables secretas están encriptadas en Vercel y nunca se incluyen en el repositorio.

---

## 16. Estructura del Repositorio

```
spm-platform/
├── app/                        Next.js App Router (18+ rutas)
│   ├── (public)/               Landing, tracking, tienda, cotización
│   ├── (auth)/                 Flujo de login
│   ├── (portal)/               Portal del cliente (4 módulos)
│   ├── (field)/                App de mecánicos (en desarrollo)
│   ├── (crm)/                  8 módulos de operaciones
│   ├── api/                    11 API endpoints
│   ├── layout.tsx              Layout raíz + providers + script anti-FOUC
│   ├── globals.css             Configuración @theme de Tailwind
│   └── proxy.ts                Middleware de protección de rutas
│
├── components/                 Componentes React
│   ├── landing/                Hero, navbar, footer, widget de rastreo, chatbot
│   ├── crm/                    Shell del CRM, paneles de detalle
│   ├── portal/                 Lista de servicios, formulario de pago
│   └── ui/                     Componentes reutilizables genéricos
│
├── contexts/                   Providers de contexto React
│   ├── AuthContext.tsx          Firebase Auth + RBAC
│   ├── ThemeContext.tsx         Toggle oscuro/claro
│   └── LanguageContext.tsx      Selector ES/EN
│
├── lib/                        Utilidades y helpers
│   ├── firebase.ts             SDK del cliente (singleton)
│   ├── firebase-admin.ts       SDK Admin (inicialización lazy)
│   ├── rate-limit.ts           Rate limiter de ventana deslizante
│   ├── firestore/              CRUD helpers por colección
│   ├── payments/               Cliente de Stripe
│   └── notifications/          Helpers de WhatsApp, push y voz
│
├── types/
│   └── index.ts                Interfaces TypeScript + constantes
│
├── public/                     Assets estáticos
│   ├── videos/                 Video hero (escritorio, móvil, poster)
│   ├── icons/                  Íconos PWA
│   ├── images/                 Marca SPM
│   └── manifest.json           Manifest PWA
│
├── tests/                      Suite Vitest (14 archivos, 110 tests)
│
├── proxy.ts                    Middleware Next.js 16
├── next.config.ts              Headers CSP + seguridad
├── firestore.rules             Control de acceso Firestore
├── firestore.indexes.json      Índices de consultas
└── package.json                Dependencias + scripts
```

---

## 17. Estado de los Módulos

| Módulo | Estado | Notas |
|---|---|---|
| Sistema de cotización / leads | Producción | ID SPM-XXXX, transacción atómica |
| Rastreo en tiempo real | Producción | GPS vía Firebase RTDB |
| Pipeline de servicio (7 estados) | Producción | Auditoría completa |
| Portal del cliente | Producción | 4 módulos funcionales |
| CRM de operaciones | Producción | 8 módulos funcionales |
| App de mecánicos (campo) | En desarrollo | Estructura de rutas lista |
| Pagos con Stripe | Producción | MXN, anticipo + final, pagos parciales |
| Notificaciones multicanal | Producción | WhatsApp, SMS, FCM push, voz |
| Chatbot IA (Mistral) | Producción | Bilingüe, consciente del contexto SPM |
| Inventario y catálogo | Producción | Productos, categorías, stock, movimientos |
| Órdenes de compra a proveedores | Producción | Pipeline de recepciones parciales |
| Tienda en línea | Producción | Checkout, métodos de entrega |
| Facturación | Producción | INV-YYYY-XXXXX, generación de PDF |
| Reportes y analítica | Producción | Gráficas, KPIs, exportación CSV |
| Contact Center (Twilio) | Producción | Llamadas, historial, seguimientos |
| PWA instalable | Producción | Standalone, accesos directos |
| UI bilingüe (ES/EN) | Producción | 285+ elementos traducidos |
| Modo oscuro | Producción | Por defecto, anti-FOUC |
| Suite de tests | Producción | 110 tests, 87% cobertura |

---

## 18. Roadmap v2

- CAPTCHA en el formulario de cotización (hCaptcha / Turnstile)
- Firebase App Check para verificación de dispositivos
- Rate limiting distribuido con Redis/Upstash para escenarios multi-región
- Campañas de notificaciones push (recordatorios de mantenimiento, reactivación de clientes)
- Programa de referidos con rastreo
- Expansión multi-ciudad mediante configuración de zonas
- Transición de Stripe a modo LIVE (actualmente en modo test)
- Refinamiento completo de la app de mecánicos en campo

---

*Documento generado el 4 de mayo de 2026. Refleja el estado de la plataforma en la versión 1.3.0.*
