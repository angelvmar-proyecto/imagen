// ELEMENTOS
const pantallaCarga = document.getElementById('pantallaCarga');
const barraProgreso = document.getElementById('barraProgreso');
const estadoCarga = document.getElementById('estadoCarga');
const estadoSSD = document.getElementById('estadoSSD');
const estadoEfficient = document.getElementById('estadoEfficient');
const pantallaPrincipal = document.getElementById('pantallaPrincipal');
const entradaImagen = document.getElementById('entradaImagen');
const btnSeleccionar = document.getElementById('btnSeleccionar');
const vistaImagen = document.getElementById('vistaImagen');
const imagenPreview = document.getElementById('imagenPreview');
const btnAnalizar = document.getElementById('btnAnalizar');
const resultadoTabla = document.getElementById('resultadoTabla');
const contenedorTabla = document.getElementById('contenedorTabla');
const btnNuevaImagen = document.getElementById('btnNuevaImagen');

// VARIABLES
let modeloSSD = null;
let modeloEfficient = null;
let imagenActual = null;
let labelsLista = [];

// ✅ RUTAS LOCALES — NO TOCAR
const RUTA_SSD = 'assets/models/ssd_mobilenet_v2.tflite';
const RUTA_EFFICIENT = 'assets/models/efficientdet_lite0.tflite';
const RUTA_LABELS = 'assets/models/labels.txt';

// LOG
const logsDiv = document.getElementById('logs');
function log(texto, tipo = 'info') {
  const hora = new Date().toLocaleTimeString();
  const col = { info:'#0ff', ok:'#0f0', error:'#f55', warn:'#ff0' };
  const div = document.createElement('div');
  div.style.color = col[tipo];
  div.textContent = `[${hora}] ${texto}`;
  logsDiv.appendChild(div);
  logsDiv.scrollTop = logsDiv.scrollHeight;
  console.log(texto);
}

// ==================================================
// ESPERAR QUE LA LIBRERÍA TFLITE ESTÉ LISTA
// ==================================================
function esperarTFLite(callback, intentos = 0) {
  if (window.tf && window.tf.tflite) {
    log('✅ Librería tfjs-tflite lista (desde archivo local)', 'ok');
    callback();
  } else if (intentos < 50) {
    log(`⌛ Esperando tfjs-tflite... (${intentos+1}/50)`, 'info');
    setTimeout(() => esperarTFLite(callback, intentos + 1), 100);
  } else {
    log('❌ ERROR: La librería tfjs-tflite NO se cargó.', 'error');
    log('👉 Verifica que el archivo lib/tf-tflite.min.js exista y no esté vacío', 'error');
    estadoCarga.textContent = '❌ Librería TFLite faltante';
  }
}

