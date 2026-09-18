// ==============================================
// MAR Caribe — Tablas v9.0
// Método D (centro del valle) + Color + OCR
// ==============================================

const CONFIG = {
  MEDIANA_VENTANA: 3,
  OPTICA_DENSIDAD: 4,
  OPTICA_DISTANCIA_MIN_V: 22,
  OPTICA_DISTANCIA_MIN_H: 24,
  OPTICA_CONTINUIDAD: 0.55,
  ECO_VENTANA: 3,
  ECO_UMBRAL: 25,
  ECO_UMBRAL_V: 42,
  ECO_UMBRAL_H: 38,
  LIDAR_TOLERANCIA: 12,
  LIDAR_AGRUPAR: 8,
  RECORTE_MARGEN: 2,
  MARGEN_COLOR: 5,
  TESS_RUTA_WORKER: 'tesseract/worker.min.js',
  TESS_RUTA_CORE: 'tesseract/',
  TESS_RUTA_DATOS: 'tesseract/lang-data',
  TESS_IDIOMAS: 'spa+eng',
  ANCHO_LINEA: 2.2,
  ZOOM_MIN: 1,
  ZOOM_MAX: 5,
  ZOOM_PASO: 0.5
};

let imagenActual = null;
let lienzo = null, ctx = null;
let lineasH = [], lineasV = [];
let celdas = [];
let matrizTexto = [];
let matrizColores = [];
let zoom = 1, desplazamiento = {x:0, y:0};
let arrastrando = false, ultimoToque = {x:0, y:0};

const entradaImagen = document.getElementById('entradaImagen');
const lienzoElement = document.getElementById('lienzo');
const btnCargar = document.getElementById('btnCargar');
const btnAnalizar = document.getElementById('btnAnalizar');
const btnMenos = document.getElementById('btnMenos');
const btnMas = document.getElementById('btnMas');
const btnOCR = document.getElementById('btnOCR');
const btnLimpiar = document.getElementById('btnLimpiar');
const logsElement = document.getElementById('logs');
const barraProgreso = document.getElementById('barraProgreso');

const TESS = { cargando: false, listo: false, motor: null };

function log(msg, tipo='info') {
  const h = new Date().toLocaleTimeString();
  const col = {info:'#60a5fa', exito:'#4ade80', alerta:'#fbbf24', error:'#f87171', etapa:'#f59e0b', sistema:'#c084fc'};
  logsElement.innerHTML += `<div style="color:${col[tipo]}">[${h}] ${msg}</div>`;
  logsElement.scrollTop = logsElement.scrollHeight;
}

function actualizarProgreso(p, paso) {
  barraProgreso.style.width = p + '%';
  barraProgreso.textContent = p + '%';
  if (paso) {
    const el = document.getElementById(`paso${paso}`);
    if (el) el.classList.add('hecho');
  }
}

function inicializarTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

function inicializar() {
  log('═══════════════════════════════════', 'sistema');
  log('🚀 MAR Caribe — Tablas v9.0', 'sistema');
  log('📐 Método D: Centro del valle', 'info');
  log('🎨 Detección de color + OCR', 'info');
  log('═══════════════════════════════════', 'sistema');

  lienzo = lienzoElement;
  ctx = lienzo.getContext('2d');
  inicializarTabs();

  btnCargar.onclick = () => { log('🟢 [Imagen]'); entradaImagen.click(); };
  entradaImagen.onchange = e => cargarImagen(e);
  btnAnalizar.onclick = () => { log('🟢 [Analizar]'); analizarTodo(); };
  btnMenos.onclick = () => aplicarZoom(zoom - CONFIG.ZOOM_PASO);
  btnMas.onclick = () => aplicarZoom(zoom + CONFIG.ZOOM_PASO);
  btnOCR.onclick = () => { log('🟢 [Leer]'); leerTodasCeldas(); };
  btnLimpiar.onclick = () => limpiarTodo();
  document.getElementById('btnCopiar').onclick = copiarTabla;
  document.getElementById('btnCSV').onclick = exportarCSV;
  document.getElementById('btnExcel').onclick = exportarExcel;

  lienzo.onmousedown = e => { arrastrando=true; ultimoToque={x:e.clientX,y:e.clientY}; };
  lienzo.onmousemove = arrastrar;
  lienzo.onmouseup = detenerArrastre;
  lienzo.onmouseleave = detenerArrastre;
  lienzo.addEventListener('touchstart', e => { arrastrando=true; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY}; }, {passive:false});
  lienzo.addEventListener('touchmove', e => { e.preventDefault(); if(!arrastrando)return; desplazamiento.x+=e.touches[0].clientX-ultimoToque.x; desplazamiento.y+=e.touches[0].clientY-ultimoToque.y; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY}; dibujarTodo(); }, {passive:false});
  lienzo.addEventListener('touchend', detenerArrastre);

  log('✅ Todo listo', 'exito');
}

