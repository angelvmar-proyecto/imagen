// ==============================================
// MAR Caribe — Tablas v9.1
// Análisis independiente del zoom + Umbral adaptativo
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
  RANGO_AJUSTE: 5,
  LIDAR_TOLERANCIA: 12,
  LIDAR_AGRUPAR: 8,
  RECORTE_MARGEN: 2,
  MARGEN_COLOR: 5,
  TESS_RUTA_WORKER: 'tesseract/worker.min.js',
  TESS_RUTA_CORE: 'tesseract/',
  TESS_RUTA_DATOS: 'tesseract/lang-data',
  TESS_IDIOMAS: 'spa+eng',
  TESS_ESCALA_PRECISO: 2,
  TESS_CONF_MIN: 30,
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
let brilloGlobal = null;
let anchoGlobal = 0, altoGlobal = 0;

const entradaImagen = document.getElementById('entradaImagen');
const lienzoElement = document.getElementById('lienzo');
const btnCargar = document.getElementById('btnCargar');
const btnAnalizar = document.getElementById('btnAnalizar');
const btnMenos = document.getElementById('btnMenos');
const btnMas = document.getElementById('btnMas');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnLeerRapido = document.getElementById('btnLeerRapido');
const btnLeerMedio = document.getElementById('btnLeerMedio');
const btnLeerPreciso = document.getElementById('btnLeerPreciso');
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
  log('🚀 MAR Caribe — Tablas v9.1', 'sistema');
  log('🔧 Análisis independiente del zoom', 'info');
  log('🔧 Umbral adaptativo', 'info');
  log('═══════════════════════════════════', 'sistema');

  lienzo = lienzoElement;
  ctx = lienzo.getContext('2d');
  inicializarTabs();

  btnCargar.onclick = () => { log('🟢 [Imagen]'); entradaImagen.click(); };
  entradaImagen.onchange = e => cargarImagen(e);
  btnAnalizar.onclick = () => { log('🟢 [Analizar]'); analizarTodo(); };
  btnMenos.onclick = () => aplicarZoom(zoom - CONFIG.ZOOM_PASO);
  btnMas.onclick = () => aplicarZoom(zoom + CONFIG.ZOOM_PASO);
  btnLimpiar.onclick = () => limpiarTodo();

  btnLeerRapido.onclick = () => { log('🟢 [Leer Rápido]'); leerRapido(); };
  btnLeerMedio.onclick = () => { log('🟢 [Leer Medio]'); leerMedio(); };
  btnLeerPreciso.onclick = () => { log('🟢 [Leer Preciso]'); leerPreciso(); };

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
      brilloGlobal = null;
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
// OBTENER IMAGEN ORIGINAL (sin zoom)
// ============================================
function obtenerDatosOriginales() {
  // Crear canvas OCULTO con la imagen original (sin zoom, sin pan)
  const canvasOculto = document.createElement('canvas');
  canvasOculto.width = imagenActual.width;
  canvasOculto.height = imagenActual.height;
  const ctxOculto = canvasOculto.getContext('2d');
  ctxOculto.drawImage(imagenActual, 0, 0);
  return ctxOculto.getImageData(0, 0, canvasOculto.width, canvasOculto.height);
}

// ============================================
// AJUSTE LOCAL DE LÍNEAS
// ============================================
function ajustarLineaH(y, brillo, alto, ancho, rango) {
  const y0 = Math.max(0, y - rango);
  const y1 = Math.min(alto - 1, y + rango);
  let mejorY = y, mejorBrillo = Infinity;
  for (let yy = y0; yy <= y1; yy++) {
    let suma = 0;
    for (let x = 0; x < ancho; x++) suma += brillo[yy][x];
    const prom = suma / ancho;
    if (prom < mejorBrillo) { mejorBrillo = prom; mejorY = yy; }
  }
  return mejorY;
}

