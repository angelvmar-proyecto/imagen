// ==================================================
// MAR CARIBE — VERSIÓN CON LOGS COMPLETOS + 10 MÉTODOS
// ==================================================

// Elementos del DOM
const cargaModelos = document.getElementById('cargaModelos');
const barraProgreso = document.getElementById('barraProgreso');
const estadoCarga = document.getElementById('estadoCarga');
const estadoSSD = document.getElementById('estadoSSD');
const estadoEfficient = document.getElementById('estadoEfficient');
const paso1 = document.getElementById('paso1');
const paso2 = document.getElementById('paso2');
const paso3 = document.getElementById('paso3');
const archivoImagen = document.getElementById('archivoImagen');
const btnElegir = document.getElementById('btnElegir');
const vistaImagen = document.getElementById('vistaImagen');
const imagenPreview = document.getElementById('imagenPreview');
const btnDetectar = document.getElementById('btnDetectar');
const btnAnalizarTabla = document.getElementById('btnAnalizarTabla');
const tituloPaso2 = document.getElementById('tituloPaso2');
const lienzoDeteccion = document.getElementById('lienzoDeteccion');
const resultadosIA = document.getElementById('resultadosIA');
const btnExtraerTabla = document.getElementById('btnExtraerTabla');
const btnVolver = document.getElementById('btnVolver');
const contenedorTabla = document.getElementById('contenedorTabla');
const btnCopiar = document.getElementById('btnCopiar');
const btnWhatsApp = document.getElementById('btnWhatsApp');
const btnNueva = document.getElementById('btnNueva');
const avisos = document.getElementById('avisos');
const labelSSD = document.getElementById('labelSSD');
const labelEfficient = document.getElementById('labelEfficient');

// Variables globales
let modeloSSD = null;
let modeloEfficient = null;
let imagenActual = null;
let detecciones = [];
let datosTabla = [];
let labelsLista = [];

// ✅ RUTAS — CONFIRMADAS CORRECTAS, NO SE TOCAN
const RUTA_SSD = 'assets/models/ssd_mobilenet_v2.tflite';
const RUTA_EFFICIENT = 'assets/models/efficientdet_lite0.tflite';
const RUTA_LABELS = 'assets/models/labels.txt';

// ==================================================
// 🔍 FUNCIÓN DE LOG — REGISTRA TODO
// ==================================================
const logsDiv = document.getElementById('logsDepuracion');
const log = (texto, tipo = 'info') => {
  if (!logsDiv) return;
  const hora = new Date().toLocaleTimeString();
  const colores = { info: '#0ff', ok: '#0f0', error: '#f55', warn: '#ff0' };
  const etiqueta = document.createElement('div');
  etiqueta.style.color = colores[tipo];
  etiqueta.textContent = `[${hora}] ${texto}`;
  logsDiv.appendChild(etiqueta);
  logsDiv.scrollTop = logsDiv.scrollHeight;
  console.log(`[${tipo.toUpperCase()}] ${texto}`);
};

