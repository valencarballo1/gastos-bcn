# Casa Clara

Frontend responsive de Casa Clara para gestionar hogares, gastos, balances,
tareas, compras, recurrencias e integrantes. La aplicación es un cliente
React/TypeScript independiente: todos los datos de negocio se leen y escriben
mediante la API.

## Configuración local

Copiá `.env.example` como `.env.local` y ajustá los orígenes si fuera
necesario:

```env
VITE_API_URL=https://localhost:7021
VITE_AUTH_DEBUG=true
NEXT_PUBLIC_SITE_URL=https://localhost:3000
NEXT_PUBLIC_AUTH_ENABLED=true
```

`VITE_API_URL` es el origen de la API: no debe incluir `/api`, terminar en `/`
ni contener secretos. Next.js la expone al cliente durante el build para mantener
el mismo contrato de configuración que el resto de frontends de Casa Clara. El
frontend nunca recibe ni persiste tokens de Google: la sesión se
mantiene en una cookie segura creada por el backend.

`VITE_AUTH_DEBUG=true` activa trazas seguras en la consola del navegador con el
prefijo `[Casa Clara Auth]`. Las trazas muestran estados HTTP, rutas y la forma
de la respuesta de sesión, pero nunca cookies, tokens CSRF, códigos OAuth ni
secretos. Cambialo a `false` después de terminar el diagnóstico.

La API debe incluir el origen exacto del frontend en
`Cors__FrontendOrigins__0`. Si frontend y API están en sitios distintos, también
debe usar `Authentication__Cookie__SameSite=None`. En desarrollo hay que confiar
en el certificado HTTPS local del backend.

El build de producción usa la configuración pública de `.env.production`:

```env
VITE_API_URL=https://valbledger.valbsolutions.site
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
- Después de confirmar la sesión con `GET /api/auth/me`, el cliente obtiene
  `GET /api/auth/csrf`; ninguna mutación sale sin la cabecera indicada por la API.
- El acceso con Google navega a `/api/auth/google/login` y siempre envía como
  retorno una URL absoluta del frontend.
- La única preferencia guardada en `localStorage` es el último hogar
  seleccionado.
- Las mutaciones vuelven a consultar las vistas derivadas para evitar datos
  obsoletos.
- Las rutas de la SPA siguen el formato `/h/:householdId/...` y
  `/invite/:token`.

## Importes con decimales

Los campos de dinero **no** usan `<input type="number">`: en España el teclado
del móvil ofrece coma decimal y ese control descarta el valor, así que el campo
quedaba vacío. Se usa `AmountInput` (`src/components/common/AmountInput.tsx`),
que es texto con `inputMode="decimal"`, y `parseAmount` de `src/lib/money.ts`,
que entiende `12,50`, `12.50`, `1.234,56` y `1,234.56`. Cualquier campo de
importe nuevo debería usar los dos.

## Tickets por correo

Las facturas y los tickets de Gmail pueden llegar a la bandeja de la app sin
darle a Casa Clara acceso al correo: un Apps Script que corre en la cuenta de la
persona manda los mensajes a la API y la app propone el gasto para revisar.

Ver [`docs/tickets-por-correo.md`](docs/tickets-por-correo.md) y
[`docs/gmail-apps-script.gs`](docs/gmail-apps-script.gs).

## Validación

```bash
npm test
npm run build
```

La prueba funcional completa requiere que la API de
`https://localhost:7021` esté levantada y que Google OAuth, CORS y las cookies
estén configurados.
