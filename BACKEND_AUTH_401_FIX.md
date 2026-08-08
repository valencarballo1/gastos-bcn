# Corrección del `401` después del login con Google

## Síntoma observado

El flujo de Google OAuth termina y el navegador vuelve al frontend, pero las
peticiones posteriores fallan:

```text
GET https://localhost:7021/api/auth/me -> 401
GET https://localhost:7021/api/auth/me -> 401
GET https://localhost:7021/api/auth/me -> 401
GET https://localhost:7021/api/auth/me -> 401
```

Los cuatro `401` corresponden a los cuatro intentos que realiza el frontend al
volver de OAuth: inmediatamente y después de 250, 750 y 1500 ms.

Esto indica que Google completa su parte del flujo, pero `/api/auth/me` no puede
autenticar la cookie de sesión local.

## Causas más probables

### 1. El esquema de autenticación no coincide

En el controlador actual se utiliza:

```csharp
CookieAuthenticationDefaults.AuthenticationScheme
```

Ese valor es literalmente `"Cookies"`. Si `Program.cs` registra la cookie con
otro nombre de esquema, por ejemplo `"CasaClara.Session"`, se termina creando o
leyendo la sesión con esquemas diferentes.

El nombre del esquema debe coincidir en:

- `AddAuthentication`;
- `AddCookie`;
- `SignInAsync`;
- `SignOutAsync`;
- el esquema utilizado por `[Authorize]`.

El nombre del esquema y el nombre de la cookie son conceptos distintos, aunque
se puede usar el mismo texto para ambos.

### 2. El frontend usa HTTP y la API usa HTTPS

En desarrollo normalmente se utiliza:

```text
Frontend: http://localhost:3000
API:      https://localhost:7021
```

Al cambiar el esquema HTTP/HTTPS, la cookie puede considerarse cross-site. Si
la cookie de sesión usa `SameSite=Lax`, el navegador puede no enviarla en el
`fetch` a `/api/auth/me`, aunque el frontend utilice
`credentials: "include"`.

Para este escenario la cookie debe utilizar:

```text
SameSite=None
Secure=true
HttpOnly=true
```

No se debe configurar `Cookie.Domain` para `localhost`.

## Configuración recomendada

### Constantes compartidas

Conviene definir los esquemas una sola vez:

```csharp
public static class AuthSchemes
{
    public const string Session = "CasaClara.Session";
    public const string External = "CasaClara.External";
}
```

### Configuración de autenticación en `Program.cs`

```csharp
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.HttpOverrides;

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = AuthSchemes.Session;
        options.DefaultSignInScheme = AuthSchemes.Session;
    })
    .AddCookie(AuthSchemes.Session, options =>
    {
        options.Cookie.Name = "CasaClara.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.Path = "/";

        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };

        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    })
    .AddCookie(AuthSchemes.External, options =>
    {
        options.Cookie.Name = "CasaClara.External";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.None;
    })
    .AddGoogle(GoogleDefaults.AuthenticationScheme, options =>
    {
        options.ClientId =
            builder.Configuration["Authentication:Google:ClientId"]!;
        options.ClientSecret =
            builder.Configuration["Authentication:Google:ClientSecret"]!;
        options.SignInScheme = AuthSchemes.External;
        options.CallbackPath = "/signin-google";
    });
```

### CORS de desarrollo

El origen debe coincidir exactamente con el que aparece en el navegador:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
```

No se puede combinar `AllowAnyOrigin()` con `AllowCredentials()`.

### Orden de los middleware

```csharp
app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

`UseForwardedHeaders` debe ejecutarse antes que redirecciones HTTPS y
autenticación cuando la aplicación está detrás de un proxy.

## Cambios requeridos en `AuthController`

### Crear la sesión local

Reemplazar el esquema `CookieAuthenticationDefaults.AuthenticationScheme` por
el esquema compartido:

```csharp
var identity = new ClaimsIdentity(claims, AuthSchemes.Session);

await HttpContext.SignInAsync(
    AuthSchemes.Session,
    new ClaimsPrincipal(identity),
    new AuthenticationProperties
    {
        IsPersistent = true,
        ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7)
    });
```