// ==================================================
// 🧪 10 MÉTODOS DIFERENTES DE CARGA DE LIBRERÍA
// ==================================================
const METODOS_CDN = [
  { nombre: 'Método 1 — CDN oficial', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 2 — Carga dinámica con timeout', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 3 — Fetch + Eval', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 4 — Versión alpha.9', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/tf-tflite.min.js' },
  { nombre: 'Método 5 — jsDelivr alternativo', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 6 — Unpkg', url: 'https://unpkg.com/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 7 — Local (descargado)', url: 'lib/tf-tflite.min.js' },
  { nombre: 'Método 8 — Reintento prolongado', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/tf-tflite.min.js' },
  { nombre: 'Método 9 — Sin librería, solo validar archivos', url: null },
  { nombre: 'Método 10 — Diagnóstico completo', url: null }
];

// ==================================================
// CARGAR LIBRERÍA DINÁMICAMENTE
// ==================================================
async function cargarLibreriaTFLite(indiceMetodo) {
  const metodo = METODOS_CDN[indiceMetodo - 1];
  log(`🔧 ${metodo.nombre} iniciando...`, 'info');

  // Métodos especiales que no cargan script
  if (indiceMetodo === 9) {
    log('📋 Método 9: Sin librería — validando rutas de archivos solamente', 'info');
    await validarArchivos();
    return { ok: true, libreria: null };
  }
  if (indiceMetodo === 10) {
    log('🔬 Método 10: Ejecutando diagnóstico completo...', 'info');
    await ejecutarDiagnostico();
    return { ok: true, libreria: null };
  }

  // Verificar si ya está cargada
  if (window.tf && window.tf.tflite) {
    log('✅ Librería TFLite YA estaba cargada', 'ok');
    return { ok: true, libreria: tf.tflite };
  }

  // Método 3: Fetch + Eval
  if (indiceMetodo === 3) {
    try {
      log(`📡 Descargando desde: ${metodo.url}`, 'info');
      const res = await fetch(metodo.url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const codigo = await res.text();
      log(`✅ Código descargado (${codigo.length} caracteres), ejecutando...`, 'ok');
      eval(codigo);
      await new Promise(r => setTimeout(r, 500));
      if (window.tf && window.tf.tflite) {
        log('✅ Librería cargada por fetch+eval', 'ok');
        return { ok: true, libreria: tf.tflite };
      }
      throw new Error('Después de eval, tf.tflite no existe');
    } catch (err) {
      log(`❌ Método 3 falló: ${err.message}`, 'error');
      return { ok: false, error: err.message };
    }
  }

  // Método normal: crear etiqueta <script>
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = metodo.url;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';

    // Timeout según método
    const tiempoMax = indiceMetodo === 8 ? 15000 : 8000;

    const timeout = setTimeout(() => {
      log(`⏱️ Timeout tras ${tiempoMax/1000}s — ${metodo.nombre}`, 'error');
      resolve({ ok: false, error: `Timeout ${tiempoMax/1000}s` });
    }, tiempoMax);

    script.onload = () => {
      clearTimeout(timeout);
      log(`✅ Script cargado en memoria, verificando tf.tflite...`, 'info');
      setTimeout(() => {
        if (window.tf && window.tf.tflite) {
          log(`✅ ${metodo.nombre} — LIBRERÍA DISPONIBLE ✅`, 'ok');
          resolve({ ok: true, libreria: tf.tflite });
        } else {
          log(`❌ Script cargado PERO tf.tflite NO existe en el objeto tf`, 'error');
          log(`🔍 tf existe? ${!!window.tf}, tf.tflite existe? ${!!(window.tf && window.tf.tflite)}`, 'warn');
          resolve({ ok: false, error: 'tf.tflite no definido tras carga' });
        }
      }, indiceMetodo === 2 ? 2000 : 500);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      log(`❌ Error de red al cargar ${metodo.nombre} — URL bloqueada o sin conexión`, 'error');
      resolve({ ok: false, error: 'Error de red / URL bloqueada' });
    };

    document.head.appendChild(script);
    log(`📄 Etiqueta script agregada al DOM`, 'info');
  });
}

// ==================================================
// VALIDAR QUE LOS ARCHIVOS EXISTAN
// ==================================================
async function validarArchivos() {
  log('📋 === VALIDACIÓN DE ARCHIVOS ===', 'info');
  const archivos = [
    { nombre: 'SSD MobileNet v2', ruta: RUTA_SSD },
    { nombre: 'EfficientDet-Lite0', ruta: RUTA_EFFICIENT },
    { nombre: 'Etiquetas', ruta: RUTA_LABELS }
  ];

  for (const arch of archivos) {
    try {
      log(`🔍 Verificando: ${arch.ruta}`, 'info');
      const res = await fetch(arch.ruta, { method: 'HEAD' });
      if (res.ok) {
        const tamano = res.headers.get('content-length');
        log(`✅ ${arch.nombre}: ENCONTRADO ${arch.ruta} ${tamano ? `(${Math.round(tamano/1024)} KB)` : ''}`, 'ok');
      } else {
        log(`❌ ${arch.nombre}: HTTP ${res.status} — NO ENCONTRADO`, 'error');
      }
    } catch (err) {
      log(`❌ ${arch.nombre}: Error de acceso — ${err.message}`, 'error');
    }
  }
  log('📋 === FIN VALIDACIÓN ===', 'info');
}

// ==================================================
// DIAGNÓSTICO COMPLETO
// ==================================================
async function ejecutarDiagnostico() {
  log('🔬 === INICIO DIAGNÓSTICO COMPLETO ===', 'info');
  log(`📍 Plataforma: ${navigator.platform}`, 'info');
  log(`📍 Navegador/App: ${navigator.userAgent}`, 'info');
  log(`📍 Online: ${navigator.onLine}`, 'info');
  log(`📍 tf existe? ${!!window.tf}`, 'info');
  if (window.tf) log(`📍 tf.version: ${JSON.stringify(tf.version)}`, 'info');
  log(`📍 tf.tflite existe? ${!!(window.tf && window.tf.tflite)}`, 'info');
  log(`📍 Protocolo: ${window.location.protocol}`, 'info');
  log(`📍 Host: ${window.location.hostname}`, 'info');
  await validarArchivos();
  log('🔬 === FIN DIAGNÓSTICO ===', 'ok');
}

// ==================================================
// CARGAR ETIQUETAS
// ==================================================
async function cargarEtiquetas() {
  log(`📄 Cargando etiquetas desde: ${RUTA_LABELS}`, 'info');
  try {
    const res = await fetch(RUTA_LABELS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
    log(`✅ Etiquetas cargadas: ${labelsLista.length} categorías`, 'ok');
    return true;
  } catch (err) {
    log(`❌ Error etiquetas: ${err.message}`, 'error');
    return false;
  }
}

// ==================================================
// CARGAR MODELO TFLITE
// ==================================================
async function cargarModelo(ruta, nombre) {
  log(`🤖 Intentando cargar modelo: ${nombre} desde ${ruta}`, 'info');
  try {
    if (!window.tf || !window.tf.tflite) {
      throw new Error('Librería TFLite no disponible');
    }
    log(`📦 Llamando a tf.tflite.loadTFLiteModel("${ruta}")...`, 'info');
    const modelo = await tf.tflite.loadTFLiteModel(ruta);
    log(`✅ Modelo ${nombre} CARGADO EXITOSAMENTE`, 'ok');
    return { ok: true, modelo };
  } catch (err) {
    log(`❌ Error cargando ${nombre}: ${err.message}`, 'error');
    log(`🔍 Stack: ${err.stack?.substring(0, 200) || 'sin stack'}`, 'warn');
    return { ok: false, error: err.message };
  }
}

// ==================================================
// INICIALIZAR MODELOS (después de librería lista)
// ==================================================
async function inicializarModelos() {
  log('🚀 Iniciando carga de modelos...', 'info');
  estadoCarga.textContent = 'Cargando etiquetas...';
  barraProgreso.style.width = '10%';

  const etiquetasOK = await cargarEtiquetas();
  if (!etiquetasOK) estadoCarga.textContent = '⚠️ Sin etiquetas';

  // SSD
  estadoCarga.textContent = 'SSD MobileNet v2...';
  barraProgreso.style.width = '35%';
  const resSSD = await cargarModelo(RUTA_SSD, 'SSD MobileNet v2');
  if (resSSD.ok) {
    modeloSSD = resSSD.modelo;
    estadoSSD.textContent = '✅ SSD MobileNet v2: Cargado';
    labelSSD.classList.remove('desactivado');
    labelSSD.querySelector('input').disabled = false;
    labelSSD.querySelector('input').checked = true;
  } else {
    estadoSSD.textContent = `❌ SSD: ${resSSD.error}`;
    labelSSD.classList.add('desactivado');
  }

  // EfficientDet
  barraProgreso.style.width = '70%';
  estadoCarga.textContent = 'EfficientDet-Lite0...';
  const resEfficient = await cargarModelo(RUTA_EFFICIENT, 'EfficientDet-Lite0');
  if (resEfficient.ok) {
    modeloEfficient = resEfficient.modelo;
    estadoEfficient.textContent = '✅ EfficientDet-Lite0: Cargado';
    labelEfficient.classList.remove('desactivado');
    labelEfficient.querySelector('input').disabled = false;
  } else {
    estadoEfficient.textContent = `❌ EfficientDet: ${resEfficient.error}`;
    labelEfficient.classList.add('desactivado');
  }

  barraProgreso.style.width = '100%';
  if (modeloSSD || modeloEfficient) {
    estadoCarga.textContent = '✅ Modelos listos';
    log('🎉 TODO LISTO — Entrando a pantalla principal', 'ok');
    setTimeout(() => {
      cargaModelos.classList.add('oculto');
      paso1.classList.remove('oculto');
    }, 500);
  } else {
    estadoCarga.textContent = '❌ No se cargó ningún modelo';
    log('⚠️ SUGERENCIA: Usa los botones de métodos de carga arriba para probar otras opciones', 'warn');
  }
}

// ==================================================
// ASIGNAR EVENTOS A LOS 10 BOTONES
// ==================================================
for (let i = 1; i <= 10; i++) {
  document.getElementById(`btnMetodo${i}`).addEventListener('click', async () => {
    log(`========== USUARIO SELECCIONÓ ${METODOS_CDN[i-1].nombre} ==========`, 'info');
    estadoCarga.textContent = `${METODOS_CDN[i-1].nombre}...`;
    const resultado = await cargarLibreriaTFLite(i);
    if (resultado.ok && resultado.libreria) {
      log('✅ Librería lista — procediendo a cargar modelos', 'ok');
      await inicializarModelos();
    }
  });
}

// ==================================================
// CARGA AUTOMÁTICA AL INICIO — Método 1
// ==================================================
window.addEventListener('load', async () => {
  log('📦 Página completamente cargada — iniciando Método 1 automáticamente', 'info');
  estadoCarga.textContent = 'Cargando librería TFLite...';
  const resultado = await cargarLibreriaTFLite(1);
  if (resultado.ok && resultado.libreria) {
    await inicializarModelos();
  } else {
    estadoCarga.textContent = '❌ Librería TFLite no cargó — elige otro método abajo';
    log('⚠️ Método 1 falló. Elige otro de los 10 botones.', 'warn');
  }
});

// ==================================================
// RESTO DE FUNCIONES — DETECCIÓN, TABLA, UI
// ==================================================
function analizarTablaPorLineas(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imgData.data;
  const umbral = 80;
  const lineasH = [], lineasV = [];
  for (let y = 0; y < canvas.height; y += 2) {
    let oscuros = 0;
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brillo = (datos[idx] + datos[idx+1] + datos[idx+2]) / 3;
      if (brillo < umbral) oscuros++;
    }
    if (oscuros > canvas.width * 0.3) lineasH.push(y);
  }
  for (let x = 0; x < canvas.width; x += 2) {
    let oscuros = 0;
    for (let y = 0; y < canvas.height; y++) {
      const idx = (y * canvas.width + x) * 4;
      const brillo = (datos[idx] + datos[idx+1] + datos[idx+2]) / 3;
      if (brillo < umbral) oscuros++;
    }
    if (oscuros > canvas.height * 0.3) lineasV.push(x);
  }
  const filas = [], cols = [];
  let ultimo = -9999;
  lineasH.forEach(y => { if (y - ultimo > 15) { filas.push(y); ultimo = y; } });
  ultimo = -9999;
  lineasV.forEach(x => { if (x - ultimo > 15) { cols.push(x); ultimo = x; } });
  return { filas, cols };
}

btnElegir.addEventListener('click', () => archivoImagen.click());
archivoImagen.addEventListener('change', (e) => {
  const arch = e.target.files[0];
  if (!arch) return;
  const lector = new FileReader();
  lector.onload = (evt) => {
    imagenActual = new Image();
    imagenActual.onload = () => {
      imagenPreview.src = evt.target.result;
      vistaImagen.classList.remove('oculto');
    };
    imagenActual.src = evt.target.result;
  };
  lector.readAsDataURL(arch);
});

btnDetectar.addEventListener('click', async () => {
  if (!imagenActual) return;
  const opcion = document.querySelector('input[name="modelo"]:checked');
  if (!opcion) { mostrarAviso('Selecciona un modelo', 'error'); return; }
  const tipo = opcion.value;
  const modelo = tipo === 'ssd' ? modeloSSD : modeloEfficient;
  if (!modelo) { mostrarAviso('Modelo no disponible', 'error'); return; }
  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  tituloPaso2.textContent = `Detección — ${tipo === 'ssd' ? 'SSD MobileNet v2' : 'EfficientDet-Lite0'}`;
  resultadosIA.innerHTML = '<p>Procesando imagen...</p>';
  try {
    const tensor = tf.browser.fromPixels(imagenActual).resizeBilinear([300, 300]).expandDims(0).toInt();
    const salida = await modelo.predict(tensor);
    const cajas = Array.isArray(salida[0]) ? salida[0].dataSync() : salida[0].dataSync();
    const clases = Array.isArray(salida[1]) ? salida[1].dataSync() : salida[1].dataSync();
    const puntuaciones = Array.isArray(salida[2]) ? salida[2].dataSync() : salida[2].dataSync();
    detecciones = [];
    for (let i = 0; i < Math.min(100, puntuaciones.length); i++) {
      if (puntuaciones[i] > 0.5) {
        const idxClase = clases[i];
        detecciones.push({
          clase: labelsLista[idxClase] || `Clase ${idxClase}`,
          confianza: puntuaciones[i],
          bbox: [cajas[i*4] * imagenActual.width, cajas[i*4+1] * imagenActual.height, (cajas[i*4+2]-cajas[i*4])*imagenActual.width, (cajas[i*4+3]-cajas[i*4+1])*imagenActual.height]
        });
      }
    }
    const ctx = lienzoDeteccion.getContext('2d');
    lienzoDeteccion.width = imagenActual.width;
    lienzoDeteccion.height = imagenActual.height;
    ctx.drawImage(imagenActual, 0, 0);
    detecciones.forEach(d => {
      const [x, y, w, h] = d.bbox;
      ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#00ff00'; ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${d.clase} (${Math.round(d.confianza*100)}%)`, x, y > 20 ? y - 5 : y + 20);
    });
    resultadosIA.innerHTML = detecciones.length === 0
      ? `<p>⚠️ No se detectaron objetos con confianza mayor al 50%.</p><p class="nota">💡 Prueba "Analizar como Tabla" para reconocer estructuras de datos.</p>`
      : `<p>✅ ${detecciones.length} detección(es) encontrada(s)</p>`;
    tensor.dispose();
    if (Array.isArray(salida)) salida.forEach(s => s?.dispose()); else salida?.dispose();
  } catch (err) {
    mostrarAviso('Error en detección: ' + err.message, 'error');
    log(`❌ Error detección: ${err.message}`, 'error');
    paso1.classList.remove('oculto'); paso2.classList.add('oculto');
  }
});

btnAnalizarTabla.addEventListener('click', () => {
  if (!imagenActual) return;
  paso1.classList.add('oculto'); paso2.classList.remove('oculto');
  tituloPaso2.textContent = 'Análisis de Tabla';
  resultadosIA.innerHTML = '<p>🔍 Buscando líneas y estructura...</p>';
  const { filas, cols } = analizarTablaPorLineas(imagenActual);
  const ctx = lienzoDeteccion.getContext('2d');
  lienzoDeteccion.width = imagenActual.width; lienzoDeteccion.height = imagenActual.height;
  ctx.drawImage(imagenActual, 0, 0);
  ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
  filas.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lienzoDeteccion.width, y); ctx.stroke(); });
  cols.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, lienzoDeteccion.height); ctx.stroke(); });
  if (filas.length < 2 || cols.length < 2) {
    resultadosIA.innerHTML = `<p>⚠️ No se detectó estructura de tabla clara.</p><p class="nota">💡 Asegúrate que las líneas sean visibles y bien iluminadas.</p>`;
    datosTabla = [];
  } else {
    resultadosIA.innerHTML = `<p>✅ Tabla detectada: <strong>${filas.length - 1} filas × ${cols.length - 1} columnas</strong></p><p class="nota">Líneas rojas = bordes detectados</p>`;
    datosTabla = [];
    for (let f = 0; f < filas.length - 1; f++) {
      const fila = [];
      for (let c = 0; c < cols.length - 1; c++) fila.push(`Celda ${f+1},${c+1}`);
      datosTabla.push(fila);
    }
  }
});