function ajustarLineaV(x, brillo, alto, ancho, rango) {
  const x0 = Math.max(0, x - rango);
  const x1 = Math.min(ancho - 1, x + rango);
  let mejorX = x, mejorBrillo = Infinity;
  for (let xx = x0; xx <= x1; xx++) {
    let suma = 0;
    for (let y = 0; y < alto; y++) suma += brillo[y][xx];
    const prom = suma / alto;
    if (prom < mejorBrillo) { mejorBrillo = prom; mejorX = xx; }
  }
  return mejorX;
}

// ============================================
// DETECCIÓN DE COLOR
// ============================================
function detectarColorDominante(x1, y1, x2, y2, ctxFuente) {
  const m = CONFIG.MARGEN_COLOR;
  const xStart = Math.max(0, x1 + m);
  const yStart = Math.max(0, y1 + m);
  const xEnd = Math.min(anchoGlobal, x2 - m);
  const yEnd = Math.min(altoGlobal, y2 - m);

  if (xEnd <= xStart || yEnd <= yStart) return { r: 255, g: 255, b: 255, h: 0, s: 0, v: 100 };

  const ancho = xEnd - xStart, alto = yEnd - yStart;
  const datos = ctxFuente.getImageData(xStart, yStart, ancho, alto).data;
  const histograma = {};
  let maxCount = 0, colorDominante = null;

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
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g-b)/d) % 6;
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
  }
  h = Math.round(h * 60); if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : Math.round((d/max)*100), v: Math.round(max*100) };
}

// ============================================
// BINARIZAR CANVAS
// ============================================
function binarizarCanvas(canvas) {
  const c = canvas.getContext('2d');
  const imgData = c.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const brillo = (data[i] + data[i+1] + data[i+2]) / 3;
    if (brillo > 180) {
      data[i] = data[i+1] = data[i+2] = 255;
    } else {
      data[i] = data[i+1] = data[i+2] = 0;
    }
  }
  c.putImageData(imgData, 0, 0);
}

// ============================================
// LIMPIAR TEXTO
// ============================================
function limpiarTextoOCR(texto, confianza) {
  let limpio = texto.trim();
  if (limpio.length <= 2 && /^[.,;:\-_\s|\[\]{}]+$/.test(limpio)) return '';
  if (confianza < CONFIG.TESS_CONF_MIN && limpio.length <= 3) return '';
  return limpio;
}

