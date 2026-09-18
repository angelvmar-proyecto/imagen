// ============================================
// MAR Caribe v9.0 - Simplificado
// ============================================

window.MAR = window.MAR || {};
window.MAR.imagenOriginal = null;
window.MAR.imagenOriginalCanvas = null;

let rutaImagenActual = null;
let matrizDatos = [];
let procesando = false;
let workerTesseract = null;

// Zoom + Pan
let zoomActual = 1.0;
let panX = 0, panY = 0;
const ZOOM_MIN = 1.0, ZOOM_MAX = 15.0;
let lineasOcultas = false;

// ============================================
// UI
// ============================================
function setProgreso(pct, msg) {
  const w = document.getElementById('progressWrapper');
  if (w) w.style.display = 'block';
  const f = document.getElementById('progressFill');
  if (f) { f.style.width = pct + '%'; f.textContent = pct + '%'; }
  const s = document.getElementById('progressStep');
  if (s) s.innerText = msg;
  const st = document.getElementById('statusText');
  if (st) st.innerText = '[' + pct + '%] ' + msg;
}

function ocultarProgreso() {
  const w = document.getElementById('progressWrapper');
  if (w) w.style.display = 'none';
  const s = document.getElementById('progressStep');
  if (s) s.innerText = '';
}

function mostrarStatus(texto, tipo) {
  const st = document.getElementById('statusText');
  if (st) {
    st.innerText = texto;
    st.className = 'status ' + (tipo || 'info');
  }
}

// ============================================
// CARGA DE IMAGEN
// ============================================
function capturarImagen() {
  const Camera = window.Capacitor?.Plugins?.Camera;
  if (Camera) {
    Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: 'uri',
      source: 'PROMPT'
    }).then(photo => {
      let path = photo.webPath;
      if (window.Capacitor?.convertFileSrc && photo.path) {
        path = window.Capacitor.convertFileSrc(photo.path);
      }
      cargarEnCanvas(path);
    }).catch(() => document.getElementById('fileInput').click());
  } else {
    document.getElementById('fileInput').click();
  }
}

function cargarDesdeInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => cargarEnCanvas(e.target.result);
  reader.readAsDataURL(file);
}

function cargarEnCanvas(src) {
  rutaImagenActual = src;
  const img = document.getElementById('imgPreview');
  if (!img) return;
  img.src = src;
  img.onload = () => {
    document.getElementById('previewContainer').style.display = 'block';
    document.getElementById('procesoContainer').style.display = 'block';
    document.getElementById('debugContainer').style.display = 'block';
    document.getElementById('sliderMediana').style.display = 'block';
    resetearZoom();

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    
    window.MAR.imagenOriginalCanvas = canvas;
    window.MAR.imagenOriginal = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    
    // Resetear estados
    for (let i = 1; i <= 9; i++) {
      const est = document.getElementById('estado-paso' + i);
      if (est) est.textContent = '⏳';
      const item = document.getElementById('btn-paso' + i);
      if (item) item.classList.remove('paso-ejecutado', 'paso-ejecutando', 'paso-error');
    }
    
    const cv = document.getElementById('deteccionCanvas');
    if (cv) { cv.width = 0; cv.height = 0; }

    mostrarStatus('✅ Imagen cargada. Ejecuta los pasos.', 'success');
  };
}

