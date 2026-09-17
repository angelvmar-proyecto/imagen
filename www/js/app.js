// ============================================
// MAR Caribe v3.3 - Tesseract.js v5 LOCAL
// 100% Offline · Detección por coordenadas
// ============================================

let rutaImagenActual = null;
let matrizDatos = [];
let porcentajesCorte = [];
let palabrasDetectadas = [];
let numColumnasDetectadas = 0;
let tiposColumnas = [];
let procesando = false;
let workerTesseract = null;

// ============================================
// DETECCIÓN DE TIPOS DE DATOS
// ============================================
function detectarTipoColumna(valores) {
  if (!valores || valores.length === 0) return 'texto';
  let esNumero = 0, esFecha = 0, esHora = 0, esMoneda = 0, esTexto = 0;
  for (const v of valores) {
    if (!v || v.trim() === '') continue;
    const t = v.trim();
    if (/^[\d,\.]+$/.test(t)) esNumero++;
    else if (/\d{1,2}[\/\-]\d{1,2}/.test(t)) esFecha++;
    else if (/\d{1,2}[:\.]\d{2}/.test(t)) esHora++;
    else if (/USD|MXN|\$/i.test(t)) esMoneda++;
    else esTexto++;
  }
  const total = valores.filter(v => v && v.trim()).length;
  if (total === 0) return 'texto';
  if (esNumero / total > 0.6) return 'numero';
  if (esFecha / total > 0.6) return 'fecha';
  if (esHora / total > 0.6) return 'hora';
  if (esMoneda / total > 0.6) return 'moneda';
  return 'texto';
}

function aplicarReglasFuzzy(valRaw, tipo) {
  if (!valRaw) return '';
  let t = valRaw.replace(/[|¦\\]/g, '').trim();
  switch (tipo) {
    case 'numero': return t.replace(/[^0-9]/g, '');
    case 'decimal': return t.replace(/[^0-9.]/g, '');
    case 'fecha':
      const fm = t.match(/(\d{1,2})[\/\-](\d{1,2})/);
      return fm ? fm[0] : t;
    case 'hora':
      const hm = t.match(/(\d{1,2})[:\.](\d{2})/);
      return hm ? hm[0] : t;
    case 'moneda':
      if (/USD|US|\$/i.test(t)) return 'USD';
      if (/MXN|MX|PESO/i.test(t)) return 'MXN';
      return t;
    default: return t;
  }
}

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
    inicializarRejilla();
    mostrarStatus('✅ Imagen cargada. Toca "Escanear".', 'success');
  };
}

// ============================================
// REJILLA
// ============================================
function inicializarRejilla() {
  const img = document.getElementById('imgPreview');
  const canvas = document.getElementById('gridCanvas');
  if (!img || !canvas || !img.clientWidth) return;
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  if (porcentajesCorte.length === 0) {
    for (let i = 1; i <= 19; i++) porcentajesCorte.push(Number((i / 20).toFixed(3)));
  }
  dibujarLineas();
}