function cargarImagen(e) {
  const arch = e.target.files[0];
  if(!arch)return;
  log(`🖼️ ${arch.name}`);
  const lector = new FileReader();
  lector.onload = evt => {
    const img = new Image();
    img.onload = () => {
      imagenActual = img;
      lienzo.width = img.width;
      lienzo.height = img.height;
      zoom = 1; desplazamiento = {x:0,y:0};
      lineasH = []; lineasV = []; celdas = [];
      matrizTexto = []; matrizColores = [];
      for(let i=1;i<=9;i++) document.getElementById(`paso${i}`).classList.remove('hecho');
      actualizarProgreso(0);
      document.getElementById('tablaWrapper').innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
      document.getElementById('infoExtra').textContent = '📊 0 filas · 0 columnas';
      log(`✅ ${img.width}×${img.height}`, 'exito');
      dibujarTodo();
    };
    img.src = evt.target.result;
  };
  lector.readAsDataURL(arch);
}

function aplicarZoom(n) {
  zoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, n));
  log(`🔍 Zoom: ${Math.round(zoom*100)}%`);
  dibujarTodo();
}

function dibujarTodo() {
  if(!imagenActual)return;
  ctx.clearRect(0,0,lienzo.width,lienzo.height);
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(imagenActual, 0, 0);
  ctx.lineWidth = CONFIG.ANCHO_LINEA / zoom;
  ctx.strokeStyle = '#ff0000';
  lineasH.forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(imagenActual.width,y); ctx.stroke(); });
  ctx.strokeStyle = '#0088ff';
  lineasV.forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,imagenActual.height); ctx.stroke(); });
  ctx.restore();
}

function arrastrar(e) {
  if(!arrastrando)return;
  desplazamiento.x += e.clientX - ultimoToque.x;
  desplazamiento.y += e.clientY - ultimoToque.y;
  ultimoToque = {x:e.clientX, y:e.clientY};
  dibujarTodo();
}
function detenerArrastre() { arrastrando = false; }

// ============================================
// MÉTODO D: DETECCIÓN DEL CENTRO DEL VALLE
// ============================================
function detectarLineasCentroValle(eco, umbral, distanciaMin) {
  const lineas = [];
  let ultima = -9999;
  let i = 0;

  while (i < eco.length) {
    // Buscar INICIO de zona donde eco > umbral
    if (eco[i] > umbral) {
      let inicio = i;
      
      // Buscar FIN de la zona
      let fin = i;
      while (fin < eco.length && eco[fin] > umbral) {
        fin++;
      }
      fin = fin - 1;  // Último punto dentro del umbral

      // Centro del valle
      const centro = Math.round((inicio + fin) / 2);

      // Respetar distancia mínima
      if (centro - ultima >= distanciaMin) {
        lineas.push(centro);
        ultima = centro;
      }

      // Saltar al final de la zona
      i = fin + 1;
    } else {
      i++;
    }
  }

  return lineas;
}