// ==================================================
// CARGAR ETIQUETAS
// ==================================================
async function cargarEtiquetas() {
  log(`📄 Cargando etiquetas: ${RUTA_LABELS}`, 'info');
  try {
    const res = await fetch(RUTA_LABELS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
    log(`✅ ${labelsLista.length} etiquetas cargadas`, 'ok');
    return true;
  } catch (err) {
    log(`⚠️ Sin etiquetas: ${err.message}`, 'warn');
    return false;
  }
}

// ==================================================
// CARGAR MODELO .tflite
// ==================================================
async function cargarModelo(ruta, nombre, elementoEstado) {
  log(`🤖 Cargando ${nombre}...`, 'info');
  try {
    if (!window.tf || !window.tf.tflite) throw new Error('Librería no disponible');
    const modelo = await tf.tflite.loadTFLiteModel(ruta);
    elementoEstado.textContent = `✅ ${nombre}: Cargado`;
    log(`✅ ${nombre} CARGADO EXITOSAMENTE`, 'ok');
    return modelo;
  } catch (err) {
    elementoEstado.textContent = `❌ ${nombre}: ${err.message}`;
    log(`❌ ${nombre} FALLÓ: ${err.message}`, 'error');
    return null;
  }
}

// ==================================================
// DETECCIÓN DE LÍNEAS Y RECONSTRUCCIÓN DE TABLA
// ==================================================
function analizarTabla(imagen) {
  log('🔍 Analizando líneas de la tabla...', 'info');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = imagen.width;
  canvas.height = imagen.height;
  ctx.drawImage(imagen, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imgData.data;
  const umbral = 90;

  const lineasH = [];
  const lineasV = [];

  // Buscar líneas horizontales
  for (let y = 0; y < canvas.height; y += 2) {
    let pixelesOscuros = 0;
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const brillo = (datos[i] + datos[i+1] + datos[i+2]) / 3;
      if (brillo < umbral) pixelesOscuros++;
    }
    if (pixelesOscuros > canvas.width * 0.25) lineasH.push(y);
  }

  // Buscar líneas verticales
  for (let x = 0; x < canvas.width; x += 2) {
    let pixelesOscuros = 0;
    for (let y = 0; y < canvas.height; y++) {
      const i = (y * canvas.width + x) * 4;
      const brillo = (datos[i] + datos[i+1] + datos[i+2]) / 3;
      if (brillo < umbral) pixelesOscuros++;
    }
    if (pixelesOscuros > canvas.height * 0.25) lineasV.push(x);
  }

  // Agrupar líneas cercanas
  const filas = [], columnas = [];
  let ultima = -9999;
  lineasH.forEach(y => { if (y - ultima > 12) { filas.push(y); ultima = y; } });
  ultima = -9999;
  lineasV.forEach(x => { if (x - ultima > 12) { columnas.push(x); ultima = x; } });

  log(`✅ Líneas detectadas: ${filas.length} horizontales, ${columnas.length} verticales`, 'ok');
  return { filas, columnas, ancho: canvas.width, alto: canvas.height };
}

// ==================================================
// ARMAR TABLA HTML
// ==================================================
function construirTabla(datos) {
  const { filas, columnas } = datos;
  if (filas.length < 2 || columnas.length < 2) {
    return `<p style="color:red;">⚠️ No se detectó estructura de tabla. Asegúrate que las líneas sean visibles.</p>`;
  }

  let html = '<table style="border-collapse:collapse; width:100%;">';
  for (let f = 0; f < filas.length - 1; f++) {
    html += '<tr>';
    for (let c = 0; c < columnas.length - 1; c++) {
      const esEncabezado = f === 0;
      html += `<${esEncabezado ? 'th' : 'td'} style="border:1px solid #ccc; padding:8px; text-align:center;">Celda ${f+1},${c+1}</${esEncabezado ? 'th' : 'td'}>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

// ==================================================
// INICIALIZAR TODO
// ==================================================
async function iniciar() {
  log('🚀 Iniciando carga de modelos...', 'info');
  estadoCarga.textContent = 'Cargando librería TFLite...';

  esperarTFLite(async () => {
    barraProgreso.style.width = '15%';
    estadoCarga.textContent = 'Cargando etiquetas...';
    await cargarEtiquetas();

    barraProgreso.style.width = '35%';
    estadoCarga.textContent = 'SSD MobileNet v2...';
    modeloSSD = await cargarModelo(RUTA_SSD, 'SSD MobileNet v2', estadoSSD);

    barraProgreso.style.width = '70%';
    estadoCarga.textContent = 'EfficientDet-Lite0...';
    modeloEfficient = await cargarModelo(RUTA_EFFICIENT, 'EfficientDet-Lite0', estadoEfficient);

    barraProgreso.style.width = '100%';

    if (modeloSSD || modeloEfficient) {
      estadoCarga.textContent = '✅ Todo listo';
      log('🎉 Aplicación lista — sin internet, 100% local', 'ok');
      setTimeout(() => {
        pantallaCarga.classList.add('oculto');
        pantallaPrincipal.classList.remove('oculto');
      }, 800);
    } else {
      estadoCarga.textContent = '⚠️ Modelos no cargados';
      log('⚠️ Revisa que los archivos .tflite existan en assets/models/', 'warn');
    }
  });
}

// ==================================================
// EVENTOS DE INTERFAZ
// ==================================================
btnSeleccionar.addEventListener('click', () => entradaImagen.click());

entradaImagen.addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = (evt) => {
    imagenActual = new Image();
    imagenActual.onload = () => {
      imagenPreview.src = evt.target.result;
      vistaImagen.classList.remove('oculto');
      resultadoTabla.classList.add('oculto');
      log('✅ Imagen cargada', 'ok');
    };
    imagenActual.src = evt.target.result;
  };
  lector.readAsDataURL(archivo);
});

btnAnalizar.addEventListener('click', () => {
  if (!imagenActual) return;
  log('🔍 Iniciando análisis de tabla...', 'info');
  const datos = analizarTabla(imagenActual);
  contenedorTabla.innerHTML = construirTabla(datos);
  vistaImagen.classList.add('oculto');
  resultadoTabla.classList.remove('oculto');
});

btnNuevaImagen.addEventListener('click', () => {
  entradaImagen.value = '';
  imagenActual = null;
  imagenPreview.src = '';
  vistaImagen.classList.add('oculto');
  resultadoTabla.classList.add('oculto');
  log('🔄 Lista para nueva imagen', 'info');
});

// INICIAR
window.addEventListener('load', iniciar);