function dibujarLineas() {
  const canvas = document.getElementById('gridCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#d97706';
  ctx.setLineDash([4, 4]);
  porcentajesCorte.forEach(pct => {
    const x = Math.floor(pct * canvas.width) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function obtenerCanvasDeImagen() {
  const imgElement = document.getElementById('imgPreview');
  if (!imgElement || !imgElement.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  canvas.getContext('2d').drawImage(imgElement, 0, 0);
  return canvas;
}

// ============================================
// CLUSTERING
// ============================================
function inicializarClusters(datos, k) {
  if (datos.length === 0) return [];
  datos.sort((a, b) => a - b);
  const clusters = [];
  const step = Math.floor(datos.length / Math.min(k, datos.length));
  for (let i = 0; i < Math.min(k, datos.length); i++) {
    clusters.push({ centro: datos[Math.min(i * step, datos.length - 1)], puntos: [] });
  }
  return clusters;
}

function asignarYActualizarClusters(datos, clusters) {
  if (clusters.length === 0 || datos.length === 0) return clusters;
  clusters.forEach(c => c.puntos = []);
  datos.forEach(d => {
    let cercano = clusters[0];
    let minDist = Math.abs(d - clusters[0].centro);
    for (let i = 1; i < clusters.length; i++) {
      const dist = Math.abs(d - clusters[i].centro);
      if (dist < minDist) { minDist = dist; cercano = clusters[i]; }
    }
    cercano.puntos.push(d);
  });
  return clusters.map(c => {
    if (c.puntos.length === 0) return c;
    const suma = c.puntos.reduce((a, b) => a + b, 0);
    return { centro: suma / c.puntos.length, puntos: [] };
  });
}

// ============================================
// TESSERACT.JS v5 - LOCAL Y OFFLINE
// ============================================
async function inicializarTesseract() {
  if (workerTesseract) return workerTesseract;

  console.log('🔧 Inicializando Tesseract.js v5 LOCAL...');

  try {
    // Detectar la ruta base (funciona en http://localhost y en file://)
    let basePath = window.location.href;
    // Quitar el nombre del archivo (index.html)
    basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);

    console.log('🔗 Base path:', basePath);

    workerTesseract = await Tesseract.createWorker('spa+eng', 1, {
      // Ruta del worker
      workerPath: basePath + 'tesseract/worker.min.js',
      // Ruta de los idiomas
      langPath: basePath + 'tesseract/lang-data',
      // Ruta del core WASM
      corePath: basePath + 'tesseract/',
      // Desactivar blob para WebView Android
      workerBlobURL: false,
      // Sin caché (carga desde archivos locales)
      cacheMethod: 'none',
      // Los archivos NO están comprimidos (.traineddata sin .gz)
      gzip: false,
      // Logs de progreso
      logger: (m) => {
        console.log('Tesseract:', m.status, Math.round((m.progress || 0) * 100) + '%');
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          setProgreso(30 + Math.round(pct * 0.4), `Reconociendo texto: ${pct}%`);
        } else if (m.status === 'loading language traineddata') {
          setProgreso(20, 'Cargando idiomas...');
        } else if (m.status === 'initializing api') {
          setProgreso(25, 'Inicializando API...');
        } else if (m.status === 'loading tesseract core') {
          setProgreso(15, 'Cargando motor...');
        }
      }
    });

    console.log('✅ Tesseract v5 local listo');
    return workerTesseract;
  } catch (e) {
    console.error('❌ Error inicializando Tesseract:', e);
    throw new Error('No se pudo iniciar Tesseract: ' + e.message);
  }
}

async function ejecutarOCR(canvasElement) {
  const worker = await inicializarTesseract();
  const { data } = await worker.recognize(canvasElement);
  return data;
}

// ============================================
// ESCANEO PRINCIPAL
// ============================================
async function ejecutarEscaneoCompleto() {
  if (!rutaImagenActual) { alert('📷 Carga una imagen primero.'); return; }
  if (procesando) return;
  procesando = true;

  try {
    setProgreso(10, 'Preparando imagen...');
    const canvasElement = obtenerCanvasDeImagen();
    if (!canvasElement) throw new Error('No se pudo obtener el canvas');

    setProgreso(15, 'Inicializando motor OCR...');
    const data = await ejecutarOCR(canvasElement);

    if (!data || !data.words || data.words.length < 5) {
      alert('⚠️ No se detectó suficiente texto en la imagen.');
      ocultarProgreso();
      procesando = false;
      return;
    }

    setProgreso(70, 'Procesando coordenadas...');
    const widthImg = canvasElement.width;

    let palabras = data.words
      .filter(w => w.confidence > 30 && w.text.trim().length > 0)
      .map(w => ({
        text: w.text.trim(),
        x: (w.bbox.x0 + w.bbox.x1) / 2,
        y: (w.bbox.y0 + w.bbox.y1) / 2
      }));

    palabrasDetectadas = palabras;
    console.log(`📝 Palabras: ${palabras.length}`);

    // CLUSTERING EN X (COLUMNAS)
    setProgreso(75, 'Detectando columnas...');
    const xs = palabras.map(p => p.x);
    const numClustersX = Math.min(Math.max(Math.round(Math.sqrt(palabras.length / 2)), 3), 30);
    let clustersX = inicializarClusters(xs, numClustersX);
    for (let i = 0; i < 12; i++) clustersX = asignarYActualizarClusters(xs, clustersX);
    let centrosX = clustersX.filter(c => c.puntos.length > 0).map(c => c.centro).sort((a, b) => a - b);
    numColumnasDetectadas = centrosX.length;
    console.log(`📊 Columnas: ${numColumnasDetectadas}`);

    const nuevosCortes = [];
    for (let i = 0; i < centrosX.length - 1; i++) {
      nuevosCortes.push((centrosX[i] + centrosX[i + 1]) / 2);
    }
    porcentajesCorte = nuevosCortes.map(c => Number((c / widthImg).toFixed(3)));
    dibujarLineas();

    // AGRUPAR POR FILAS
    setProgreso(85, 'Agrupando filas...');
    palabras.sort((a, b) => a.y - b.y);
    const filas = [];
    palabras.forEach(p => {
      let fila = filas.find(f => Math.abs(f.yCentro - p.y) < 18);
      if (fila) fila.palabras.push(p);
      else filas.push({ yCentro: p.y, palabras: [p] });
    });

    // CONSTRUIR MATRIZ
    setProgreso(90, 'Construyendo tabla...');
    const limitesX = [0, ...porcentajesCorte.map(p => p * widthImg), widthImg];
    matrizDatos = filas.map(fila => {
      const filaCols = new Array(numColumnasDetectadas).fill('');
      fila.palabras.forEach(p => {
        let colIdx = limitesX.findIndex((lim, i) => i > 0 && p.x <= lim) - 1;
        if (colIdx < 0) colIdx = 0;
        if (colIdx >= numColumnasDetectadas) colIdx = numColumnasDetectadas - 1;
        filaCols[colIdx] = filaCols[colIdx] ? filaCols[colIdx] + ' ' + p.text : p.text;
      });
      return filaCols;
    });

    // TIPOS Y LIMPIEZA
    setProgreso(95, 'Limpiando datos...');
    tiposColumnas = [];
    for (let j = 0; j < numColumnasDetectadas; j++) {
      const colValues = matrizDatos.map(row => row[j]).filter(v => v && v.trim());
      tiposColumnas.push(detectarTipoColumna(colValues));
    }
    for (let i = 0; i < matrizDatos.length; i++) {
      for (let j = 0; j < matrizDatos[i].length; j++) {
        matrizDatos[i][j] = aplicarReglasFuzzy(matrizDatos[i][j], tiposColumnas[j] || 'texto');
      }
    }

    // MOSTRAR
    const textoExtraido = matrizDatos.map(row => row.join('\t')).join('\n');
    document.getElementById('textoOCR').textContent = textoExtraido;
    document.getElementById('resultadoTexto').classList.add('show');
    document.getElementById('lineCount').textContent = `(${matrizDatos.length} filas)`;

    renderizarMatriz();
    document.getElementById('badgeTabla').style.display = 'inline';
    agregarAlHistorial(textoExtraido, matrizDatos.length, numColumnasDetectadas);

    setProgreso(100, '¡Completado!');
    mostrarStatus(`✅ ${matrizDatos.length} filas, ${numColumnasDetectadas} columnas`, 'success');

    setTimeout(() => cambiarPestania('tabla'), 800);
    setTimeout(ocultarProgreso, 1500);
    procesando = false;

  } catch (err) {
    console.error('❌ Error:', err);
    mostrarStatus('❌ Error: ' + (err.message || err), 'error');
    ocultarProgreso();
    procesando = false;
  }
}

// ============================================
// RENDERIZAR MATRIZ
// ============================================
function renderizarMatriz() {
  const wrapper = document.getElementById('tableWrapper');
  if (!wrapper) return;
  if (!matrizDatos || matrizDatos.length === 0) {
    wrapper.innerHTML = '<div class="empty-state">📊 No hay datos.</div>';
    return;
  }
  const numCols = matrizDatos[0] ? matrizDatos[0].length : 0;
  let html = '<div class="tabla-wrapper"><table class="tabla-resultado"><thead><tr>';
  for (let j = 0; j < numCols; j++) {
    const tipo = tiposColumnas[j] || 'texto';
    html += `<th>Col ${j + 1} <span class="col-badge">${tipo}</span></th>`;
  }
  html += '</tr></thead><tbody>';
  for (let i = 0; i < matrizDatos.length; i++) {
    html += '<tr>';
    for (let j = 0; j < numCols; j++) {
      const v = matrizDatos[i][j] || '';
      html += `<td contenteditable="true" data-row="${i}" data-col="${j}" class="${!v ? 'vacio' : ''}">${v}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('td[contenteditable="true"]').forEach(td => {
    td.addEventListener('input', function () {
      const r = parseInt(this.dataset.row);
      const c = parseInt(this.dataset.col);
      if (matrizDatos[r] && matrizDatos[r][c] !== undefined) {
        matrizDatos[r][c] = this.innerText.trim();
      }
    });
  });
  actualizarInfo();
}

function actualizarInfo() {
  const info = document.getElementById('infoExtra');
  if (!info) return;
  const f = matrizDatos.length;
  const c = matrizDatos[0] ? matrizDatos[0].length : 0;
  info.innerText = `📊 ${f} filas · ${c} columnas · ${f * c} celdas`;
}

function filtrarMatriz() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#tableWrapper tbody tr').forEach(tr => {
    tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

function limpiarFiltro() {
  document.getElementById('searchInput').value = '';
  filtrarMatriz();
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
  mostrarStatus('✅ CSV descargado', 'success');
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
  mostrarStatus('✅ Excel descargado', 'success');
}

function compartirWhatsApp() {
  if (!matrizDatos.length) { alert('No hay datos.'); return; }
  const txt = matrizDatos.map(r => r.join('\t')).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

// ============================================
// HISTORIAL
// ============================================
function agregarAlHistorial(texto, filas, columnas) {
  try {
    const h = JSON.parse(localStorage.getItem('marCaribeHistorial') || '[]');
    h.unshift({ fecha: new Date().toLocaleString('es-MX'), texto: texto.substring(0, 150) + '...', filas, columnas });
    if (h.length > 20) h.pop();
    localStorage.setItem('marCaribeHistorial', JSON.stringify(h));
    renderizarHistorial();
  } catch (e) {}
}

function renderizarHistorial() {
  const c = document.getElementById('listaHistorial');
  if (!c) return;
  try {
    const h = JSON.parse(localStorage.getItem('marCaribeHistorial') || '[]');
    if (!h.length) { c.innerHTML = '<div class="empty-state">📋 Sin historial</div>'; return; }
    c.innerHTML = h.map(item => `
      <div style="background:white;border-radius:8px;padding:10px;margin-bottom:8px;border:1px solid #e0e0e0;">
        <p style="font-size:0.75rem;color:#636e72;margin-bottom:4px;">🕐 ${item.fecha} · ${item.filas || 0} filas · ${item.columnas || 0} columnas</p>
        <p style="font-size:0.8rem;white-space:pre-wrap;line-height:1.4;">${item.texto}</p>
      </div>
    `).join('');
  } catch (e) { c.innerHTML = '<div class="empty-state">Error</div>'; }
}

// ============================================
// LIMPIAR
// ============================================
function limpiarTodo() {
  rutaImagenActual = null;
  matrizDatos = [];
  porcentajesCorte = [];
  palabrasDetectadas = [];
  numColumnasDetectadas = 0;
  tiposColumnas = [];
  document.getElementById('imgPreview').src = '';
  document.getElementById('previewContainer').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('tableWrapper').innerHTML = '<div class="empty-state">📊 Esperando extracción...</div>';
  document.getElementById('resultadoTexto').classList.remove('show');
  document.getElementById('badgeTabla').style.display = 'none';
  document.getElementById('searchInput').value = '';
  actualizarInfo();
  mostrarStatus('🗑️ Limpiado', 'info');
}

// ============================================
// PESTAÑAS
// ============================================
function cambiarPestania(target) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${target}"]`).classList.add('active');
  document.getElementById('tab-' + target).classList.add('active');
  if (target === 'historial') renderizarHistorial();
  if (target === 'tabla') document.getElementById('badgeTabla').style.display = 'none';
}

// ============================================
// COMPARTIR DESDE WHATSAPP
// ============================================
async function recibirCompartir() {
  try {
    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('appUrlOpen', async (data) => {
        if (data.url.startsWith('content://') || data.url.startsWith('file://')) {
          const fs = window.Capacitor.Plugins.Filesystem;
          const result = await fs.readFile({ path: data.url, directory: 'DOCUMENTS' });
          if (result && result.data) {
            const base64 = 'data:image/jpeg;base64,' + result.data;
            document.getElementById('notificacionCompartir').style.display = 'block';
            cargarEnCanvas(base64);
            setTimeout(() => {
              document.getElementById('notificacionCompartir').style.display = 'none';
              ejecutarEscaneoCompleto();
            }, 1500);
          }
        }
      });
    }
  } catch (e) { console.error('Compartir:', e); }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MAR Caribe v3.3 - Tesseract.js v5 LOCAL');
  document.getElementById('dropZone').addEventListener('click', capturarImagen);
  document.getElementById('fileInput').addEventListener('change', cargarDesdeInput);
  document.getElementById('btnCamera').addEventListener('click', capturarImagen);
  document.getElementById('btnOCR').addEventListener('click', ejecutarEscaneoCompleto);
  document.getElementById('btnLimpiar').addEventListener('click', limpiarTodo);
  document.getElementById('btnCopiarTabla').addEventListener('click', copiarAlPortapapeles);
  document.getElementById('btnExportarCSV').addEventListener('click', exportarCSV);
  document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
  document.getElementById('btnCopiarTexto').addEventListener('click', () => {
    const t = document.getElementById('textoOCR').innerText;
    if (t) { navigator.clipboard.writeText(t); mostrarStatus('✅ Copiado', 'success'); }
  });
  document.getElementById('btnCompartirWA').addEventListener('click', compartirWhatsApp);
  document.getElementById('btnBuscar').addEventListener('click', filtrarMatriz);
  document.getElementById('btnLimpiarFiltro').addEventListener('click', limpiarFiltro);
  document.getElementById('searchInput').addEventListener('input', filtrarMatriz);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => cambiarPestania(tab.dataset.tab));
  });
  renderizarHistorial();
  if (window.Capacitor?.isNativePlatform?.()) setTimeout(recibirCompartir, 500);
  mostrarStatus('📷 Carga una imagen o comparte desde WhatsApp', 'info');
});