// ============================================
// DETECCIÓN DE COLOR DOMINANTE
// ============================================
function detectarColorDominante(x1, y1, x2, y2) {
  const m = CONFIG.MARGEN_COLOR;
  const xStart = Math.max(0, x1 + m);
  const yStart = Math.max(0, y1 + m);
  const xEnd = Math.min(lienzo.width, x2 - m);
  const yEnd = Math.min(lienzo.height, y2 - m);

  if (xEnd <= xStart || yEnd <= yStart) {
    return { r: 255, g: 255, b: 255, h: 0, s: 0, v: 100 };
  }

  const ancho = xEnd - xStart;
  const alto = yEnd - yStart;
  const datos = ctx.getImageData(xStart, yStart, ancho, alto).data;

  const histograma = {};
  let maxCount = 0;
  let colorDominante = null;

  for (let i = 0; i < datos.length; i += 4) {
    const r = datos[i], g = datos[i+1], b = datos[i+2];
    const brillo = (r + g + b) / 3;
    if (brillo < 100 || brillo > 253) continue;

    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;
    const key = `${qr},${qg},${qb}`;

    histograma[key] = (histograma[key] || 0) + 1;
    if (histograma[key] > maxCount) {
      maxCount = histograma[key];
      colorDominante = { r: qr, g: qg, b: qb };
    }
  }

  if (!colorDominante) return { r: 255, g: 255, b: 255, h: 0, s: 0, v: 100 };

  const hsv = rgbToHsv(colorDominante.r, colorDominante.g, colorDominante.b);
  return { r: colorDominante.r, g: colorDominante.g, b: colorDominante.b, ...hsv };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g-b)/d) % 6;
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : Math.round((d/max)*100);
  const v = Math.round(max*100);
  return { h, s, v };
}

// ============================================
// ANÁLISIS
// ============================================
function analizarTodo() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');

  log('[1/9] 🧹 Mediana...', 'etapa');
  actualizarProgreso(11, 1);

  log('[2/9] 🎨 Canales...', 'etapa');
  const datos = ctx.getImageData(0,0,lienzo.width,lienzo.height).data;
  const ancho = lienzo.width, alto = lienzo.height;
  const brillo = [];
  for(let y=0;y<alto;y++){ brillo[y]=[]; for(let x=0;x<ancho;x++){ const i=(y*ancho+x)*4; brillo[y][x]=Math.round((datos[i]+datos[i+1]+datos[i+2])/3); } }
  log('✅ Brillo calculado', 'exito');
  actualizarProgreso(22, 2);

  log('[3/9] 🔭 Óptica...', 'etapa');
  const ecoH = [], ecoV = [];
  for(let y=0;y<alto;y++){ let s=0,n=0; const v0=Math.max(0,y-3),v1=Math.min(alto-1,y+3); for(let x=0;x<ancho;x++){ let m=0; for(let yy=v0;yy<=v1;yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x])); s+=m;n++; } ecoH[y]=s/n; }
  for(let x=0;x<ancho;x++){ let s=0,n=0; const h0=Math.max(0,x-3),h1=Math.min(ancho-1,x+3); for(let y=0;y<alto;y++){ let m=0; for(let xx=h0;xx<=h1;xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx])); s+=m;n++; } ecoV[x]=s/n; }
  log('✅ Eco calculado', 'exito');
  actualizarProgreso(33, 3);

  log('[4/9] 🔊 Ecografía — MÉTODO D (centro del valle)...', 'etapa');
  log('   → Detecta centro de zona con eco alto', 'info');
  lineasH = detectarLineasCentroValle(ecoH, CONFIG.ECO_UMBRAL_H, CONFIG.OPTICA_DISTANCIA_MIN_H);
  lineasV = detectarLineasCentroValle(ecoV, CONFIG.ECO_UMBRAL_V, CONFIG.OPTICA_DISTANCIA_MIN_V);
  log(`✅ Filas: ${lineasH.length} | Columnas: ${lineasV.length}`, 'exito');
  actualizarProgreso(44, 4);

  log('[5/9] 📡 Espectro...', 'etapa');
  actualizarProgreso(55, 5);

  log('[6/9] 📐 LIDAR...', 'etapa');
  lineasH.sort((a,b)=>a-b); lineasV.sort((a,b)=>a-b);
  actualizarProgreso(67, 6);

  log('[7/9] ✏️ Editar...', 'etapa');
  actualizarProgreso(78, 7);

  log('[8/9] ✂️ Recortar + Detectar colores...', 'etapa');
  celdas=[];
  const numFilas = lineasH.length - 1;
  const numColumnas = lineasV.length - 1;
  
  if(numFilas > 0 && numColumnas > 0){
    matrizTexto = Array(numFilas).fill().map(() => Array(numColumnas).fill(''));
    matrizColores = Array(numFilas).fill().map(() => Array(numColumnas).fill(null));

    for(let f=0;f<numFilas;f++){
      for(let c=0;c<numColumnas;c++){
        const x1 = lineasV[c];
        const y1 = lineasH[f];
        const x2 = lineasV[c+1];
        const y2 = lineasH[f+1];

        const color = detectarColorDominante(x1, y1, x2, y2);
        matrizColores[f][c] = color;

        celdas.push({
          fila: f, col: c,
          x1: x1 + CONFIG.RECORTE_MARGEN,
          y1: y1 + CONFIG.RECORTE_MARGEN,
          x2: x2 - CONFIG.RECORTE_MARGEN,
          y2: y2 - CONFIG.RECORTE_MARGEN
        });
      }
    }
  }
  log(`✅ Celdas: ${celdas.length} | Colores detectados`, 'exito');
  actualizarProgreso(89, 8);

  try {
    localStorage.setItem('marCaribeColores', JSON.stringify(matrizColores));
  } catch(e) {}

  log('[9/9] 📄 OCR — Listo', 'etapa');
  actualizarProgreso(100, 9);
  log('═══════════════════════════════════', 'etapa');
  dibujarTodo();
}

