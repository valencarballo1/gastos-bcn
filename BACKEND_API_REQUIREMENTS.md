# Casa Clara — requisitos de API para revisar el backend

> Documento para entregar al equipo de backend. Describe el contrato que el
> frontend React/Next.js usa actualmente, lo que ya tiene preparado para una
> segunda etapa y una checklist para indicar qué está implementado, qué falta y
> qué debería corregirse.
>
> Verificado contra el frontend el 3 de agosto de 2026.

## 1. Resumen ejecutivo

Casa Clara es una aplicación multiusuario y multihogar para gestionar:

- inicio de sesión con Google;
- hogares, integrantes, roles e invitaciones;
- categorías;
- gastos y repartos;
- balances y liquidaciones entre integrantes;
- gastos recurrentes;
- tareas y checklist;
- listas de compra y productos de esas listas;
- actividad, dashboard, calendario y reportes.

El frontend **ya usa la API**. No trabaja con datos de negocio de demostración
ni guarda esos datos en `localStorage`. La única preferencia persistida allí es
el ID del último hogar seleccionado.

Fuentes del contrato en el repositorio:

- cliente HTTP: `src/services/api.ts`;
- rutas y payloads: `src/services/householdApi.ts`;
- modelos esperados: `src/types/index.ts`;
- carga e invalidación de datos: `src/hooks/useHousehold.ts`;
- diseño SQL y reglas ampliadas: `BACKEND_IMPLEMENTATION.md` y
  `database_schema.sql`;
- DTOs C# de referencia: `DTOs.cs`.

Este documento manda sobre esas referencias cuando se trate del contrato HTTP
que consume el frontend actual.

## 2. Contrato transversal obligatorio

### 2.1 URL y variables públicas

El frontend forma todas las rutas a partir de:

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api
NEXT_PUBLIC_SITE_URL=https://app.example.com
NEXT_PUBLIC_AUTH_ENABLED=true
```

Reglas:

- `NEXT_PUBLIC_API_URL` debe incluir `/api` y no terminar en `/`.
- `NEXT_PUBLIC_SITE_URL` debe ser el origen público exacto del frontend.
- Ningún secreto de Google, correo, base de datos o firma de sesión puede estar
  en una variable `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_AUTH_ENABLED` existe en la configuración, pero el código actual
  no lo usa para desactivar la autenticación: el login es obligatorio.

### 2.2 HTTP y JSON

- Todas las peticiones usan `credentials: "include"`.
- El JSON debe usar `camelCase`.
- Para altas y modificaciones, responder preferentemente con el recurso
  actualizado.
- Se acepta una respuesta directa o, por compatibilidad, un contenedor
  `{ "result": ... }` o `{ "Result": ... }`.
- Para listas se recomienda devolver un array directo. También se aceptan
  contenedores con un array en `items`, `data`, `results`, `events`, `activity`
  o `activities`, con la primera letra en mayúscula cuando corresponda.
- Un `204 No Content` es válido para operaciones sin respuesta.
- Los IDs pueden ser números o strings en la respuesta; el frontend los
  normaliza a string. Al enviar un ID formado solo por dígitos, el cliente lo
  convierte a número. El backend debe mantener un tipo de ID coherente.
- Importes: decimal de dos posiciones en backend y JSON number en la API.
- Fechas: ISO 8601. Los instantes deben incluir zona (`Z` u offset). Las fechas
  de negocio sin hora pueden usar `YYYY-MM-DD` cuando el endpoint lo especifique.
- Moneda actual: únicamente `EUR`.

### 2.3 CSRF obligatorio

Como la sesión usa cookie, toda escritura necesita protección CSRF.

```http
GET /api/auth/csrf
```

Respuesta esperada:

```json
{
  "token": "token-opaco",
  "headerName": "X-CSRF-TOKEN"
}
```

Antes del primer `POST`, `PUT`, `PATCH` o `DELETE`, el frontend obtiene ese
token y manda la cabecera indicada por `headerName`. Conserva el token durante
la sesión. Si recibe un `400` cuyo código o mensaje menciona `csrf`, `xsrf`,
`antiforgery` o `anti-forgery`, obtiene uno nuevo y reintenta una sola vez.

Requisitos del backend:

- emitir el token ligado a la sesión actual;
- validar la cabecera en todas las escrituras, incluido logout;
- no exigir CSRF a lecturas `GET`;
- devolver un error JSON reconocible cuando falle la validación;
- rotar o invalidar el token cuando cambia o termina la sesión.

### 2.4 Errores

Formato canónico:

```json
{
  "error": true,
  "code": "EXPENSE_SPLIT_MISMATCH",
  "message": "La suma del reparto debe coincidir con el importe del gasto.",
  "fieldErrors": {
    "participants": ["La suma actual es 99,99 €."]
  },
  "traceId": "00-..."
}
```

También se admiten temporalmente las claves con inicial mayúscula. Estados que
interpreta el frontend:

| Estado | Significado esperado |
|---|---|
| `400` | JSON, parámetros o CSRF inválidos |
| `401` | No hay sesión válida; el frontend vuelve al login |
| `403` | El usuario no tiene acceso o rol suficiente |
| `404` | El recurso no existe dentro del hogar solicitado |
| `409` | Conflicto, duplicado, reparto incorrecto o `rowVersion` vencido |
| `422` | La transición no está permitida por el estado actual |
| `5xx` | Error del servidor; incluir `traceId` para soporte |

No devolver HTML para errores de API.

## 3. Inicio de sesión con Google y sesión

### 3.1 Endpoints

| Prioridad | Método | Ruta | Autenticación | Uso |
|---|---|---|---|---|
| P0 | `GET` | `/api/auth/google/login?returnUrl=/ruta` | No | Inicia Google OAuth mediante redirección |
| P0 | `GET` | `/api/auth/google/callback` | No | Callback registrado en Google |
| P0 | `GET` | `/api/auth/me` | Sí | Restaura la sesión y devuelve el usuario |
| P0 | `GET` | `/api/auth/csrf` | Según sesión | Emite token CSRF |
| P0 | `POST` | `/api/auth/logout` | Sí + CSRF | Cierra la sesión e invalida la cookie |

### 3.2 Flujo esperado

1. Al abrir la app, el frontend llama a `GET /api/auth/me` sin usar caché.
2. Un `401` indica que debe mostrar la pantalla de acceso.
3. Al pulsar “Continuar con Google”, el navegador navega a
   `/api/auth/google/login?returnUrl=...`.
4. El backend crea y valida `state`, `nonce` y PKCE cuando corresponda, y
   redirige a Google.
5. En el callback valida el proveedor, exige correo verificado, crea o actualiza
   el usuario por el `sub` estable de Google y crea una sesión propia.
6. El backend redirige al frontend usando únicamente un `returnUrl` relativo,
   con `/` inicial y sin `//`. Debe evitar redirecciones abiertas.
