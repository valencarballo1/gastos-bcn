# Casa Clara

Frontend responsive de Casa Clara para gestionar hogares, gastos, balances,
tareas, compras, recurrencias e integrantes. La aplicación es un cliente
React/TypeScript independiente: todos los datos de negocio se leen y escriben
mediante la API.

## Configuración local

Copiá `.env.example` como `.env.local` y ajustá los orígenes si fuera
necesario:

```env
NEXT_PUBLIC_API_URL=https://localhost:7021/api
NEXT_PUBLIC_SITE_URL=https://localhost:3000
NEXT_PUBLIC_AUTH_ENABLED=true
```

`NEXT_PUBLIC_API_URL` debe incluir `/api`, no terminar en `/` y no contener
secretos. El frontend nunca recibe ni persiste tokens de Google: la sesión se
mantiene en una cookie segura creada por el backend.

La API debe configurar CORS y `Frontend:SiteUrl` con el origen exacto del
frontend. En desarrollo también hay que confiar en el certificado HTTPS local
del backend.

El build de producción usa la configuración pública de `.env.production`:

```env
NEXT_PUBLIC_API_URL=https://valbledger.valbsolutions.site/api
NEXT_PUBLIC_AUTH_ENABLED=true
```

Antes de publicar, `Frontend:SiteUrl`, CORS y el redirect URI de Google deben
incluir el dominio definitivo del frontend.

## Desarrollo

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. El botón de acceso navega al flujo OAuth del
backend. Para que el retorno de Google funcione, el backend debe poder
redirigir a esa URL.

## Integración

- Todas las peticiones incluyen `credentials: "include"`.
- La primera escritura obtiene `GET /auth/csrf` y envía la cabecera indicada
  por la API.
- La única preferencia guardada en `localStorage` es el último hogar
  seleccionado.
- Las mutaciones vuelven a consultar las vistas derivadas para evitar datos
  obsoletos.
- Las rutas de la SPA siguen el formato `/h/:householdId/...` y
  `/invite/:token`.

## Validación

```bash
npm test
npm run build
```

La prueba funcional completa requiere que la API de
`https://localhost:7021` esté levantada y que Google OAuth, CORS y las cookies
estén configurados.