// ============================================
// v4.0 - BOTONES DE DETECCIÓN DE LÍNEAS
// ============================================

let lineasVerticales = [];
let lineasHorizontales = [];

// Botón: Detectar Líneas
async function onDetectarLineas() {
  if (!rutaImagenActual) {
    alert('📷 Carga una imagen primero.');
    return;
  }
  if (procesando) return;
  procesando = true;

  try {
    setProgreso(10, 'Preparando imagen...');

    // Crear canvas con la imagen original
    const img = document.getElementById('imgPreview');
    const canvasOriginal = document.createElement('canvas');
    canvasOriginal.width = img.naturalWidth;
    canvasOriginal.height = img.naturalHeight;
    canvasOriginal.getContext('2d').drawImage(img, 0, 0);

    setProgreso(30, 'Ejecutando 4 algoritmos...');

    // Ejecutar detección
    const resultado = await detectarLineasConAlgoritmos(canvasOriginal);

    lineasVerticales = resultado.verticales;
    lineasHorizontales = resultado.horizontales;

    setProgreso(80, 'Dibujando líneas...');

    // Dibujar sobre el canvas de detección
    const canvasDeteccion = document.getElementById('deteccionCanvas');
    canvasDeteccion.width = img.clientWidth;
    canvasDeteccion.height = img.clientHeight;

    // Escalar las líneas al tamaño mostrado
    const escalaX = img.clientWidth / img.naturalWidth;
    const escalaY = img.clientHeight / img.naturalHeight;

    const verticalesEscaladas = lineasVerticales.map(v => ({
      posicion: v.posicion * escalaX,
      votos: v.votos
    }));
    const horizontalesEscaladas = lineasHorizontales.map(h => ({
      posicion: h.posicion * escalaY,
      votos: h.votos
    }));

    dibujarLineasDeteccion(canvasDeteccion, verticalesEscaladas, horizontalesEscaladas);

    // Actualizar contador
    document.getElementById('contadorVerticales').textContent =
      `${lineasVerticales.length} verticales`;
    document.getElementById('contadorHorizontales').textContent =
      `${lineasHorizontales.length} horizontales`;
    document.getElementById('contadorLineas').style.display = 'flex';

    setProgreso(100, '¡Detección completada!');
    mostrarStatus(
      `✅ ${lineasVerticales.length} verticales, ${lineasHorizontales.length} horizontales`,
      'success'
    );

    setTimeout(ocultarProgreso, 1500);
    procesando = false;

  } catch (err) {
    console.error('❌ Error en detección:', err);
    mostrarStatus('❌ Error: ' + (err.message || err), 'error');
    ocultarProgreso();
    procesando = false;
  }
}