7. Al volver de OAuth, el frontend reintenta `/auth/me` a los 0, 250, 750 y
   1500 ms si todavía recibe `401`. La sesión debería estar disponible en el
   primer intento; los reintentos solo toleran propagación distribuida breve.
8. `POST /auth/logout` invalida la sesión en servidor y elimina la cookie.

El `returnUrl` puede apuntar a una vista de hogar o a una invitación, por
ejemplo `/h/12/dashboard` o `/invite/token-opaco`.

### 3.3 Usuario esperado en `/auth/me`

```json
{
  "id": 18,
  "name": "Valentín",
  "email": "valentin@example.com",
  "avatarUrl": "https://...",
  "initials": "VC",
  "color": "#4F7C65",
  "provider": "google"
}
```

`initials` y `color` tienen fallback en el frontend, pero es preferible que el
backend los devuelva. `provider` debe ser `google`.

### 3.4 Cookie y CORS

La cookie de sesión debe ser propia del backend, opaca y configurada como:

- `HttpOnly`;
- `Secure`;
- `Path=/`;
- expiración y renovación controladas por servidor;
- `SameSite=Lax` si frontend y API son realmente same-site;
- `SameSite=None; Secure` si están en sitios distintos y la cookie debe viajar
  en `fetch` cross-site.

Si frontend y API tienen orígenes distintos:

- permitir solo los orígenes reales del frontend, nunca `*`;
- enviar `Access-Control-Allow-Credentials: true`;
- permitir `Content-Type` y el nombre de cabecera CSRF devuelto por la API;
- permitir los métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS`;
- responder correctamente al preflight `OPTIONS`;
- no cachear una respuesta CORS para un origen incorrecto; usar `Vary: Origin`
  cuando proceda.

## 4. Carga inicial que ejecuta la app

Después de autenticar:

```text
GET /api/hogares
```

Al seleccionar un hogar, la app ejecuta en paralelo:

```text
GET /api/hogares/{hogarId}
GET /api/hogares/{hogarId}/dashboard
GET /api/hogares/{hogarId}/integrantes
GET /api/hogares/{hogarId}/categorias
GET /api/hogares/{hogarId}/gastos?pagina=1&tamanio=200
GET /api/hogares/{hogarId}/gastos-recurrentes
GET /api/hogares/{hogarId}/liquidaciones?pagina=1&tamanio=200
GET /api/hogares/{hogarId}/tareas?pagina=1&tamanio=200
GET /api/hogares/{hogarId}/listas-compra
GET /api/hogares/{hogarId}/actividad?pagina=1&tamanio=100
GET /api/hogares/{hogarId}/balances
GET /api/hogares/{hogarId}/invitaciones
```

El detalle de hogar es bloqueante. Si falla cualquier otra lectura, la app
puede abrir con datos parciales, pero muestra un aviso. Por tanto, para dar por
completa la integración deben funcionar todas.

Después de una mutación, el frontend vuelve a consultar esos bloques. Los
endpoints deben tolerar recargas frecuentes y conviene que las lecturas sean
eficientes.

## 5. Inventario de endpoints

Leyenda:

- **P0 actual**: el frontend lo llama hoy desde un flujo visible.
- **P1 preparado**: existe en el cliente HTTP, pero la interfaz actual no lo
  necesita siempre. Debe revisarse para completar la API prevista.
- **Futuro**: aparece en el diseño funcional, pero el cliente todavía no lo
  consume y su ausencia no bloquea la app actual.

### 5.1 Hogares

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares` | Hogares accesibles del usuario |
| P0 actual | `POST` | `/api/hogares` | `{ name, currency: "EUR", timezone }` |
| P0 actual | `GET` | `/api/hogares/{hogarId}` | Detalle |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}` | `{ name, currency, timezone, rowVersion? }` |

Resumen de lista:

```json
{
  "id": 12,
  "name": "Piso Barcelona",
  "memberCount": 3
}
```

Detalle:

```json
{
  "id": 12,
  "name": "Piso Barcelona",
  "currency": "EUR",
  "timezone": "Europe/Madrid",
  "createdByUserId": 18,
  "rowVersion": "AAAAAAAAB9E="
}
```

Al crear un hogar, el backend debe crear en una transacción la membresía
`owner`, categorías iniciales y una lista de compra abierta.

### 5.2 Integrantes e invitaciones

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/integrantes` | Lista de integrantes |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}/integrantes/{id}/estado` | `{ active, rowVersion? }` |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/integrantes/{id}` | Detalle |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/integrantes` | `{ name, email?, initials, color }` |
| P1 preparado | `PUT` | `/api/hogares/{hogarId}/integrantes/{id}` | Edición + `rowVersion?` |
| P0 actual | `GET` | `/api/hogares/{hogarId}/invitaciones` | Invitaciones pendientes/recientes |
| P0 actual | `POST` | `/api/hogares/{hogarId}/invitaciones` | `{ email?, mode, role }` |
| P0 actual | `DELETE` | `/api/hogares/{hogarId}/invitaciones/{id}` | Revocar |
| P0 actual | `GET` | `/api/invitaciones/{token}` | Vista pública mínima, sin login |
| P0 actual | `POST` | `/api/invitaciones/{token}/aceptar` | Aceptar con sesión + CSRF |

Integrante esperado:

```json
{
  "id": 4,
  "householdId": 12,
  "userId": 18,
  "name": "Valentín",
  "initials": "VC",
  "email": "valentin@example.com",
  "color": "#4F7C65",
  "role": "owner",
  "active": true,
  "joinedAt": "2026-08-03T09:00:00Z",
  "rowVersion": "AAAAAAAAB9E="
}
```

Enums:

- `role`: `owner | admin | member`;
- `mode`: `email | link`;
- estado de invitación: `pending | accepted | expired | revoked`.

Creación de invitación:

```json
{
  "mode": "email",
  "email": "persona@example.com",
  "role": "member"
}
```

La respuesta debe incluir al menos `id`, `householdId`, `mode`, `role`,
`status`, `createdAt`, `expiresAt` y **`token` o `inviteUrl`**. El frontend crea
el enlace `/invite/{token}` si recibe el token; también puede extraerlo de
`inviteUrl`.

La lectura pública devuelve únicamente:

```json
{
  "householdName": "Piso Barcelona",
  "invitedByName": "Valentín",
  "email": "persona@example.com",
  "expiresAt": "2026-08-10T09:00:00Z",
  "requiresLogin": true
}
```

Al aceptar, devolver el hogar o el integrante creado. Las invitaciones por
email solo pueden aceptarse desde una cuenta Google con ese email verificado.

### 5.3 Categorías

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/categorias?tipo=expense` | `tipo` puede omitirse |
| P0 actual | `POST` | `/api/hogares/{hogarId}/categorias` | `{ name, color, type }` |
| P0 actual | `DELETE` | `/api/hogares/{hogarId}/categorias/{id}` | Desactivar; se acepta `204` |
| P1 preparado | `PUT` | `/api/hogares/{hogarId}/categorias/{id}` | Edición + `rowVersion?` |