// ============================================
// TESSERACT
// ============================================
async function cargarTesseract() {
  if(TESS.cargando || TESS.listo) return;
  TESS.cargando = true;
  log('📖 Cargando Tesseract...', 'etapa');
  try {
    if(typeof Tesseract === 'undefined'){ log('❌ Tesseract no encontrado', 'error'); TESS.cargando=false; return; }
    let basePath = window.location.href;
    basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    TESS.motor = await Tesseract.createWorker(CONFIG.TESS_IDIOMAS, 1, {
      workerPath: basePath + CONFIG.TESS_RUTA_WORKER,
      langPath: basePath + CONFIG.TESS_RUTA_DATOS,
      corePath: basePath + CONFIG.TESS_RUTA_CORE,
      workerBlobURL: false,
      cacheMethod: 'none',
      gzip: false
    });
    TESS.listo = true;
    TESS.cargando = false;
    log('✅ Tesseract listo', 'exito');
  } catch(e) {
    TESS.cargando = false;
    log(`❌ Error: ${e.message}`, 'error');
  }
}

async function leerTodasCeldas() {
  if(!TESS.listo) await cargarTesseract();
  if(!TESS.listo) return;
  log(`📖 Leyendo ${celdas.length} celdas...`, 'etapa');

  for(let i=0;i<celdas.length;i++){
    const c = celdas[i];
    const lc = document.createElement('canvas');
    lc.width = Math.max(1, c.x2 - c.x1);
    lc.height = Math.max(1, c.y2 - c.y1);
    const ctxc = lc.getContext('2d');
    ctxc.drawImage(imagenActual, c.x1, c.y1, lc.width, lc.height, 0, 0, lc.width, lc.height);

    try {
      const r = await TESS.motor.recognize(lc);
      const texto = r.data.text.trim();
      matrizTexto[c.fila][c.col] = texto;
      const pct = Math.round(((i + 1) / celdas.length) * 100);
      log(`   ${i + 1}/${celdas.length} (${pct}%)`);
    } catch(e) {
      log(`   Error celda ${i+1}: ${e.message}`, 'error');
    }
  }

  log(`✅ Lectura completa`, 'exito');
  renderizarTabla();
  setTimeout(() => {
    document.querySelector('.tab[data-tab="tabla"]').click();
  }, 500);
}