// ============================================
// ANÁLISIS (independiente del zoom)
// ============================================
function analizarTodo() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');

  // ⚠️ IMPORTANTE: Leer de canvas OCULTO, no del visible
  log('[1/9] 🧹 Mediana...', 'etapa');
  const imageData = obtenerDatosOriginales();
  const datos = imageData.data;
  const ancho = imageData.width;
  const alto = imageData.height;
  anchoGlobal = ancho;
  altoGlobal = alto;
  log(`   📐 Analizando: ${ancho}×${alto} (sin zoom)`, 'info');
  actualizarProgreso(11, 1);

  log('[2/9] 🎨 Canales...', 'etapa');
  const brillo = [];
  for(let y=0;y<alto;y++){ brillo[y]=[]; for(let x=0;x<ancho;x++){ const i=(y*ancho+x)*4; brillo[y][x]=Math.round((datos[i]+datos[i+1]+datos[i+2])/3); } }
  brilloGlobal = brillo;
  log('✅ Brillo calculado', 'exito');
  actualizarProgreso(22, 2);

  log('[3/9] 🔭 Óptica...', 'etapa');
  const ecoH = [], ecoV = [];
  for(let y=0;y<alto;y++){ let s=0,n=0; const v0=Math.max(0,y-3),v1=Math.min(alto-1,y+3); for(let x=0;x<ancho;x++){ let m=0; for(let yy=v0;yy<=v1;yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x])); s+=m;n++; } ecoH[y]=s/n; }
  for(let x=0;x<ancho;x++){ let s=0,n=0; const h0=Math.max(0,x-3),h1=Math.min(ancho-1,x+3); for(let y=0;y<alto;y++){ let m=0; for(let xx=h0;xx<=h1;xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx])); s+=m;n++; } ecoV[x]=s/n; }
  log('✅ Eco calculado', 'exito');
  actualizarProgreso(33, 3);

  log('[4/9] 🔊 Ecografía con UMBRAL ADAPTATIVO...', 'etapa');
  
  // ============================================
  // UMBRAL ADAPTATIVO
  // ============================================
  const maxEcoH = Math.max(...ecoH);
  const maxEcoV = Math.max(...ecoV);
  const umbralAdaptH = Math.max(20, maxEcoH * 0.40);
  const umbralAdaptV = Math.max(20, maxEcoV * 0.40);
  log(`   📊 Eco máx H: ${Math.round(maxEcoH)} → umbral: ${Math.round(umbralAdaptH)}`, 'info');
  log(`   📊 Eco máx V: ${Math.round(maxEcoV)} → umbral: ${Math.round(umbralAdaptV)}`, 'info');

  lineasH = []; lineasV = [];
  let ult = -9999;
  for(let y=0;y<alto;y++){
    if(ecoH[y]>umbralAdaptH && y-ult>=CONFIG.OPTICA_DISTANCIA_MIN_H){
      let f=0;
      for(let x=0;x<ancho;x++){
        let m=0;
        for(let yy=Math.max(0,y-2);yy<=Math.min(alto-1,y+2);yy++) m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x]));
        if(m>umbralAdaptH*0.5)f++;
      }
      if(f/ancho>=CONFIG.OPTICA_CONTINUIDAD){ lineasH.push(y); ult=y; }
    }
  }
  ult = -9999;
  for(let x=0;x<ancho;x++){
    if(ecoV[x]>umbralAdaptV && x-ult>=CONFIG.OPTICA_DISTANCIA_MIN_V){
      let f=0;
      for(let y=0;y<alto;y++){
        let m=0;
        for(let xx=Math.max(0,x-2);xx<=Math.min(ancho-1,x+2);xx++) m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx]));
        if(m>umbralAdaptV*0.5)f++;
      }
      if(f/alto>=CONFIG.OPTICA_CONTINUIDAD){ lineasV.push(x); ult=x; }
    }
  }
  log(`✅ Detectadas: H=${lineasH.length} V=${lineasV.length}`, 'exito');
  log(`📐 Ajustando al centro (rango ±${CONFIG.RANGO_AJUSTE}px)...`, 'info');
  lineasH = lineasH.map(y => ajustarLineaH(y, brillo, alto, ancho, CONFIG.RANGO_AJUSTE));
  lineasV = lineasV.map(x => ajustarLineaV(x, brillo, alto, ancho, CONFIG.RANGO_AJUSTE));
  log(`✅ Líneas ajustadas`, 'exito');
  actualizarProgreso(44, 4);

  log('[5/9] 📡 Espectro...', 'etapa');
  actualizarProgreso(55, 5);

  log('[6/9] 📐 LIDAR...', 'etapa');
  lineasH.sort((a,b)=>a-b); lineasV.sort((a,b)=>a-b);
  actualizarProgreso(67, 6);

  log('[7/9] ✏️ Editar...', 'etapa');
  actualizarProgreso(78, 7);

  log('[8/9] ✂️ Recortar + Colores...', 'etapa');
  celdas = [];
  const numFilas = lineasH.length - 1;
  const numColumnas = lineasV.length - 1;

  // Canvas oculto para colores (sin zoom)
  const canvasColor = document.createElement('canvas');
  canvasColor.width = ancho;
  canvasColor.height = alto;
  const ctxColor = canvasColor.getContext('2d');
  ctxColor.drawImage(imagenActual, 0, 0);
  
  if(numFilas > 0 && numColumnas > 0){
    matrizTexto = Array(numFilas).fill().map(() => Array(numColumnas).fill(''));
    matrizColores = Array(numFilas).fill().map(() => Array(numColumnas).fill(null));

    for(let f=0;f<numFilas;f++){
      for(let c=0;c<numColumnas;c++){
        const x1 = lineasV[c], y1 = lineasH[f];
        const x2 = lineasV[c+1], y2 = lineasH[f+1];
        matrizColores[f][c] = detectarColorDominante(x1, y1, x2, y2, ctxColor);
        celdas.push({ fila:f, col:c, x1, y1, x2, y2 });
      }
    }
  }
  log(`✅ Celdas: ${celdas.length}`, 'exito');
  actualizarProgreso(89, 8);

  log('[9/9] 📄 OCR — Listo', 'etapa');
  log('   → Elige método: ⚡ Rápido / 📊 Medio / 🎯 Preciso', 'info');
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
    await TESS.motor.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '6'
    });
    TESS.listo = true;
    TESS.cargando = false;
    log('✅ Tesseract listo', 'exito');
  } catch(e) {
    TESS.cargando = false;
    log(`❌ Error: ${e.message}`, 'error');
  }
}