```json
{
  "id": 3,
  "name": "Supermercado",
  "color": "#4F7C65",
  "type": "expense",
  "rowVersion": "AAAAAAAAB9E="
}
```

`type`: `expense | task | shopping`. No eliminar físicamente una categoría que
ya tenga referencias; desactivarla y excluirla de los listados de alta.

### 5.4 Gastos

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/gastos` | Acepta `pagina`, `tamanio` y filtros |
| P0 actual | `POST` | `/api/hogares/{hogarId}/gastos` | Crea gasto con participantes |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/gastos/{id}` | Detalle |
| P1 preparado | `PUT` | `/api/hogares/{hogarId}/gastos/{id}` | Reemplazo + `rowVersion` |
| P1 preparado | `DELETE` | `/api/hogares/{hogarId}/gastos/{id}` | `{ rowVersion? }`; cancelar, no borrar |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/gastos/lote` | Array de altas |

Payload que envía el alta actual:

```json
{
  "description": "Compra semanal",
  "categoryId": 3,
  "amount": 100.00,
  "currency": "EUR",
  "paidByMemberId": 4,
  "date": "2026-08-03T10:00:00Z",
  "splitType": "equal",
  "status": "paid",
  "participants": [
    { "memberId": 4, "amount": 50.00 },
    { "memberId": 5, "amount": 50.00 }
  ]
}
```

Respuesta esperada: el mismo modelo más `id`, `householdId`, `createdAt`,
`notes?`, `recurringExpenseId?` y `rowVersion`.

Enums:

- `splitType`: `equal | fixed | responsible`;
- `status`: `pending | paid | cancelled`.

Reglas obligatorias:

- importe mayor que cero;
- categoría, pagador y participantes pertenecen al hogar;
- solo integrantes activos pueden usarse en nuevas operaciones;
- al menos un participante;
- en `fixed`, la suma debe coincidir exactamente con el total;
- en `equal`, el backend debe garantizar que los céntimos sumen el total;
- `responsible` asigna el total al pagador;
- gasto y participantes se guardan en una transacción;
- solo `paid` afecta balances;
- cancelar un gasto lo excluye sin perder auditoría.

### 5.5 Balances y liquidaciones

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/balances?desde=&hasta=` | Resumen y transferencias sugeridas |
| P0 actual | `GET` | `/api/hogares/{hogarId}/liquidaciones?pagina=1&tamanio=200` | Historial |
| P0 actual | `POST` | `/api/hogares/{hogarId}/liquidaciones` | Registrar pago |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/liquidaciones/{id}/revertir` | `{ reason, rowVersion? }` |

Balances:

```json
{
  "members": [
    {
      "memberId": 4,
      "paid": 900.00,
      "owed": 650.00,
      "settlementsSent": 0.00,
      "settlementsReceived": 0.00,
      "balance": 250.00
    }
  ],
  "suggestedTransfers": [
    { "fromMemberId": 5, "toMemberId": 4, "amount": 250.00 }
  ]
}
```

Un balance positivo significa que el integrante debe recibir dinero.

Alta de liquidación:

```json
{
  "fromMemberId": 5,
  "toMemberId": 4,
  "amount": 125.00,
  "date": "2026-08-03T18:00:00Z",
  "method": "Bizum",
  "concept": "Liquidación de saldo"
}
```

`method`: `Bizum | Transferencia | Efectivo | PayPal | Revolut | Otro`.
La respuesta suma `id`, `householdId`, `status: "active"`, `notes?` y
`rowVersion`. Una liquidación se revierte; no se elimina.

### 5.6 Gastos recurrentes

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/gastos-recurrentes` | Lista |
| P0 actual | `POST` | `/api/hogares/{hogarId}/gastos-recurrentes` | Alta |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}/estado` | `{ status, rowVersion? }` |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}` | Detalle |
| P1 preparado | `PUT` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}` | Edición |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias` | Filtros opcionales |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias/{id}/registrar-pago` | Convierte ocurrencia en gasto |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias/{id}/cancelar` | `{ reason }` |

