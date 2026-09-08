// ELEMENTOS
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

let modeloSSD = null;
let modeloEfficient = null;
let imagenActual = null;
let detecciones = [];
let datosTabla = [];
let labelsLista = [];

// RUTAS DE TUS ARCHIVOS LOCALES
const RUTA_SSD = 'assets/models/ssd_mobilenet_v2.tflite';
const RUTA_EFFICIENT = 'assets/models/efficientdet_lite0.tflite';
const RUTA_LABELS = 'assets/models/labels.txt';

// ==============================================
// CARGAR ETIQUETAS
// ==============================================
async function cargarEtiquetas() {
  try {
    const res = await fetch(RUTA_LABELS);
    if (!res.ok) throw new Error('No encontrado');
    const texto = await res.text();
    labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
    return true;
  } catch {
    try {
      const res = await fetch('android/app/src/main/assets/models/labels.txt');
      const texto = await res.text();
      labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
      return true;
    } catch {
      return false;
    }
  }
}

// ==============================================
// CARGAR UN MODELO — FUNCIÓN GENÉRICA INDEPENDIENTE
// ==============================================
async function cargarModelo(ruta, tipo) {
  try {
    // Envuelve el archivo .tflite como modelo TFJS
    const modelo = await tf.loadGraphModel(`indexeddb://${tipo}`).catch(async () => {
      // Si no está cacheado, cargar desde archivo
      const respuesta = await fetch(ruta);
      if (!respuesta.ok) throw new Error(`Archivo no encontrado: ${ruta}`);
      const buffer = await respuesta.arrayBuffer();
      return await tf.loadGraphModelFromWeights(new Uint8Array(buffer), {
        inputShape: [1, 300, 300, 3],
        inputDtype: 'uint8'
      });
    });
    return { ok: true, modelo };
  } catch (err) {
    console.error(`Error cargando ${tipo}:`, err);
    return { ok: false, error: err.message };
  }
}

// ==============================================
// CARGAR AMBOS MODELOS — POR SEPARADO, UNO NO BLOQUEA AL OTRO
// ==============================================
async function inicializarModelos() {
  estadoCarga.textContent = 'Cargando etiquetas...';
  barraProgreso.style.width = '10%';
  await cargarEtiquetas();

  // CARGAR SSD MOBILENET V2 — INDEPENDIENTE
  estadoCarga.textContent = 'SSD MobileNet v2...';
  barraProgreso.style.width = '30%';
  const resSSD = await cargarModelo(RUTA_SSD, 'ssd');
  if (resSSD.ok) {
    modeloSSD = resSSD.modelo;
    estadoSSD.textContent = '✅ SSD MobileNet v2: Cargado';
    labelSSD.classList.remove('desactivado');
    labelSSD.querySelector('input').disabled = false;
    labelSSD.querySelector('input').checked = true; // Seleccionar por defecto
  } else {
    estadoSSD.textContent = `❌ SSD MobileNet v2: ${resSSD.error}`;
    labelSSD.classList.add('desactivado');
    labelSSD.querySelector('input').disabled = true;
  }

  // CARGAR EFFICIENTDET-LITE0 — INDEPENDIENTE, NO ESPERA A SSD
  barraProgreso.style.width = '65%';
  estadoCarga.textContent = 'EfficientDet-Lite0...';
  const resEfficient = await cargarModelo(RUTA_EFFICIENT, 'efficient');
  if (resEfficient.ok) {
    modeloEfficient = resEfficient.modelo;
    estadoEfficient.textContent = '✅ EfficientDet-Lite0: Cargado';
    labelEfficient.classList.remove('desactivado');
    labelEfficient.querySelector('input').disabled = false;
  } else {
    estadoEfficient.textContent = `❌ EfficientDet-Lite0: ${resEfficient.error}`;
    labelEfficient.classList.add('desactivado');
    labelEfficient.querySelector('input').disabled = true;
  }

  // FINALIZAR
  barraProgreso.style.width = '100%';
  const algunoCargado = modeloSSD || modeloEfficient;
  if (algunoCargado) {
    estadoCarga.textContent = '✅ Modelos listos';
    setTimeout(() => {
      cargaModelos.classList.add('oculto');
      paso1.classList.remove('oculto');
    }, 800);
  } else {
    estadoCarga.textContent = '❌ No se pudo cargar ningún modelo';
    mostrarAviso('Verifica que los archivos .tflite estén en la carpeta correcta', 'error');
  }
}