// ============================================
// RENDERIZAR TABLA
// ============================================
function renderizarTabla() {
  const wrapper = document.getElementById('tablaWrapper');
  if (!matrizTexto.length) {
    wrapper.innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
    return;
  }

  const numFilas = matrizTexto.length;
  const numColumnas = matrizTexto[0].length;

  let html = '<table class="tabla-resultado"><thead><tr>';
  for (let j = 0; j < numColumnas; j++) {
    html += `<th>Col ${j + 1}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let i = 0; i < numFilas; i++) {
    html += '<tr>';
    for (let j = 0; j < numColumnas; j++) {
      const texto = matrizTexto[i][j] || '';
      const color = (matrizColores[i] && matrizColores[i][j]) ? matrizColores[i][j] : { r: 255, g: 255, b: 255 };
      const bg = `rgb(${color.r},${color.g},${color.b})`;
      const colorTexto = (color.r + color.g + color.b) / 3 < 128 ? 'white' : 'black';
      html += `<td contenteditable="true" data-row="${i}" data-col="${j}" style="background:${bg};color:${colorTexto}">${texto}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('td[contenteditable="true"]').forEach(td => {
    td.addEventListener('input', function() {
      const r = parseInt(this.dataset.row);
      const c = parseInt(this.dataset.col);
      if (matrizTexto[r] && matrizTexto[r][c] !== undefined) {
        matrizTexto[r][c] = this.innerText.trim();
      }
    });
  });

  document.getElementById('infoExtra').textContent = `📊 ${numFilas} filas · ${numColumnas} columnas`;
}

// ============================================
// EXPORTAR
// ============================================
async function copiarTabla() {
  if (!matrizTexto.length) { alert('No hay datos.'); return; }
  const tsv = matrizTexto.map(r => r.join('\t')).join('\n');
  try {
    if (window.Capacitor?.Plugins?.Clipboard) {
      await window.Capacitor.Plugins.Clipboard.write({ string: tsv });
    } else {
      await navigator.clipboard.writeText(tsv);
    }
    log('✅ Copiado', 'exito');
  } catch(e) { alert('Error: ' + e.message); }
}

function exportarCSV() {
  if (!matrizTexto.length) { alert('No hay datos.'); return; }
  const csv = matrizTexto.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tabla.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportarExcel() {
  if (!matrizTexto.length) { alert('No hay datos.'); return; }
  let html = '<html><head><meta charset="UTF-8"></head><body><table>';
  for (let i = 0; i < matrizTexto.length; i++) {
    html += '<tr>';
    for (let j = 0; j < matrizTexto[i].length; j++) {
      const texto = matrizTexto[i][j] || '';
      const color = (matrizColores[i] && matrizColores[i][j]) ? matrizColores[i][j] : { r: 255, g: 255, b: 255 };
      const bg = `rgb(${color.r},${color.g},${color.b})`;
      html += `<td style="background:${bg}">${texto}</td>`;
    }
    html += '</tr>';
  }
  html += '</table></body></html>';
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tabla.xls'; a.click();
  URL.revokeObjectURL(url);
}

function limpiarTodo() {
  imagenActual=null; lineasH=[]; lineasV=[]; celdas=[];
  matrizTexto=[]; matrizColores=[];
  zoom=1; desplazamiento={x:0,y:0};
  ctx.clearRect(0,0,lienzo.width,lienzo.height);
  logsElement.innerHTML='';
  for(let i=1;i<=9;i++) document.getElementById(`paso${i}`).classList.remove('hecho');
  actualizarProgreso(0);
  document.getElementById('tablaWrapper').innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
  document.getElementById('infoExtra').textContent = '📊 0 filas · 0 columnas';
  log('🗑️ Limpieza completa', 'sistema');
}

document.addEventListener('DOMContentLoaded', inicializar);