// ============================================
// MÉTODO 1: LEER RÁPIDO
// ============================================
async function leerRapido() {
  if (celdas.length === 0) { alert('Primero toca "Analizar"'); return; }
  if(!TESS.listo) await cargarTesseract();
  if(!TESS.listo) return;

  log('⚡ MÉTODO RÁPIDO (OCR Global)', 'etapa');

  const lc = document.createElement('canvas');
  lc.width = anchoGlobal;
  lc.height = altoGlobal;
  const c = lc.getContext('2d');
  c.drawImage(imagenActual, 0, 0);

  c.strokeStyle = '#000000';
  c.lineWidth = 2;
  lineasH.forEach(y => { c.beginPath(); c.moveTo(0, y); c.lineTo(lc.width, y); c.stroke(); });
  lineasV.forEach(x => { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, lc.height); c.stroke(); });

  binarizarCanvas(lc);

  log('   Tesseract leyendo...', 'info');
  const t0 = performance.now();
  const r = await TESS.motor.recognize(lc);
  const tiempo = Math.round((performance.now() - t0) / 1000);
  log(`   ✅ Lectura en ${tiempo}s (confianza ${Math.round(r.data.confidence)}%)`, 'exito');

  const blocks = r.data.blocks || [];
  let asignados = 0;
  for (const block of blocks) {
    if (!block.paragraphs) continue;
    for (const para of block.paragraphs) {
      if (!para.lines) continue;
      for (const line of para.lines) {
        if (!line.words || line.words.length === 0) continue;
        const cx = (line.bbox.x0 + line.bbox.x1) / 2;
        const cy = (line.bbox.y0 + line.bbox.y1) / 2;
        for (const celda of celdas) {
          if (cx >= celda.x1 && cx <= celda.x2 && cy >= celda.y1 && cy <= celda.y2) {
            const texto = line.text.trim();
            if (texto) {
              const actual = matrizTexto[celda.fila][celda.col];
              matrizTexto[celda.fila][celda.col] = actual ? actual + ' ' + texto : texto;
              asignados++;
            }
            break;
          }
        }
      }
    }
  }
  log(`✅ ${asignados} bloques asignados`, 'exito');
  finalizarLectura();
}