// ============================================
// ZOOM + PAN
// ============================================
function aplicarTransform() {
  const content = document.getElementById('zoomContent');
  if (!content) return;
  content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomActual})`;
  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoomActual.toFixed(1) + 'x';
}

function resetearZoom() {
  zoomActual = 1.0;
  panX = 0;
  panY = 0;
  aplicarTransform();
}

function zoomIn() {
  zoomActual = Math.min(zoomActual + 1.0, ZOOM_MAX);
  aplicarTransform();
}

function zoomOut() {
  zoomActual = Math.max(zoomActual - 1.0, ZOOM_MIN);
  if (zoomActual === 1.0) { panX = 0; panY = 0; }
  aplicarTransform();
}

function toggleLineas() {
  const canvas = document.getElementById('deteccionCanvas');
  if (!canvas) return;
  lineasOcultas = !lineasOcultas;
  canvas.style.opacity = lineasOcultas ? '0' : '1';
  const btn = document.getElementById('btnToggleLineas');
  if (btn) btn.textContent = lineasOcultas ? '🚫' : '👁️';
}

// ============================================
// GESTOS
// ============================================
let touchStartDist = 0;
let touchStartZoom = 1.0;
let touchStartX = 0, touchStartY = 0;
let touchStartPanX = 0, touchStartPanY = 0;
let lastTap = 0;
let isPanning = false;

function inicializarGestos() {
  const wrapper = document.getElementById('zoomWrapper');
  if (!wrapper) return;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0], t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartZoom = zoomActual;
      isPanning = false;
    } else if (e.touches.length === 1) {
      const ahora = Date.now();
      if (ahora - lastTap < 300) {
        resetearZoom();
        lastTap = 0;
        return;
      }
      lastTap = ahora;
      if (zoomActual > 1.05) {
        isPanning = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartPanX = panX;
        touchStartPanY = panY;
      }
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDist;
      zoomActual = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, touchStartZoom * ratio));
      aplicarTransform();
    } else if (e.touches.length === 1 && isPanning) {
      e.preventDefault();
      panX = touchStartPanX + (e.touches[0].clientX - touchStartX);
      panY = touchStartPanY + (e.touches[0].clientY - touchStartY);
      aplicarTransform();
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    isPanning = false;
    touchStartDist = 0;
  }, { passive: true });
}

// ============================================
// TESSERACT
// ============================================
async function inicializarTesseract() {
  if (workerTesseract) return workerTesseract;
  let basePath = window.location.href;
  basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
  workerTesseract = await Tesseract.createWorker('spa+eng', 1, {
    workerPath: basePath + 'tesseract/worker.min.js',
    langPath: basePath + 'tesseract/lang-data',
    corePath: basePath + 'tesseract/',
    workerBlobURL: false,
    cacheMethod: 'none',
    gzip: false,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        setProgreso(30 + Math.round(pct * 0.4), `Reconociendo: ${pct}%`);
      }
    }
  });
  return workerTesseract;
}

// ============================================
// LIMPIAR
// ============================================
function limpiarTodo() {
  rutaImagenActual = null;
  matrizDatos = [];
  window.MAR.imagenOriginal = null;
  window.MAR.imagenOriginalCanvas = null;
  
  document.getElementById('imgPreview').src = '';
  document.getElementById('previewContainer').style.display = 'none';
  document.getElementById('procesoContainer').style.display = 'none';
  document.getElementById('debugContainer').style.display = 'none';
  document.getElementById('sliderMediana').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('tableWrapper').innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
  document.getElementById('debugTexto').textContent = '';
  document.getElementById('contadorV').textContent = '0 verticales';
  document.getElementById('contadorH').textContent = '0 horizontales';
  
  const canvas = document.getElementById('deteccionCanvas');
  if (canvas) { canvas.width = 0; canvas.height = 0; }
  
  resetearZoom();
  
  for (let i = 1; i <= 9; i++) {
    const est = document.getElementById('estado-paso' + i);
    if (est) est.textContent = '⏳';
    const item = document.getElementById('btn-paso' + i);
    if (item) item.classList.remove('paso-ejecutado', 'paso-ejecutando', 'paso-error');
  }
  
  mostrarStatus('🗑️ Limpiado', 'info');
}

// ============================================
// EXPORTAR
// ============================================
async function copiarAlPortapapeles() {
  if (!matrizDatos.length) { alert('No hay datos.'); return; }
  const tsv = matrizDatos.map(r => r.join('\t')).join('\n');
  try {
    if (window.Capacitor?.Plugins?.Clipboard) {
      await window.Capacitor.Plugins.Clipboard.write({ string: tsv });
    } else {
      await navigator.clipboard.writeText(tsv);
    }
    mostrarStatus('✅ Copiado', 'success');
  } catch (e) { alert('Error: ' + e.message); }
}

function exportarCSV() {
  if (!matrizDatos.length) { alert('No hay datos.'); return; }
  const csv = matrizDatos.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tabla.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportarExcel() {
  if (!matrizDatos.length) { alert('No hay datos.'); return; }
  let html = '<html><head><meta charset="UTF-8"></head><body><table>';
  matrizDatos.forEach(row => {
    html += '<tr>';
    row.forEach(cell => { html += `<td>${cell || ''}</td>`; });
    html += '</tr>';
  });
  html += '</table></body></html>';
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tabla.xls'; a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MAR Caribe v9.0');

  document.getElementById('dropZone')?.addEventListener('click', capturarImagen);
  document.getElementById('fileInput')?.addEventListener('change', cargarDesdeInput);
  document.getElementById('btnCamera')?.addEventListener('click', capturarImagen);
  document.getElementById('btnLimpiar')?.addEventListener('click', limpiarTodo);
  document.getElementById('btnCopiarTabla')?.addEventListener('click', copiarAlPortapapeles);
  document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV);
  document.getElementById('btnExportarExcel')?.addEventListener('click', exportarExcel);

  document.getElementById('btnZoomIn')?.addEventListener('click', zoomIn);
  document.getElementById('btnZoomOut')?.addEventListener('click', zoomOut);
  document.getElementById('btnToggleLineas')?.addEventListener('click', toggleLineas);
  document.getElementById('btnZoomReset')?.addEventListener('click', resetearZoom);

  // Slider de mediana
  const sliderMed = document.getElementById('param-mediana');
  const valMed = document.getElementById('valMediana');
  const nombresMed = ['Sin filtro', 'Suave', 'Medio', 'Fuerte'];
  
  if (sliderMed) {
    sliderMed.addEventListener('input', () => {
      const idx = parseInt(sliderMed.value);
      if (valMed) valMed.textContent = nombresMed[idx];
    });
    sliderMed.addEventListener('change', () => {
      const idx = parseInt(sliderMed.value);
      PARAMS_PASO1.INDICE_VENTANA = idx;
      PARAMS_PASO1.TAMANO_VENTANA = [1, 3, 5, 7][idx];
      if (window.MAR.paso1 && window.MAR.paso1.ejecutado) {
        ejecutarYDebug(ejecutarPaso1, debugPaso1, 'paso1');
      }
    });
  }

  inicializarGestos();
  mostrarStatus('📷 Carga una imagen', 'info');
});

// Mostrar botón flotante cuando hay imagen cargada
const _cargarOriginal = cargarEnCanvas;
cargarEnCanvas = function(src) {
  _cargarOriginal(src);
  setTimeout(() => {
    const btn = document.getElementById('btnAjustesFlotante');
    if (btn) btn.style.display = 'flex';
  }, 500);
};
