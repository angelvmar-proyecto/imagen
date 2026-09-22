// SIN IMPORTS — usamos window.Capacitor.Plugins
// Capacitor expone los plugins globalmente cuando corre en Android/iOS.

const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');

function log(msg) {
  console.log(msg);
  estado.textContent = msg;
}

function logError(msg) {
  console.error(msg);
  debug.style.display = 'block';
  debug.textContent += `[app.js] ${msg}\n`;
}

log('app.js cargado');

// Acceder a los plugins de Capacitor desde window
const CapacitorPlugins = window.Capacitor?.Plugins;
if (!CapacitorPlugins) {
  logError('❌ window.Capacitor.Plugins no está disponible');
} else {
  log('✅ Plugins de Capacitor detectados: ' + Object.keys(CapacitorPlugins).join(', '));
}

const { Camera, Filesystem } = CapacitorPlugins || {};

const btn = document.getElementById('btnEscanear');
if (!btn) {
  logError('❌ No se encontró #btnEscanear');
} else {
  log('✅ Botón encontrado. Listo.');
}

if (btn && Camera && Filesystem) {
  btn.addEventListener('click', async () => {
    try {
      log('Abriendo cámara...');

      const foto = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'base64',           // string en vez de enum
        source: 'CAMERA'                 // string en vez de enum
      });

      log('✅ Foto capturada. ' + (foto.base64String?.length || 0) + ' bytes');

      const savedFile = await Filesystem.writeFile({
        path: `ocr_${Date.now()}.jpeg`,
        data: foto.base64String,
        directory: 'DATA'                // string en vez de enum
      });

      log('✅ Archivo guardado: ' + savedFile.uri);
      resultado.textContent = 'Foto capturada. OCR aún no conectado.';
    } catch (error) {
      logError(`Error: ${error.message || error}`);
      console.error(error);
    }
  });
}