### Cerrar la sesión

```csharp
await HttpContext.SignOutAsync(AuthSchemes.Session);
await HttpContext.SignOutAsync(AuthSchemes.External);
Response.Cookies.Delete("CasaClara.Antiforgery");
```

### Hacer explícito el esquema en endpoints privados

Si se configura correctamente `DefaultAuthenticateScheme`, no es obligatorio,
pero durante el diagnóstico se puede eliminar toda ambigüedad:

```csharp
[Authorize(AuthenticationSchemes = AuthSchemes.Session)]
[HttpGet("me")]
public IActionResult Me()
{
    // Respuesta actual.
}
```

Debe aplicarse el mismo criterio a `/csrf` y `/logout`.

## Configuración detrás de proxy en producción

La API desplegada debe construir el callback como:

```text
https://valbledger.valbsolutions.site/signin-google
```

No debe generar:

```text
http://valbledger.valbsolutions.site/signin-google
```

ASP.NET debe procesar `X-Forwarded-Proto` del proxy legítimo:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    // Añadir los KnownProxies o KnownNetworks reales del despliegue.
});
```

No se recomienda confiar indiscriminadamente en encabezados reenviados desde
cualquier origen. Se deben declarar los proxies o redes reales.

## Configuración de Google Cloud

Cliente OAuth de tipo `Web application`.

Redirect URI de producción:

```text
https://valbledger.valbsolutions.site/signin-google
```

Redirect URI de desarrollo:

```text
https://localhost:7021/signin-google
```

`/api/auth/google/login` inicia el flujo, pero no es el redirect URI de Google.
`/api/auth/google/callback` es el callback interno de la aplicación después de
que el middleware procesa `/signin-google`.

## Variables de entorno relevantes

Ejemplo de desarrollo:

```text
Authentication__Google__ClientId=<client-id>
Authentication__Google__ClientSecret=<client-secret>
Cors__FrontendOrigins__0=http://localhost:3000
Authentication__Cookie__SameSite=None
```

El `ClientSecret` debe existir únicamente como secreto del backend.

## Verificación en el navegador

Activar `Preserve log` en DevTools y comprobar estas dos peticiones.

### 1. Respuesta de `/api/auth/google/callback`

Debe contener una cabecera equivalente a:

```text
Set-Cookie: CasaClara.Session=<valor>; path=/; secure; samesite=none; httponly
```

No copiar ni registrar el valor de la cookie.

### 2. Petición posterior a `/api/auth/me`

Debe enviar:

```text
Cookie: CasaClara.Session=<valor>
```

Interpretación:

- Si el callback no incluye `Set-Cookie`, revisar `SignInAsync` y el esquema
  registrado.
- Si la cookie se crea pero `/auth/me` no la envía, revisar `SameSite`,
  `Secure`, dominio, HTTP/HTTPS y políticas del navegador.
- Si `/auth/me` envía la cookie y aun así devuelve `401`, revisar el esquema de
  `[Authorize]`, las claves de Data Protection y si existen varias instancias
  del backend con claves diferentes.

## Checklist final

- [ ] `AddCookie`, `SignInAsync`, `SignOutAsync` y `[Authorize]` usan el mismo
      esquema de sesión.
- [ ] La cookie se llama `CasaClara.Session` y tiene `Path=/`.
- [ ] La cookie usa `HttpOnly`, `Secure` y el `SameSite` adecuado.
- [ ] CORS contiene el origen exacto del frontend y usa
      `AllowCredentials()`.
- [ ] El frontend usa `credentials: "include"`.
- [ ] El callback devuelve `Set-Cookie` para `CasaClara.Session`.
- [ ] `/api/auth/me` envía esa cookie en la petición.
- [ ] Producción genera URLs OAuth con `https`, no `http`.
- [ ] Google Cloud registra `/signin-google` con coincidencia exacta.
- [ ] Cookies, tokens CSRF, códigos OAuth y secretos nunca se registran.

