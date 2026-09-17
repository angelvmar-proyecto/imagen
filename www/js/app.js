// ============================================
// MAR Caribe v5.0 - Zoom + Preparar OCR + Tesseract
// ============================================

let rutaImagenActual = null;
let matrizDatos = [];
let palabrasDetectadas = [];
let numColumnasDetectadas = 0;
let tiposColumnas = [];
let procesando = false;
let workerTesseract = null;
let lineasVerticales = [];
let lineasHorizontales = [];

// Zoom
let zoomActual = 1.0;
let panX = 0;
let panY = 0;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 15.0;
let lineasOcultas = false;

// Imagen limpia para OCR
let canvasLimpio = null;

// ============================================
// TIPOS DE DATOS
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
    // Resetear zoom
    zoomActual = 1.0;
    panX = 0;
    panY = 0;
    aplicarTransform();
    // Limpiar canvas de detección previa
    const canvas = document.getElementById('deteccionCanvas');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    lineasVerticales = [];
    lineasHorizontales = [];
    document.getElementById('contadorLineas').style.display = 'none';
    mostrarStatus('✅ Imagen cargada. Toca "Detectar Líneas".', 'success');
  };
}

// ============================================
// ZOOM Y PAN
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
  const nuevoZoom = Math.min(zoomActual + 1.0, ZOOM_MAX);
  if (nuevoZoom !== zoomActual) {
    zoomActual = nuevoZoom;
    aplicarTransform();
  }
}

function zoomOut() {
  const nuevoZoom = Math.max(zoomActual - 1.0, ZOOM_MIN);
  if (nuevoZoom !== zoomActual) {
    zoomActual = nuevoZoom;
    if (zoomActual === 1.0) { panX = 0; panY = 0; }
    aplicarTransform();
  }
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
      const t1 = e.touches[0];
      const t2 = e.touches[1];
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
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDist;
      let nuevoZoom = touchStartZoom * ratio;
      nuevoZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nuevoZoom));
      zoomActual = nuevoZoom;
      aplicarTransform();
    } else if (e.touches.length === 1 && isPanning) {
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

  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, { passive: false });
}

