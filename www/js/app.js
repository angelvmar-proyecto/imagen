// ============================================
// MAR Caribe v6.1 - App principal
// ============================================

let rutaImagenActual = null;
let matrizDatos = [];
let procesando = false;
let workerTesseract = null;

// ============================================
// UI - PROGRESO Y ESTADO
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
    if (typeof resetearZoom === 'function') resetearZoom();
    mostrarStatus('✅ Imagen cargada. Ve a "🔧 Proceso" para ejecutar los pasos.', 'success');
  };
}

// ============================================
// TESSERACT
// ============================================
async function inicializarTesseract() {
  if (workerTesseract) return workerTesseract;
  console.log('🔧 Inicializando Tesseract...');
  try {
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
        } else if (m.status === 'loading language traineddata') {
          setProgreso(20, 'Cargando idiomas...');
        } else if (m.status === 'initializing api') {
          setProgreso(25, 'Inicializando API...');
        }
      }
    });
    console.log('✅ Tesseract listo');
    return workerTesseract;
  } catch (e) {
    console.error('❌ Error:', e);
    throw new Error('No se pudo iniciar Tesseract: ' + e.message);
  }
}

// ============================================
// ZOOM (simplificado)
// ============================================
let zoomActual = 1.0;
let panX = 0, panY = 0;
const ZOOM_MIN = 1.0, ZOOM_MAX = 15.0;

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
  canvas.style.opacity = canvas.style.opacity === '0' ? '1' : '0';
}

// ============================================
// LIMPIAR
// ============================================
function limpiarTodo() {
  rutaImagenActual = null;
  matrizDatos = [];
  window.MAR = {};
  document.getElementById('imgPreview').src = '';
  document.getElementById('previewContainer').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('tableWrapper').innerHTML = '<div class="empty-state">📊 Sin datos</div>';
  resetearZoom();
  mostrarStatus('🗑️ Limpiado', 'info');
  // Resetear estados de pasos
  for (let i = 1; i <= 10; i++) {
    const est = document.getElementById('estado-paso' + i);
    if (est) est.textContent = '⏳';
    const item = document.getElementById('paso-' + i);
    if (item) item.classList.remove('paso-ejecutado');
  }
  const dbg = document.getElementById('debugPanel');
  if (dbg) dbg.style.display = 'none';
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
  a.href = url;
  a.download = 'tabla.csv';
  a.click();
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
  a.href = url;
  a.download = 'tabla.xls';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MAR Caribe v6.1');

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

  mostrarStatus('📷 Carga una imagen', 'info');
});