// Botón: Preparar OCR (placeholder para siguiente fase)
async function onPrepararOCR() {
  if (lineasVerticales.length === 0 && lineasHorizontales.length === 0) {
    alert('⚠️ Primero toca "Detectar Líneas".');
    return;
  }
  mostrarStatus('🧹 Preparación para OCR (siguiente fase)...', 'info');
  alert('🎯 Detección lista. La conversión a negro + limpieza será la siguiente fase.');
}

// Registrar eventos (solo si los botones existen)
document.addEventListener('DOMContentLoaded', () => {
  const btnDetectar = document.getElementById('btnDetectar');
  const btnPreparar = document.getElementById('btnPreparar');
  if (btnDetectar) btnDetectar.addEventListener('click', onDetectarLineas);
  if (btnPreparar) btnPreparar.addEventListener('click', onPrepararOCR);
});

// ============================================
// v4.1 - ZOOM Y PAN
// ============================================

let zoomActual = 1.0;
let panX = 0;
let panY = 0;
let zoomMin = 1.0;
let zoomMax = 6.0;
let lineasOcultas = false;

// Actualizar transform del contenido
function aplicarTransform() {
  const content = document.getElementById('zoomContent');
  if (!content) return;
  content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomActual})`;

  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoomActual.toFixed(1) + 'x';
}

// Resetear zoom y posición
function resetearZoom() {
  zoomActual = 1.0;
  panX = 0;
  panY = 0;
  aplicarTransform();
}

// Zoom in (+0.5)
function zoomIn() {
  const nuevoZoom = Math.min(zoomActual + 0.5, zoomMax);
  if (nuevoZoom !== zoomActual) {
    zoomActual = nuevoZoom;
    aplicarTransform();
  }
}

// Zoom out (-0.5)
function zoomOut() {
  const nuevoZoom = Math.max(zoomActual - 0.5, zoomMin);
  if (nuevoZoom !== zoomActual) {
    zoomActual = nuevoZoom;
    if (zoomActual === 1.0) {
      panX = 0;
      panY = 0;
    }
    aplicarTransform();
  }
}

// Toggle líneas de detección
function toggleLineas() {
  const canvas = document.getElementById('deteccionCanvas');
  if (!canvas) return;
  lineasOcultas = !lineasOcultas;
  canvas.style.opacity = lineasOcultas ? '0' : '1';
  const btn = document.getElementById('btnToggleLineas');
  if (btn) btn.textContent = lineasOcultas ? '👁️‍🗨️' : '👁️';
}

// ============================================
// GESTOS TÁCTILES
// ============================================
let touchStartDist = 0;
let touchStartZoom = 1.0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartPanX = 0;
let touchStartPanY = 0;
let lastTap = 0;
let isPanning = false;

function inicializarGestos() {
  const wrapper = document.getElementById('zoomWrapper');
  if (!wrapper) return;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Pellizco
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartZoom = zoomActual;
      isPanning = false;
    } else if (e.touches.length === 1) {
      // Detectar doble toque
      const ahora = Date.now();
      if (ahora - lastTap < 300) {
        // Doble toque detectado
        resetearZoom();
        lastTap = 0;
        return;
      }
      lastTap = ahora;

      // Pan
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
      // Pellizco activo
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDist;
      let nuevoZoom = touchStartZoom * ratio;
      nuevoZoom = Math.max(zoomMin, Math.min(zoomMax, nuevoZoom));
      zoomActual = nuevoZoom;
      aplicarTransform();
    } else if (e.touches.length === 1 && isPanning) {
      // Pan activo
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      panX = touchStartPanX + dx;
      panY = touchStartPanY + dy;
      aplicarTransform();
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    isPanning = false;
    touchStartDist = 0;
  }, { passive: true });

  // Zoom con rueda del ratón (para pruebas en navegador)
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }, { passive: false });
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnToggleLineas = document.getElementById('btnToggleLineas');
  const btnZoomReset = document.getElementById('btnZoomReset');

  if (btnZoomIn) btnZoomIn.addEventListener('click', zoomIn);
  if (btnZoomOut) btnZoomOut.addEventListener('click', zoomOut);
  if (btnToggleLineas) btnToggleLineas.addEventListener('click', toggleLineas);
  if (btnZoomReset) btnZoomReset.addEventListener('click', resetearZoom);

  inicializarGestos();
});
