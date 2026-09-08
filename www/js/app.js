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
let labelsLista = [];

// ==============================================
// CARGAR LISTA DE ETIQUETAS LOCAL
// ==============================================
async function cargarLabels() {
  try {
    const respuesta = await fetch('android/app/src/main/assets/models/labels.txt');
    const texto = await respuesta.text();
    labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
  } catch (err) {
    // Ruta alternativa para Capacitor
    const respuesta = await fetch('assets/models/labels.txt');
    const texto = await respuesta.text();
    labelsLista = texto.split('\n').map(l => l.trim()).filter(l => l);
  }
}

// ==============================================
// PASO 0: CARGAR LOS DOS MODELOS LOCALES (.tflite)
// ==============================================
async function cargarModelosLocales() {
  estadoCarga.textContent = 'Cargando SSD MobileNet v2...';
  barraProgreso.style.width = '25%';

  try {
    // Cargar etiquetas primero
    await cargarLabels();

    // Inicializar backend TFLite
    await tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/');
    await tflite.ready;

    barraProgreso.style.width = '40%';
    estadoCarga.textContent = 'SSD MobileNet v2...';

    // CARGAR MODELO 1: SSD MobileNet v2 (desde archivo local)
    modeloSSD = await tflite.loadTFLiteModel('android/app/src/main/assets/models/ssd_mobilenet_v2.tflite');
    barraProgreso.style.width = '65%';
    estadoCarga.textContent = 'SSD ✅ Cargando EfficientDet-Lite0...';

    // CARGAR MODELO 2: EfficientDet-Lite0 (desde archivo local)
    modeloEfficientDet = await tflite.loadTFLiteModel('android/app/src/main/assets/models/efficientdet_lite0.tflite');
    barraProgreso.style.width = '100%';
    estadoCarga.textContent = '✅ AMBOS MODELOS CARGADOS LOCALMENTE';

    setTimeout(() => {
      cargaModelos.classList.add('oculto');
      paso1.classList.remove('oculto');
    }, 800);

  } catch (err) {
    // Intentar ruta alternativa dentro de Capacitor
    try {
      estadoCarga.textContent = 'Reintentando desde ruta assets...';
      modeloSSD = await tflite.loadTFLiteModel('assets/models/ssd_mobilenet_v2.tflite');
      barraProgreso.style.width = '65%';
      modeloEfficientDet = await tflite.loadTFLiteModel('assets/models/efficientdet_lite0.tflite');
      barraProgreso.style.width = '100%';
      estadoCarga.textContent = '✅ AMBOS MODELOS CARGADOS';
      setTimeout(() => {
        cargaModelos.classList.add('oculto');
        paso1.classList.remove('oculto');
      }, 800);
    } catch (err2) {
      estadoCarga.textContent = 'Error: ' + err.message;
      mostrarAviso('No se pudieron cargar los modelos: ' + err.message, 'error');
      console.error('Error SSD:', err, 'Error EfficientDet:', err2);
    }
  }
}

// ==============================================
// PASO 1: SELECCIONAR IMAGEN
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
// PASO 2: DETECTAR CON EL MODELO SELECCIONADO
// ==============================================
btnDetectar.addEventListener('click', async () => {
  if (!imagenActual) return;

  const modeloActivo = document.querySelector('input[name="modelo"]:checked').value;
  
  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  resultadosIA.innerHTML = `<p>Analizando imagen con ${modeloActivo === 'ssd' ? 'SSD MobileNet v2' : 'EfficientDet-Lite0'}...</p>`;

  try {
    // Preparar imagen para el modelo
    const tensor = tf.browser.fromPixels(imagenActual)
      .resizeNearestNeighbor([300, 300])
      .expandDims(0)
      .toFloat()
      .div(255);

    // Elegir cuál modelo usar
    const modelo = modeloActivo === 'ssd' ? modeloSSD : modeloEfficientDet;
    
    // Ejecutar detección con IA local
    const salida = await modelo.predict(tensor);
    
    // Procesar resultados
    const cajas = Array.from(salida[0].dataSync());
    const clases = Array.from(salida[1].dataSync());
    const puntuaciones = Array.from(salida[2].dataSync());

    detecciones = [];
    for (let i = 0; i < puntuaciones.length; i++) {
      if (puntuaciones[i] > 0.5) { // Umbral de confianza 50%
        detecciones.push({
          clase: labelsLista[clases[i]] || `Clase ${clases[i]}`,
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

    // Dibujar resultados en lienzo
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

    // Mostrar resumen
    if (detecciones.length === 0) {
      resultadosIA.innerHTML = `<p>⚠️ No se detectaron objetos con suficiente confianza usando ${modeloActivo === 'ssd' ? 'SSD MobileNet v2' : 'EfficientDet-Lite0'}</p>
        <p class="nota">Nota: Estos modelos están entrenados para objetos generales. Para tablas específicas se requiere un modelo especializado.</p>`;
    } else {
      resultadosIA.innerHTML = `<p>✅ ${detecciones.length} detección(es) con ${modeloActivo === 'ssd' ? 'SSD MobileNet v2' : 'EfficientDet-Lite0'}</p>`;
    }

    tensor.dispose();

  } catch (err) {
    mostrarAviso('Error en detección: ' + err.message, 'error');
    console.error(err);
    paso1.classList.remove('oculto');
    paso2.classList.add('oculto');
  }
});

// Volver
btnVolver.addEventListener('click', () => {
  paso2.classList.add('oculto');
  paso1.classList.remove('oculto');
});

// ==============================================
// PASO 3: EXTRAER TABLA
// ==============================================
btnExtraerTabla.addEventListener('click', () => {
  if (!detecciones.length) {
    mostrarAviso('No hay detecciones para extraer', 'error');
    return;
  }

  datosTabla = [
    ['Clase detectada', 'Confianza %', 'Posición X', 'Posición Y', 'Ancho', 'Alto'],
    ...detecciones.map(d => [
      d.clase,
      Math.round(d.confianza * 100),
      Math.round(d.bbox[0]),
      Math.round(d.bbox[1]),
      Math.round(d.bbox[2]),
      Math.round(d.bbox[3])
    ])
  ];

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

// Copiar
btnCopiar.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(texto)
    .then(() => mostrarAviso('✅ Copiado al portapapeles', 'exito'))
    .catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
});

// WhatsApp
btnWhatsApp.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent('🏝️ DETECCIÓN IA:\n' + texto), '_blank');
});

// Nueva imagen
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

// Utilidad
function mostrarAviso(texto, tipo) {
  avisos.textContent = texto;
  avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 5000);
}

// INICIAR CARGA DE LOS DOS MODELOS AL ABRIR LA APP
window.addEventListener('DOMContentLoaded', cargarModelosLocales);
