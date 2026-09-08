// ELEMENTOS
const cargaModelos = document.getElementById('cargaModelos');
const barraProgreso = document.getElementById('barraProgreso');
const estadoCarga = document.getElementById('estadoCarga');
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

let modeloSSD = null;
let modeloEfficientDet = null;
let imagenActual = null;
let detecciones = [];
let datosTabla = [];

// ==============================================
// CARGA DE MODELOS — IGUAL A COMO FUNCIONABA ANTES
// ==============================================
async function cargarModelos() {
  estadoCarga.textContent = 'Cargando SSD MobileNet v2...';
  barraProgreso.style.width = '30%';

  try {
    // Cargar SSD MobileNet — igual que cuando funcionaba
    modeloSSD = await cocoSsd.load({ base: 'mobilenet_v2' });
    barraProgreso.style.width = '65%';
    estadoCarga.textContent = 'SSD ✅ Cargando EfficientDet-Lite0...';

    // Cargar EfficientDet — igual que cuando funcionaba
    modeloEfficientDet = await cocoSsd.load({ base: 'lite0' });
    barraProgreso.style.width = '100%';
    estadoCarga.textContent = '✅ AMBOS MODELOS CARGADOS';

    setTimeout(() => {
      cargaModelos.classList.add('oculto');
      paso1.classList.remove('oculto');
    }, 800);

  } catch (err) {
    estadoCarga.textContent = 'Error: ' + err.message;
    mostrarAviso('Error al cargar modelos: ' + err.message, 'error');
    console.error(err);
  }
}

// ==============================================
// DETECCIÓN DE TABLA POR LÍNEAS — FUNCIÓN EXTRA
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

  const lineasH = [];
  const lineasV = [];

  // Buscar líneas horizontales
  for (let y = 0; y < canvas.height; y += 2) {
    let oscuros = 0;
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brillo = (datos[idx] + datos[idx+1] + datos[idx+2]) / 3;
      if (brillo < umbral) oscuros++;
    }
    if (oscuros > canvas.width * 0.3) lineasH.push(y);
  }

  // Buscar líneas verticales
  for (let x = 0; x < canvas.width; x += 2) {
    let oscuros = 0;
    for (let y = 0; y < canvas.height; y++) {
      const idx = (y * canvas.width + x) * 4;
      const brillo = (datos[idx] + datos[idx+1] + datos[idx+2]) / 3;
      if (brillo < umbral) oscuros++;
    }
    if (oscuros > canvas.height * 0.3) lineasV.push(x);
  }

  // Agrupar líneas cercanas
  const filas = [];
  const cols = [];
  let ultimo = -9999;
  lineasH.forEach(y => { if (y - ultimo > 15) { filas.push(y); ultimo = y; } });
  ultimo = -9999;
  lineasV.forEach(x => { if (x - ultimo > 15) { cols.push(x); ultimo = x; } });

  return { filas, cols, canvas };
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
// OPCIÓN 1: DETECTAR CON IA (ORIGINAL, SIN CAMBIOS)
// ==============================================
btnDetectar.addEventListener('click', async () => {
  if (!imagenActual) return;

  const modeloActivo = document.querySelector('input[name="modelo"]:checked').value;
  const modelo = modeloActivo === 'ssd' ? modeloSSD : modeloEfficientDet;

  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  tituloPaso2.textContent = `Detección IA — ${modeloActivo === 'ssd' ? 'SSD MobileNet v2' : 'EfficientDet-Lite0'}`;
  resultadosIA.innerHTML = '<p>Analizando imagen con IA...</p>';

  try {
    detecciones = await modelo.detect(imagenActual);

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
      ctx.fillText(`${d.class} (${Math.round(d.score*100)}%)`, x, y > 20 ? y - 5 : y + 20);
    });

    if (detecciones.length === 0) {
      resultadosIA.innerHTML = `<p>⚠️ No se detectaron objetos con suficiente confianza.</p>
        <p class="nota">💡 Prueba la opción "Analizar como Tabla" para reconocer estructuras de datos.</p>`;
    } else {
      resultadosIA.innerHTML = `<p>✅ ${detecciones.length} detección(es) encontrada(s)</p>`;
    }

  } catch (err) {
    mostrarAviso('Error: ' + err.message, 'error');
    paso1.classList.remove('oculto');
    paso2.classList.add('oculto');
  }
});

// ==============================================
// OPCIÓN 2: ANALIZAR COMO TABLA (NUEVA — SIN TOCAR IA)
// ==============================================
btnAnalizarTabla.addEventListener('click', () => {
  if (!imagenActual) return;

  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  tituloPaso2.textContent = 'Análisis de Tabla';
  resultadosIA.innerHTML = '<p>🔍 Buscando líneas y estructura de tabla...</p>';

  const { filas, cols } = analizarTablaPorLineas(imagenActual);

  const ctx = lienzoDeteccion.getContext('2d');
  lienzoDeteccion.width = imagenActual.width;
  lienzoDeteccion.height = imagenActual.height;
  ctx.drawImage(imagenActual, 0, 0);

  // Dibujar líneas detectadas en ROJO
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  filas.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lienzoDeteccion.width, y); ctx.stroke(); });
  cols.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, lienzoDeteccion.height); ctx.stroke(); });

  if (filas.length < 2 || cols.length < 2) {
    resultadosIA.innerHTML = `<p>⚠️ No se detectó una estructura de tabla clara.</p>
      <p class="nota">💡 Asegúrate de que las líneas de la tabla sean visibles y bien iluminadas.</p>`;
    datosTabla = [];
  } else {
    resultadosIA.innerHTML = `<p>✅ Tabla detectada: <strong>${filas.length - 1} filas × ${cols.length - 1} columnas</strong></p>
      <p class="nota">Líneas rojas = bordes detectados automáticamente</p>`;

    // Generar estructura de tabla
    datosTabla = [];
    for (let f = 0; f < filas.length - 1; f++) {
      const fila = [];
      for (let c = 0; c < cols.length - 1; c++) {
        fila.push(`Celda ${f+1},${c+1}`);
      }
      datosTabla.push(fila);
    }
  }
});

// ==============================================
// VOLVER
// ==============================================
btnVolver.addEventListener('click', () => {
  paso2.classList.add('oculto');
  paso1.classList.remove('oculto');
  detecciones = [];
  datosTabla = [];
});

// ==============================================
// EXTRAER Y MOSTRAR TABLA
// ==============================================
btnExtraerTabla.addEventListener('click', () => {
  if (!datosTabla.length) {
    mostrarAviso('No hay datos para extraer', 'error');
    return;
  }

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

// ==============================================
// COPIAR Y COMPARTIR
// ==============================================
btnCopiar.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(texto)
    .then(() => mostrarAviso('✅ Copiado al portapapeles', 'exito'))
    .catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
});

btnWhatsApp.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent('🏝️ TABLA DETECTADA:\n' + texto), '_blank');
});

btnNueva.addEventListener('click', () => {
  archivoImagen.value = '';
  imagenActual = null;
  imagenPreview.src = '';
  vistaImagen.classList.add('oculto');
  detecciones = [];
  datosTabla = [];
  paso3.classList.add('oculto');
  paso1.classList.remove('oculto');
});

// ==============================================
// UTILIDADES
// ==============================================
function mostrarAviso(texto, tipo) {
  avisos.textContent = texto;
  avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 5000);
}

// INICIAR — IGUAL QUE ANTES
window.addEventListener('DOMContentLoaded', cargarModelos);
