# Tickets por correo (Gmail → Casa Clara)

Cómo llegan a la app las facturas y los tickets que mandan los comercios, sin
darle a nadie acceso a tu correo.

## Cómo funciona

```
Gmail (tu cuenta)
   │  un script tuyo, con un disparador cada hora
   ▼
POST /api/hogares/{id}/buzon/ingesta      ← autoriza el token de ingesta
   │  guarda el correo tal cual, sin interpretarlo
   ▼
Bandeja de Casa Clara
   │  la app lee el correo y propone comercio, fecha, total y productos
   ▼
Revisás y confirmás  →  se crea el gasto y se reparte
```

Dos cosas que no pasan nunca:

- **Casa Clara no entra a tu Gmail.** El script corre dentro de tu cuenta de
  Google y es lo único que lee el correo. La app solo recibe lo que ese script
  le manda.
- **Nada se convierte en gasto solo.** Todo espera en la bandeja hasta que
  alguien lo confirma. Si el importe se leyó mal, se corrige antes de guardar.

Elegimos Apps Script y no la API de Gmail a propósito: el scope `gmail.readonly`
es restringido, y una app publicada con ese permiso necesita una auditoría de
seguridad anual paga. En modo prueba se puede usar, pero el permiso caduca cada
7 días y hay que reconectar. Con un script propio no hay verificación, no hay
tokens de Google guardados en el servidor y se corta el acceso rotando un token.

## Puesta en marcha

1. En la app: **Configuración → Tickets por correo → Generar token de ingesta**.
   Anotá `apiUrl`, `householdId` y `token`.
2. Entrá a <https://script.google.com>, creá un proyecto y pegá
   [`gmail-apps-script.gs`](./gmail-apps-script.gs).
3. Completá `CONFIG` con los tres datos.
4. Ejecutá `importarTickets` una vez: Google pide permiso para que **tu** script
   lea **tu** correo. Aceptá.
5. Ejecutá `crearDisparador` para que se repita cada hora.

Para probar antes de automatizar, `probarConexion` manda un solo correo y deja
el resultado en el registro de ejecución.

## Cortar la conexión

Generá un token nuevo desde Configuración: el script viejo empieza a recibir
401 al instante. Para eliminarlo del todo, borrá el proyecto en
script.google.com.

## Qué entiende hoy el lector de tickets

El parser vive en `src/lib/receipts.ts` y está cubierto por
`src/lib/receipts.test.ts`.

| Dato | Cómo se obtiene |
| --- | --- |
| Comercio | Remitente y asunto, contra la lista de `src/lib/merchants.ts` |
| Categoría | Se deduce del comercio y se propone en el formulario |
| Fecha | Del cuerpo (`08/09/2026`, `2026-09-08`, `8 de septiembre de 2026`); si no hay, la del correo. Nunca una fecha posterior al correo: eso sería un vencimiento |
| Total | Etiquetas tipo «total a pagar», «importe total», «total charged» |
| Productos | Líneas de ticket `2 LECHE 1,20 2,40`, y pesados `0,596 kg x 2,19 €/kg 1,31` |

Los productos detectados se guardan en las notas del gasto: sirven para
reconocer la compra sin cambiar el modelo de datos.

Cuando algo no cierra, la ficha lo dice en vez de inventar: «no encontramos el
importe total», «los productos no suman el total», «el correo está en USD».

### Agregar un comercio nuevo

1. Sumá el comercio y sus alias a `MERCHANTS` en `src/lib/merchants.ts`.
2. Sumá el dominio a `CONFIG.remitentes` en el script de Gmail.
3. Si su ticket tiene un formato raro, agregá un caso a `receipts.test.ts` con
   un correo real (sin datos personales) y ajustá el parser hasta que pase.