Alta que envía hoy el frontend:

```json
{
  "name": "Seguro del hogar",
  "categoryId": 3,
  "estimatedAmount": 67.45,
  "variableAmount": false,
  "frequency": "monthly",
  "frequencyInterval": 1,
  "dueDay": 12,
  "paidByMemberId": 4,
  "splitType": "equal",
  "startDate": "2026-08-03",
  "reminderDays": 3,
  "participants": [
    { "memberId": 4 },
    { "memberId": 5 }
  ]
}
```

El backend debe asignar `status: "active"` y calcular `nextDueDate`; esos dos
campos no se envían en el alta actual. Si `variableAmount` es `false`,
`estimatedAmount` debe ser mayor que cero. La UI actual limita `dueDay` a 1–28.

Frecuencias admitidas por el modelo:

```text
weekly | monthly | bimonthly | quarterly | semiannual | annual
```

La respuesta incluye además `id`, `householdId`, `participantIds`, `status`,
`nextDueDate`, `endDate?` y `rowVersion`.

La generación de ocurrencias debe ser idempotente. Editar una recurrencia no
debe modificar la fotografía de ocurrencias ya creadas.

### 5.7 Tareas y checklist

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/tareas?pagina=1&tamanio=200` | Lista |
| P0 actual | `POST` | `/api/hogares/{hogarId}/tareas` | Alta |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}/tareas/{id}/estado` | `{ status, completedAt?, rowVersion? }` |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}/tareas/{id}/checklist/{itemId}` | `{ text?, order?, completed? }` |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/tareas/{id}` | Detalle |
| P1 preparado | `PUT` | `/api/hogares/{hogarId}/tareas/{id}` | Edición |
| P1 preparado | `DELETE` | `/api/hogares/{hogarId}/tareas/{id}` | `{ rowVersion? }` |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/tareas/{id}/checklist` | `{ text, order }` |
| P1 preparado | `DELETE` | `/api/hogares/{hogarId}/tareas/{id}/checklist/{itemId}` | Borrar ítem |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/tareas/{id}/comentarios` | Lista |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/tareas/{id}/comentarios` | `{ comment }` |

Alta actual:

```json
{
  "title": "Cambiar las sábanas",
  "categoryId": 8,
  "assignedToMemberId": 4,
  "priority": "medium",
  "dueDate": "2026-08-04T16:00:00Z",
  "checklist": []
}
```

El backend debe asignar `status: "pending"`; el adaptador actual no envía ese
campo. La respuesta esperada incluye:

```json
{
  "id": 30,
  "householdId": 12,
  "title": "Cambiar las sábanas",
  "description": null,
  "category": "Limpieza",
  "categoryId": 8,
  "assignedToMemberId": 4,
  "priority": "medium",
  "status": "pending",
  "dueDate": "2026-08-04T16:00:00Z",
  "evidenceUrl": null,
  "checklist": [],
  "createdAt": "2026-08-03T09:00:00Z",
  "rowVersion": "AAAAAAAAB9E="
}
```

Enums:

- prioridad: `low | medium | high | urgent`;
- estado: `pending | in_progress | completed | cancelled`.

Cada checklist item tiene `id`, `text`, `completed`, `order?` y
`rowVersion?`.

La pantalla tiene un selector de recurrencia, pero el adaptador HTTP actual no
envía `recurrence`. Las tareas recurrentes son **futuro** hasta definir y
conectar ese contrato; no deben marcarse como completadas solo porque existan
rutas de diseño en `BACKEND_IMPLEMENTATION.md`.

### 5.8 Listas de compra y productos

En la app actual, “crear producto” significa crear un **ítem dentro de una
lista de compra**. No existe todavía un catálogo general CRUD de productos.

| Prioridad | Método | Ruta | Uso/cuerpo |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/listas-compra` | Listas abiertas e históricas |
| P0 actual | `POST` | `/api/hogares/{hogarId}/listas-compra` | `{ name, weekStart }`; se usa si no hay lista abierta |
| P0 actual | `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items` | Crear producto de la lista |
| P0 actual | `PATCH` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items/{itemId}` | Editar o marcar comprado |
| P0 actual | `DELETE` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items/{itemId}` | `{ rowVersion? }` |
| P0 actual | `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/finalizar-compra` | Crear el gasto de la compra |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/listas-compra/{listaId}` | Detalle |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/duplicar` | Duplicar |
| P1 preparado | `DELETE` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items-comprados` | Limpiar comprados |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/productos/frecuentes` | Sugerencias |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/productos-favoritos` | Favoritos |
| P1 preparado | `POST` | `/api/hogares/{hogarId}/productos-favoritos` | Crear favorito |

Lista esperada:

```json
{
  "id": 7,
  "householdId": 12,
  "name": "Lista de compra",
  "weekOf": "2026-08-03",
  "weekStart": "2026-08-03",
  "status": "open",
  "items": [],
  "rowVersion": "AAAAAAAAB9E="
}
```

`status`: `open | closed`. Debe haber como máximo una lista abierta que el
backend considere actual, o devolverla primero. El frontend ordena las abiertas
antes que las cerradas y nunca añade productos a una lista cerrada.

Alta de producto:

```json
{
  "name": "Café",
  "quantity": 1,
  "unit": "u",
  "categoryId": 11,
  "addedByMemberId": 4,
  "priority": "normal",
  "estimatedPrice": 4.95
}
```

Respuesta del ítem: el mismo objeto más `id`, `category` o `categoryName`,
`purchased`, `actualPrice?`, `expenseId?`, `createdAt` y `rowVersion`.

`priority`: `normal | high`. Unidades que ofrece la UI:
`u | kg | g | l | ml | paq.`.

Marcar comprado usa, como mínimo:

```json
{
  "purchased": true,
  "rowVersion": "AAAAAAAAB9E="
}
```

Finalizar compra:

```json
{
  "itemIds": [101, 102],
  "totalAmount": 43.80,
  "paidByMemberId": 4,
  "splitType": "equal",
  "participants": [
    { "memberId": 4 },
    { "memberId": 5 }
  ],
  "date": "2026-08-03T18:00:00Z"
}
```

Respuesta:

```json
{
  "shoppingListId": 7,
  "processedItemIds": [101, 102],
  "expense": {
    "id": 58,
    "householdId": 12,
    "description": "Compra semanal",
    "amount": 43.80,
    "status": "paid"
  }
}
```

La operación debe ser transaccional e idempotente: validar que los ítems están
comprados, pertenecen a la lista y todavía no tienen `expenseId`; crear gasto y
participantes; enlazar los ítems al gasto; cerrar o actualizar la lista; crear
actividad. Un segundo intento no puede crear otro gasto.

### 5.9 Actividad y vistas agregadas

| Prioridad | Método | Ruta | Estado de uso |
|---|---|---|---|
| P0 actual | `GET` | `/api/hogares/{hogarId}/actividad?pagina=1&tamanio=100` | La pantalla usa la lista |
| P0 actual | `GET` | `/api/hogares/{hogarId}/dashboard` | Se solicita al cargar; el dashboard visual aún deriva datos locales |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/calendario?desde=&hasta=` | Cliente preparado; UI actual deriva eventos locales |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/reportes/gastos?desde=&hasta=` | Cliente preparado; UI actual calcula localmente |
| P1 preparado | `GET` | `/api/hogares/{hogarId}/reportes/tareas?desde=&hasta=` | Cliente preparado; UI actual calcula localmente |

Actividad mínima:

```json
{
  "id": 90,
  "householdId": 12,
  "memberId": 4,
  "entityType": "expense",
  "action": "created",
  "description": "Valentín añadió Compra semanal",
  "date": "2026-08-03T09:00:00Z"
}
```

`entityType`: `expense | settlement | task | shopping | recurring | member`.
Toda escritura relevante debe generar actividad en la misma transacción que el
cambio principal.

La forma recomendada de `dashboard` está documentada en
`BACKEND_IMPLEMENTATION.md`. Como su respuesta todavía no se renderiza, puede
evolucionar sin bloquear las pantallas, pero el endpoint debe responder sin
error para evitar el aviso de carga parcial.

## 6. Seguridad, permisos y aislamiento por hogar

Google prueba la identidad. La base de datos de Casa Clara decide a qué hogares
puede acceder esa identidad.

En cada ruta con `{hogarId}` el backend debe:

1. obtener el usuario desde la sesión, nunca desde un `userId` enviado;
2. comprobar una membresía activa para ese usuario y hogar;
3. devolver `403` si no pertenece al hogar;
4. comprobar que todos los IDs anidados pertenecen al mismo hogar;
5. impedir referencias a integrantes inactivos en nuevas operaciones;
6. no filtrar datos de otro hogar por errores de consulta o IDs adivinables.

Permisos mínimos:

| Acción | `owner` | `admin` | `member` |
|---|---:|---:|---:|
| Ver datos del hogar | Sí | Sí | Sí |
| Crear gastos, tareas, compras y liquidaciones | Sí | Sí | Sí |
| Editar hogar y categorías | Sí | Sí | No |
| Crear/revocar invitaciones | Sí | Sí | No |
| Activar/desactivar integrantes | Sí | Sí, salvo owner | No |
| Transferir propiedad o eliminar hogar | Sí | No | No |

El frontend oculta administración a `member`, pero el backend debe volver a
validarlo; nunca confiar en la interfaz.

Los tokens de invitación deben ser aleatorios, no predecibles, almacenarse de
forma segura, caducar y ser de un solo uso. La lectura pública no puede revelar
integrantes, IDs internos ni información financiera.

## 7. Concurrencia, transacciones y reglas de datos

- Entidades mutables devuelven `rowVersion` opaco.
- Actualizaciones que reciben `rowVersion` deben compararlo y devolver `409` si
  quedó vencido.
- Tras modificar, devolver el `rowVersion` nuevo.
- Importes en SQL: `DECIMAL(18,2)`; en C#: `decimal`, nunca `double`.
- No guardar un “saldo actual” editable. Calcular balances desde gastos,
  participantes y liquidaciones activas.
- Crear gasto + participantes + actividad en una transacción.
- Crear/revertir liquidación + actividad en una transacción.
- Finalizar compra + gasto + participantes + enlaces + actividad en una
  transacción.
- Aceptar invitación + membresía + estado de invitación + actividad en una
  transacción.
- Los procesos de recurrencia y finalización deben ser idempotentes.
- Registros financieros se cancelan o revierten; no se borran físicamente.
- Usar la zona horaria IANA del hogar para vencimientos y guardar instantes en
  UTC.

## 8. Diferencias y mejoras detectadas al revisar el frontend

Estas observaciones deben tenerse en cuenta al auditar el backend:

1. `BACKEND_IMPLEMENTATION.md` dice en una introducción antigua que el
   frontend usa datos de demostración y que falta sustituir `useHousehold`.
   Ya no es cierto: `useHousehold` consume `householdApi`.
2. El endpoint `/api/auth/csrf` es obligatorio para el código actual y debe
   incluirse aunque una documentación anterior no lo liste.
3. El alta de gasto recurrente no envía `status` ni `nextDueDate`; el backend
   debe asignar `active` y calcular la próxima fecha.
4. El alta de tarea no envía `status`; el backend debe asignar `pending`.
5. La UI recoge una recurrencia de tarea, pero `taskRequest` no la envía. Esa
   función no está integrada de extremo a extremo todavía.
6. El hook pasa `rowVersion` al actualizar checklist, pero el adaptador actual
   no lo incluye en el JSON. La concurrencia de checklist requiere ajustar el
   frontend antes de poder exigirla en ese endpoint.
7. `GET /dashboard` se solicita, pero la pantalla calcula sus tarjetas desde
   los listados. Calendario y reportes también se calculan localmente y todavía
   no llaman sus endpoints preparados.
8. La configuración de producción actual define la API, pero no
   `NEXT_PUBLIC_SITE_URL`. Debe añadirse para metadatos e invitaciones
   consistentes en producción.
9. La app no tiene un catálogo CRUD genérico de productos. Tiene ítems de lista
   y clientes preparados para productos frecuentes/favoritos.
10. Las listas iniciales solicitan hasta 200 gastos, liquidaciones y tareas. Si
    hay más, el frontend actual no recorre páginas adicionales; conviene
    implementar paginación futura o un contrato de cursor.

## 9. Checklist para que complete el equipo de backend

Usar `✅` implementado, `🟡` parcial/mejorable o `❌` faltante, y añadir la
evidencia o diferencia real.

### P0 — bloquea el funcionamiento actual

| Estado | Requisito | Evidencia/observaciones |
|---|---|---|
| ⬜ | `NEXT_PUBLIC_API_URL` apunta a la API correcta con `/api` | |
| ⬜ | CORS acepta el origen exacto y credenciales | |
| ⬜ | Cookie HttpOnly/Secure/SameSite adecuada a los dominios | |
| ⬜ | `GET /auth/csrf` y validación en todas las escrituras | |
| ⬜ | Google login, callback, sesión, `/auth/me` y logout | |
| ⬜ | `returnUrl` relativo validado, incluida ruta de invitación | |
| ⬜ | Hogares: listar, crear, leer y actualizar | |
| ⬜ | Integrantes: listar y cambiar estado | |
| ⬜ | Invitaciones: listar, crear, revocar, leer pública y aceptar | |
| ⬜ | Categorías: listar, crear y desactivar | |
| ⬜ | Gastos: listar y crear con reparto correcto | |
| ⬜ | Balances correctos y transferencias sugeridas | |
| ⬜ | Liquidaciones: listar y crear | |
| ⬜ | Recurrentes: listar, crear y pausar/reactivar | |
| ⬜ | Tareas: listar, crear, cambiar estado y marcar checklist | |
| ⬜ | Listas de compra: listar y crear lista abierta | |
| ⬜ | Productos de lista: crear, editar/marcar y eliminar | |
| ⬜ | Finalizar compra crea exactamente un gasto | |
| ⬜ | Actividad y dashboard responden durante la carga | |
| ⬜ | Autorización por hogar y roles en servidor | |
| ⬜ | Formato de errores JSON compatible | |
| ⬜ | `rowVersion` y `409` en operaciones concurrentes soportadas | |

### P1 — cliente preparado / completar API prevista

| Estado | Requisito | Evidencia/observaciones |
|---|---|---|
| ⬜ | Integrantes: detalle, alta directa y edición | |
| ⬜ | Categorías: edición | |
| ⬜ | Gastos: detalle, edición, cancelación y lote | |
| ⬜ | Liquidaciones: reversión | |
| ⬜ | Recurrentes: edición y gestión de ocurrencias | |
| ⬜ | Tareas: detalle, edición, borrado, checklist completo y comentarios | |
| ⬜ | Listas: detalle, duplicado y limpiar comprados | |
| ⬜ | Productos frecuentes y favoritos | |
| ⬜ | Calendario agregado | |
| ⬜ | Reportes de gastos y tareas | |

### Calidad y seguridad

| Estado | Requisito | Evidencia/observaciones |
|---|---|---|
| ⬜ | Ningún secreto llega al frontend | |
| ⬜ | Tokens de invitación opacos, caducables y de un solo uso | |
| ⬜ | IDs anidados se validan contra `{hogarId}` | |
| ⬜ | No hay acceso horizontal entre hogares | |
| ⬜ | Operaciones financieras son transaccionales | |
| ⬜ | Procesos automáticos son idempotentes | |
| ⬜ | Importes usan decimal y suman al céntimo | |
| ⬜ | Fechas y zona horaria tienen una política consistente | |
| ⬜ | Logs incluyen `traceId` sin datos sensibles | |
| ⬜ | Hay pruebas de integración para 401, 403, 409 y CSRF | |

## 10. Prueba de humo recomendada

Ejecutar en un entorno de desarrollo con frontend y backend reales:

1. Abrir la app sin sesión y confirmar `GET /auth/me -> 401` JSON.
2. Entrar con Google y comprobar que vuelve a la ruta original.
3. Confirmar que `/auth/me` devuelve el usuario y que la cookie no es accesible
   desde JavaScript.
4. Crear un hogar; verificar owner, categorías y lista abierta.
5. Recargar y confirmar que las doce lecturas de la sección 4 responden.
6. Invitar por link, abrir `/invite/{token}` sin sesión y aceptar con Google.
7. Crear un gasto igualitario con dos integrantes y comprobar el balance.
8. Registrar una liquidación parcial y comprobar el nuevo balance.
9. Crear y completar una tarea; marcar un checklist si existe.
10. Crear productos, marcarlos comprados y finalizar la compra.
11. Confirmar que finalizar dos veces no duplica el gasto.
12. Crear una recurrencia, pausarla y reactivarla.
13. Intentar acceder a otro `{hogarId}` y esperar `403` o `404` sin filtrar datos.
14. Forzar un `rowVersion` antiguo y esperar `409` con error JSON.
15. Quitar o alterar la cabecera CSRF y esperar `400` reconocible.
16. Cerrar sesión y comprobar que la cookie, la sesión y el CSRF dejan de ser
    válidos.

## 11. Resultado esperado de la revisión

El equipo de backend debería devolver este mismo archivo con las checklists
completadas y, para cada `🟡` o `❌`:

- ruta/controlador afectado;
- comportamiento actual;
- diferencia respecto de este contrato;
- cambio propuesto;
- prioridad y estimación;
- pruebas que demostrarán que quedó resuelto.