btnVolver.addEventListener('click', () => { paso2.classList.add('oculto'); paso1.classList.remove('oculto'); detecciones = []; datosTabla = []; });
btnExtraerTabla.addEventListener('click', () => {
  if (!datosTabla.length) { mostrarAviso('No hay datos para extraer', 'error'); return; }
  let html = '<table>';
  datosTabla.forEach((fila, i) => { const tag = i === 0 ? 'th' : 'td'; html += '<tr>' + fila.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>'; });
  html += '</table>';
  contenedorTabla.innerHTML = html; paso2.classList.add('oculto'); paso3.classList.remove('oculto');
});
btnCopiar.addEventListener('click', () => {
  if (!datosTabla.length) return;
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(texto).then(() => mostrarAviso('✅ Copiado al portapapeles', 'exito')).catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
});
btnWhatsApp.addEventListener('click', () => {
  if (!datosTabla.length) return;
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent('🏝️ TABLA DETECTADA:\n' + texto)}`, '_blank');
});
btnNueva.addEventListener('click', () => {
  archivoImagen.value = ''; imagenActual = null; imagenPreview.src = ''; vistaImagen.classList.add('oculto'); detecciones = []; datosTabla = [];
  paso3.classList.add('oculto'); paso1.classList.remove('oculto');
});
function mostrarAviso(texto, tipo) {
  avisos.textContent = texto; avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 5000);
}