// ============================================
// MÉTODO 2: LEER MEDIO
// ============================================
async function leerMedio() {
  if (celdas.length === 0) { alert('Primero toca "Analizar"'); return; }
  if(!TESS.listo) await cargarTesseract();
  if(!TESS.listo) return;

  log('📊 MÉTODO MEDIO (Fila por fila)', 'etapa');

  const t0 = performance.now();
  const numFilas = lineasH.length - 1;

  for (let f = 0; f < numFilas; f++) {
    const y1 = lineasH[f] + CONFIG.RECORTE_MARGEN;
    const y2 = lineasH[f + 1] - CONFIG.RECORTE_MARGEN;
    const x1 = lineasV[0];
    const x2 = lineasV[lineasV.length - 1];

    const lc = document.createElement('canvas');
    lc.width = Math.max(1, x2 - x1);
    lc.height = Math.max(1, y2 - y1);
    const c = lc.getContext('2d');
    c.drawImage(imagenActual, x1, y1, lc.width, lc.height, 0, 0, lc.width, lc.height);
    binarizarCanvas(lc);

    try {
      const r = await TESS.motor.recognize(lc);
      const blocks = r.data.blocks || [];
      for (const block of blocks) {
        if (!block.paragraphs) continue;
        for (const para of block.paragraphs) {
          if (!para.lines) continue;
          for (const line of para.lines) {
            if (!line.words || line.words.length === 0) continue;
            const cx = (line.bbox.x0 + line.bbox.x1) / 2 + x1;
            for (let c2 = 0; c2 < lineasV.length - 1; c2++) {
              if (cx >= lineasV[c2] && cx < lineasV[c2 + 1]) {
                const texto = line.text.trim();
                if (texto) {
                  const actual = matrizTexto[f][c2];
                  matrizTexto[f][c2] = actual ? actual + ' ' + texto : texto;
                }
                break;
              }
            }
          }
        }
      }
      const pct = Math.round(((f + 1) / numFilas) * 100);
      log(`   Fila ${f + 1}/${numFilas} (${pct}%)`);
    } catch(e) {
      log(`   Error fila ${f + 1}: ${e.message}`, 'error');
    }
  }

  const tiempo = Math.round((performance.now() - t0) / 1000);
  log(`✅ Lectura completa en ${tiempo}s`, 'exito');
  finalizarLectura();
}

// ============================================
// MÉTODO 3: LEER PRECISO
// ============================================
async function leerPreciso() {
  if (celdas.length === 0) { alert('Primero toca "Analizar"'); return; }
  if(!TESS.listo) await cargarTesseract();
  if(!TESS.listo) return;

  log('🎯 MÉTODO PRECISO (Celda por celda)', 'etapa');
  const t0 = performance.now();

  for(let i=0;i<celdas.length;i++){
    const c = celdas[i];
    const m = CONFIG.RECORTE_MARGEN;
    const anchoC = Math.max(1, c.x2 - c.x1 - m*2);
    const altoC = Math.max(1, c.y2 - c.y1 - m*2);
    const escala = CONFIG.TESS_ESCALA_PRECISO;

    const lc = document.createElement('canvas');
    lc.width = anchoC * escala;
    lc.height = altoC * escala;
    const cctx = lc.getContext('2d');
    cctx.drawImage(imagenActual,
      c.x1 + m, c.y1 + m, anchoC, altoC,
      0, 0, lc.width, lc.height);
    binarizarCanvas(lc);

    try {
      const r = await TESS.motor.recognize(lc);
      const texto = limpiarTextoOCR(r.data.text, r.data.confidence);
      matrizTexto[c.fila][c.col] = texto;
      const pct = Math.round(((i + 1) / celdas.length) * 100);
      if (i % 10 === 0 || i === celdas.length - 1) log(`   ${i + 1}/${celdas.length} (${pct}%)`);
    } catch(e) {
      log(`   Error celda ${i+1}: ${e.message}`, 'error');
    }
  }

  const tiempo = Math.round((performance.now() - t0) / 1000);
  log(`✅ Lectura completa en ${tiempo}s`, 'exito');
  finalizarLectura();
}

function finalizarLectura() {
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
  for (let j = 0; j < numColumnas; j++) html += `<th>Col ${j + 1}</th>`;
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
  brilloGlobal = null;
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