// ==============================================
// DETECCIÓN DE TABLA POR LÍNEAS
// ==============================================
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

// ==============================================
// SELECCIONAR IMAGEN
// ==============================================
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

// ==============================================
// DETECTAR CON IA
// ==============================================
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
    // Preparar imagen para el modelo
    const tensor = tf.browser.fromPixels(imagenActual)
      .resizeBilinear([300, 300])
      .expandDims(0)
      .toInt();

    // Ejecutar detección
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
          bbox: [
            cajas[i*4] * imagenActual.width,
            cajas[i*4+1] * imagenActual.height,
            (cajas[i*4+2] - cajas[i*4]) * imagenActual.width,
            (cajas[i*4+3] - cajas[i*4+1]) * imagenActual.height
          ]
        });
      }
    }

    // Dibujar resultados
    const ctx = lienzoDeteccion.getContext('2d');
    lienzoDeteccion.width = imagenActual.width;
    lienzoDeteccion.height = imagenActual.height;
    ctx.drawImage(imagenActual, 0, 0);

    detecciones.forEach(d => {
      const [x, y, w, h] = d.bbox;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${d.clase} (${Math.round(d.confianza*100)}%)`, x, y > 20 ? y - 5 : y + 20);
    });

    resultadosIA.innerHTML = detecciones.length === 0
      ? `<p>⚠️ No se detectaron objetos con confianza mayor al 50%.</p><p class="nota">💡 Prueba "Analizar como Tabla" para reconocer estructuras de datos.</p>`
      : `<p>✅ ${detecciones.length} detección(es) encontrada(s)</p>`;

    tensor.dispose();
    if (Array.isArray(salida)) salida.forEach(s => s?.dispose());
    else salida?.dispose();

  } catch (err) {
    mostrarAviso('Error en detección: ' + err.message, 'error');
    console.error(err);
    paso1.classList.remove('oculto');
    paso2.classList.add('oculto');
  }
});

// ==============================================
// ANALIZAR COMO TABLA
// ==============================================
btnAnalizarTabla.addEventListener('click', () => {
  if (!imagenActual) return;
  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  tituloPaso2.textContent = 'Análisis de Tabla';
  resultadosIA.innerHTML = '<p>🔍 Buscando líneas y estructura...</p>';

  const { filas, cols } = analizarTablaPorLineas(imagenActual);

  const ctx = lienzoDeteccion.getContext('2d');
  lienzoDeteccion.width = imagenActual.width;
  lienzoDeteccion.height = imagenActual.height;
  ctx.drawImage(imagenActual, 0, 0);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
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

// ==============================================
// NAVEGACIÓN Y COMPARTIR
// ==============================================
btnVolver.addEventListener('click', () => {
  paso2.classList.add('oculto');
  paso1.classList.remove('oculto');
  detecciones = []; datosTabla = [];
});

btnExtraerTabla.addEventListener('click', () => {
  if (!datosTabla.length) { mostrarAviso('No hay datos para extraer', 'error'); return; }
  let html = '<table>';
  datosTabla.forEach((fila, i) => {
    const tag = i === 0 ? 'th' : 'td';
    html += '<tr>' + fila.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  });
  html += '</table>';
  contenedorTabla.innerHTML = html;
  paso2.classList.add('oculto');
  paso3.classList.remove('oculto');
});

btnCopiar.addEventListener('click', {
  handleEvent() {
    if (!datosTabla.length) return;
    const texto = datosTabla.map(f => f.join(' | ')).join('\n');
    navigator.clipboard.writeText(texto)
      .then(() => mostrarAviso('✅ Copiado al portapapeles', 'exito'))
      .catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
  }
});

btnWhatsApp.addEventListener('click', {
  handleEvent() {
    if (!datosTabla.length) return;
    const texto = datosTabla.map(f => f.join(' | ')).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent('🏝️ TABLA DETECTADA:\n' + texto)}`, '_blank');
  }
});

btnNueva.addEventListener('click', () => {
  archivoImagen.value = ''; imagenActual = null; imagenPreview.src = '';
  vistaImagen.classList.add('oculto'); detecciones = []; datosTabla = [];
  paso3.classList.add('oculto'); paso1.classList.remove('oculto');
});

// ==============================================
// UTILIDAD
// ==============================================
function mostrarAviso(texto, tipo) {
  avisos.textContent = texto;
  avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 5000);
}

// INICIAR
window.addEventListener('DOMContentLoaded', inicializarModelos);
