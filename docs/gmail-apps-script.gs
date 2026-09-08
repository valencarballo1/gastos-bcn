/**
 * Casa Clara · lector de tickets de Gmail
 * ---------------------------------------
 * Este script corre DENTRO de tu cuenta de Google, no en el servidor de la app.
 * Busca los correos que parecen tickets o facturas y los deja en la bandeja de
 * revisión de Casa Clara. Nunca crea un gasto: eso lo confirmás vos desde la app.
 *
 * Cómo instalarlo (5 minutos, una sola vez):
 *   1. Entrá a https://script.google.com y creá un proyecto nuevo.
 *   2. Pegá este archivo entero, reemplazando lo que venga por defecto.
 *   3. Completá CONFIG con los datos que te muestra Casa Clara en
 *      Ajustes → Tickets por correo.
 *   4. Ejecutá una vez la función `importarTickets`: Google te va a pedir
 *      permiso para leer tu Gmail. Es tu propio script leyendo tu propio correo.
 *   5. Ejecutá una vez `crearDisparador` para que se repita cada hora.
 *
 * Para desconectarlo: borrá el proyecto en script.google.com, o rotá el token
 * desde Casa Clara y el script deja de tener acceso.
 */

const CONFIG = {
  // URL de la API, sin barra final. Ej: 'https://api.casaclara.es'
  apiUrl: 'REEMPLAZAR_URL_DE_LA_API',

  // Id del hogar al que van los tickets.
  householdId: 0,

  // Token de ingesta. Se genera y se rota desde Ajustes → Tickets por correo.
  token: 'REEMPLAZAR_TOKEN',

  // Cuántos días hacia atrás mirar en cada pasada. Con el disparador cada hora
  // alcanza y sobra con 2; poné más la primera vez si querés recuperar historial.
  dias: 2,

  // Remitentes que casi siempre mandan tickets o facturas.
  remitentes: [
    'mercadona.es',
    'lidl.es',
    'carrefour.es',
    'bonpreu.cat',
    'consum.es',
    'anthropic.com',
    'openai.com',
    'netflix.com',
    'spotify.com',
    'endesa.com',
    'endesaclientes.com',
    'iberdrola.es',
    'naturgy.es',
    'aiguesdebarcelona.cat',
    'movistar.es',
    'vodafone.es',
    'orange.es',
    'amazon.es',
    'glovoapp.com',
    'ubereats.com',
  ],

  // Palabras del asunto que delatan un ticket aunque el remitente sea otro.
  asuntos: [
    'ticket',
    'factura',
    'recibo',
    'tu compra',
    'your receipt',
    'invoice',
    'pago realizado',
    'justificante',
  ],
};

/**
 * Pasada principal. Es la función que conviene poner en el disparador horario.
 * Reenviar dos veces el mismo correo no duplica nada: la API descarta los
 * mensajes que ya conoce por su id de Gmail.
 */
function importarTickets() {
  const consulta = construirConsulta();
  const hilos = GmailApp.search(consulta, 0, 50);
  let enviados = 0;
  let duplicados = 0;

  hilos.forEach(function (hilo) {
    hilo.getMessages().forEach(function (mensaje) {
      const resultado = enviarMensaje(mensaje);
      if (resultado === 'stored') enviados += 1;
      if (resultado === 'duplicate') duplicados += 1;
    });
  });

  Logger.log(
    'Casa Clara: %s correos revisados, %s nuevos, %s ya conocidos.',
    hilos.length,
    enviados,
    duplicados
  );
}

function construirConsulta() {
  const remitentes = CONFIG.remitentes.join(' OR ');
  const asuntos = CONFIG.asuntos
    .map(function (texto) {
      return '"' + texto + '"';
    })
    .join(' OR ');

  return (
    'newer_than:' + CONFIG.dias + 'd (from:(' + remitentes + ') OR subject:(' + asuntos + '))'
  );
}

function enviarMensaje(mensaje) {
  const cuerpo = mensaje.getPlainBody() || mensaje.getBody() || '';
  const carga = {
    messageId: mensaje.getId(),
    from: mensaje.getFrom(),
    subject: mensaje.getSubject(),
    // El backend recorta a 20.000; recortamos acá para no mandar de más.
    body: cuerpo.slice(0, 20000),
    receivedAt: mensaje.getDate().toISOString(),
  };

  const respuesta = UrlFetchApp.fetch(
    CONFIG.apiUrl + '/api/hogares/' + CONFIG.householdId + '/buzon/ingesta',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Ingest-Token': CONFIG.token },
      payload: JSON.stringify(carga),
      muteHttpExceptions: true,
    }
  );

  const codigo = respuesta.getResponseCode();
  if (codigo === 401) {
    throw new Error(
      'Casa Clara rechazó el token de ingesta. Copiá el token otra vez desde Ajustes → Tickets por correo.'
    );
  }
  if (codigo >= 300) {
    Logger.log('Casa Clara respondió %s: %s', codigo, respuesta.getContentText());
    return 'error';
  }

  const datos = JSON.parse(respuesta.getContentText() || '{}');
  return datos.duplicate ? 'duplicate' : 'stored';
}

/** Deja el script corriendo solo, una vez por hora. */
function crearDisparador() {
  borrarDisparadores();
  ScriptApp.newTrigger('importarTickets').timeBased().everyHours(1).create();
  Logger.log('Listo: los tickets se van a revisar cada hora.');
}

/** Para dejar de importar sin borrar el proyecto. */
function borrarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function (disparador) {
    if (disparador.getHandlerFunction() === 'importarTickets') {
      ScriptApp.deleteTrigger(disparador);
    }
  });
}

/** Prueba de conexión: manda el último correo que encuentre y muestra el resultado. */
function probarConexion() {
  const hilos = GmailApp.search(construirConsulta(), 0, 1);
  if (!hilos.length) {
    Logger.log('No encontramos correos con la consulta actual. Probá subir CONFIG.dias.');
    return;
  }
  Logger.log('Resultado: %s', enviarMensaje(hilos[0].getMessages()[0]));
}