// ============================================
// TESSERACT.JS v5 - LOCAL
// ============================================
async function inicializarTesseract() {
  if (workerTesseract) return workerTesseract;
  console.log('🔧 Inicializando Tesseract.js v5 LOCAL...');
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
// DETECTAR LÍNEAS (4 ALGORITMOS)
// ============================================
async function onDetectarLineas() {
  if (!rutaImagenActual) { alert('📷 Carga una imagen primero.'); return; }
  if (procesando) return;
  procesando = true;

  try {
    setProgreso(10, 'Preparando imagen...');
    const img = document.getElementById('imgPreview');
    const canvasOriginal = document.createElement('canvas');
    canvasOriginal.width = img.naturalWidth;
    canvasOriginal.height = img.naturalHeight;
    canvasOriginal.getContext('2d').drawImage(img, 0, 0);

    setProgreso(30, 'Ejecutando 4 algoritmos...');
    const resultado = await detectarLineasConAlgoritmos(canvasOriginal);

    lineasVerticales = resultado.verticales;
    lineasHorizontales = resultado.horizontales;

    setProgreso(80, 'Dibujando líneas...');

    const canvasDeteccion = document.getElementById('deteccionCanvas');
    canvasDeteccion.width = img.clientWidth;
    canvasDeteccion.height = img.clientHeight;

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

    document.getElementById('contadorVerticales').textContent = `${lineasVerticales.length} verticales`;
    document.getElementById('contadorHorizontales').textContent = `${lineasHorizontales.length} horizontales`;
    document.getElementById('contadorLineas').style.display = 'flex';

    setProgreso(100, '¡Detección completada!');
    mostrarStatus(`✅ ${lineasVerticales.length} verticales, ${lineasHorizontales.length} horizontales`, 'success');
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
// PREPARAR OCR - Convertir líneas a negro + limpieza
// ============================================
async function onPrepararOCR() {
  if (!rutaImagenActual) { alert('📷 Carga una imagen primero.'); return; }
  if (lineasVerticales.length === 0 && lineasHorizontales.length === 0) {
    alert('⚠️ Primero toca "Detectar Líneas".');
    return;
  }
  if (procesando) return;
  procesando = true;

  try {
    setProgreso(10, 'Creando imagen limpia...');

    const img = document.getElementById('imgPreview');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    setProgreso(30, 'Dibujando líneas en negro...');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    // Líneas verticales
    for (const v of lineasVerticales) {
      const x = v.posicion;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Líneas horizontales
    for (const h of lineasHorizontales) {
      const y = h.posicion;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    setProgreso(50, 'Aplicando binarización...');

    // Binarización: píxeles claros → blanco, oscuros → negro
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminancia > 180) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    setProgreso(70, 'Eliminando manchas pequeñas...');
    eliminarBlobsPequeños(canvas, 4);

    // Guardar canvas limpio
    canvasLimpio = canvas;

    setProgreso(90, 'Mostrando resultado...');

    // Mostrar la imagen limpia en el preview
    const imgPreview = document.getElementById('imgPreview');
    imgPreview.src = canvas.toDataURL('image/png');

    // Ocultar el canvas de detección (ya no aplica)
    const canvasDeteccion = document.getElementById('deteccionCanvas');
    if (canvasDeteccion) {
      canvasDeteccion.width = 0;
      canvasDeteccion.height = 0;
    }

    // Resetear zoom
    zoomActual = 1.0;
    panX = 0;
    panY = 0;
    aplicarTransform();

    setProgreso(100, '¡Imagen lista!');
    mostrarStatus('✅ Imagen limpia lista. Toca "Escanear".', 'success');
    setTimeout(ocultarProgreso, 1500);
    procesando = false;

  } catch (err) {
    console.error('❌ Error:', err);
    mostrarStatus('❌ Error: ' + (err.message || err), 'error');
    ocultarProgreso();
    procesando = false;
  }
}

// Eliminar blobs pequeños (manchas)
function eliminarBlobsPequeños(canvas, tamanoMinimo) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const visitado = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visitado[idx]) continue;

      const pIdx = idx * 4;
      if (data[pIdx] > 128) {
        visitado[idx] = 1;
        continue;
      }

      // BFS para encontrar todos los píxeles del mismo blob
      const cola = [[x, y]];
      const blob = [];
      visitado[idx] = 1;

      while (cola.length > 0) {
        const [cx, cy] = cola.shift();
        blob.push([cx, cy]);

        const vecinos = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
        for (const [nx, ny] of vecinos) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visitado[nIdx]) continue;
          visitado[nIdx] = 1;
          const nPIdx = nIdx * 4;
          if (data[nPIdx] <= 128) {
            cola.push([nx, ny]);
          }
        }
      }

      // Si el blob es muy pequeño, eliminarlo
      if (blob.length < tamanoMinimo) {
        for (const [bx, by] of blob) {
          const bIdx = (by * width + bx) * 4;
          data[bIdx] = 255;
          data[bIdx + 1] = 255;
          data[bIdx + 2] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================
// ESCANEAR - Tesseract sobre imagen limpia
// ============================================
async function ejecutarEscaneoCompleto() {
  if (!canvasLimpio && !rutaImagenActual) {
    alert('📷 Carga una imagen primero.');
    return;
  }
  if (procesando) return;
  procesando = true;

  try {
    let canvasParaOCR;
    if (canvasLimpio) {
      // Usar la imagen limpia
      canvasParaOCR = canvasLimpio;
    } else {
      // Usar la imagen original
      const img = document.getElementById('imgPreview');
      canvasParaOCR = document.createElement('canvas');
      canvasParaOCR.width = img.naturalWidth;
      canvasParaOCR.height = img.naturalHeight;
      canvasParaOCR.getContext('2d').drawImage(img, 0, 0);
    }

    setProgreso(15, 'Inicializando Tesseract...');
    const worker = await inicializarTesseract();

    setProgreso(30, 'Reconociendo texto...');
    const { data } = await worker.recognize(canvasParaOCR);

    if (!data || !data.words || data.words.length < 5) {
      alert('⚠️ No se detectó suficiente texto.');
      ocultarProgreso();
      procesando = false;
      return;
    }

    setProgreso(75, 'Asignando a celdas...');

    // Asignar palabras a celdas usando las líneas detectadas
    const widthImg = canvasParaOCR.width;
    const heightImg = canvasParaOCR.height;

    if (lineasVerticales.length > 0 && lineasHorizontales.length > 0) {
      // Usar las líneas detectadas
      const cortesX = lineasVerticales.map(v => v.posicion).sort((a, b) => a - b);
      const cortesY = lineasHorizontales.map(h => h.posicion).sort((a, b) => a - b);

      const numCols = cortesX.length + 1;
      const numFilas = cortesY.length + 1;

      // Crear matriz vacía
      matrizDatos = [];
      for (let i = 0; i < numFilas; i++) {
        matrizDatos.push(new Array(numCols).fill(''));
      }

      // Asignar palabras
      for (const word of data.words) {
        if (!word.text || word.text.trim() === '') continue;
        const cx = (word.bbox.x0 + word.bbox.x1) / 2;
        const cy = (word.bbox.y0 + word.bbox.y1) / 2;

        // Encontrar columna
        let colIdx = 0;
        for (let i = 0; i < cortesX.length; i++) {
          if (cx > cortesX[i]) colIdx = i + 1;
        }

        // Encontrar fila
        let rowIdx = 0;
        for (let i = 0; i < cortesY.length; i++) {
          if (cy > cortesY[i]) rowIdx = i + 1;
        }

        if (rowIdx < matrizDatos.length && colIdx < matrizDatos[rowIdx].length) {
          const actual = matrizDatos[rowIdx][colIdx];
          matrizDatos[rowIdx][colIdx] = actual ? actual + ' ' + word.text : word.text;
        }
      }

      numColumnasDetectadas = numCols;
    } else {
      // Fallback: 1 columna
      matrizDatos = data.text.split('\n').filter(l => l.trim()).map(l => [l.trim()]);
      numColumnasDetectadas = 1;
    }

    // Detectar tipos
    tiposColumnas = [];
    for (let j = 0; j < numColumnasDetectadas; j++) {
      const colValues = matrizDatos.map(row => row[j]).filter(v => v && v.trim());
      tiposColumnas.push(detectarTipoColumna(colValues));
    }

    // Mostrar
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
    td.addEventListener('input', function() {
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
  palabrasDetectadas = [];
  numColumnasDetectadas = 0;
  tiposColumnas = [];
  lineasVerticales = [];
  lineasHorizontales = [];
  canvasLimpio = null;

  document.getElementById('imgPreview').src = '';
  document.getElementById('previewContainer').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('tableWrapper').innerHTML = '<div class="empty-state">📊 Esperando extracción...</div>';
  document.getElementById('resultadoTexto').classList.remove('show');
  document.getElementById('badgeTabla').style.display = 'none';
  document.getElementById('searchInput').value = '';
  document.getElementById('contadorLineas').style.display = 'none';
  document.getElementById('contadorVerticales').textContent = '0 verticales';
  document.getElementById('contadorHorizontales').textContent = '0 horizontales';

  const canvas = document.getElementById('deteccionCanvas');
  if (canvas) { canvas.width = 0; canvas.height = 0; }

  zoomActual = 1.0;
  panX = 0;
  panY = 0;
  aplicarTransform();

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
              onDetectarLineas();
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
  console.log('🚀 MAR Caribe v5.0 - Zoom + Preparar OCR');

  document.getElementById('dropZone').addEventListener('click', capturarImagen);
  document.getElementById('fileInput').addEventListener('change', cargarDesdeInput);
  document.getElementById('btnCamera').addEventListener('click', capturarImagen);
  document.getElementById('btnDetectar').addEventListener('click', onDetectarLineas);
  document.getElementById('btnPreparar').addEventListener('click', onPrepararOCR);
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

  // Zoom
  document.getElementById('btnZoomIn').addEventListener('click', zoomIn);
  document.getElementById('btnZoomOut').addEventListener('click', zoomOut);
  document.getElementById('btnToggleLineas').addEventListener('click', toggleLineas);
  document.getElementById('btnZoomReset').addEventListener('click', resetearZoom);
  inicializarGestos();

  renderizarHistorial();
  if (window.Capacitor?.isNativePlatform?.()) setTimeout(recibirCompartir, 500);
  mostrarStatus('📷 Carga una imagen o comparte desde WhatsApp', 'info');
});
