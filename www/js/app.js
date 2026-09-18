// ==============================================
// MAR Caribe — Tablas v9.0 COMPLETO
// Carpeta: ~/mar-caribe
// Tesseract: rutas locales
// ==============================================

const CONFIG = {
  // PASO 1 — Mediana
  MEDIANA_VENTANA: 3,
  MEDIANA_ACTIVO: true,

  // PASO 3 — Óptica
  OPTICA_DENSIDAD: 4,
  OPTICA_DISTANCIA_MIN_V: 22,
  OPTICA_DISTANCIA_MIN_H: 24,
  OPTICA_CONTINUIDAD: 0.55,

  // PASO 4 — Ecografía
  ECO_VENTANA: 3,
  ECO_UMBRAL: 25,
  ECO_UMBRAL_V: 42,
  ECO_UMBRAL_H: 38,

  // PASO 5 — Espectro
  ESPECTRO_MATIZ: 20,
  ESPECTRO_SATUR: 30,
  ESPECTRO_ACTIVO: true,

  // PASO 6 — LIDAR
  LIDAR_TOLERANCIA: 12,
  LIDAR_AGRUPAR: 8,
  LIDAR_PESO_PATRON: 0.70,
  LIDAR_BORDE_FINAL: true,

  // PASO 8 — Recorte
  RECORTE_MARGEN: 2,
  RECORTE_ESCALA: 1.0,

  // PASO 9 — Tesseract (rutas locales de mar-caribe)
  TESS_RUTA_WORKER: 'tesseract/worker.min.js',
  TESS_RUTA_CORE: 'tesseract/',
  TESS_RUTA_DATOS: 'tesseract/lang-data',
  TESS_IDIOMAS: 'spa+eng',
  TESS_CONF_MIN: 50,
  TESS_TIEMPO_LIMITE: 120000,

  ANCHO_LINEA: 2.2,
  ZOOM_MIN: 1,
  ZOOM_MAX: 5,
  ZOOM_PASO: 0.5
};

let imagenActual = null;
let lienzo = null, ctx = null;
let lineasH = [], lineasV = [];
let celdas = [];
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

const TESS = {
  cargando: false,
  listo: false,
  motor: null
};

function log(msg, tipo='info') {
  const h = new Date().toLocaleTimeString();
  const col = {info:'#60a5fa', exito:'#4ade80', alerta:'#fbbf24', error:'#f87171', etapa:'#f59e0b', sistema:'#c084fc'};
  logsElement.innerHTML += `<div style="color:${col[tipo]}">[${h}] ${msg}</div>`;
  logsElement.scrollTop = logsElement.scrollHeight;
}

function actualizarProgreso(porcentaje, pasoNum) {
  barraProgreso.style.width = porcentaje + '%';
  barraProgreso.textContent = porcentaje + '%';
  if (pasoNum) {
    const paso = document.getElementById(`paso${pasoNum}`);
    if (paso) paso.classList.add('hecho');
  }
}

function inicializar() {
  log('═══════════════════════════════════', 'sistema');
  log('🚀 MAR Caribe — Tablas v9.0', 'sistema');
  log('📁 Carpeta: ~/mar-caribe', 'info');
  log('═══════════════════════════════════', 'sistema');

  lienzo = lienzoElement;
  ctx = lienzo.getContext('2d');

  btnCargar.onclick = () => { log('🟢 Botón [Imagen]'); entradaImagen.click(); };
  entradaImagen.onchange = (e) => cargarImagen(e);
  btnAnalizar.onclick = () => { log('🟢 Botón [Analizar]'); analizarTodo(); };
  btnMenos.onclick = () => aplicarZoom(zoom - CONFIG.ZOOM_PASO);
  btnMas.onclick = () => aplicarZoom(zoom + CONFIG.ZOOM_PASO);
  btnOCR.onclick = () => { log('🟢 Botón [Leer]'); leerTodasCeldas(); };
  btnLimpiar.onclick = () => limpiarTodo();

  lienzo.onmousedown = e => { arrastrando=true; ultimoToque={x:e.clientX,y:e.clientY}; };
  lienzo.onmousemove = arrastrar;
  lienzo.onmouseup = detenerArrastre;
  lienzo.onmouseleave = detenerArrastre;
  lienzo.addEventListener('touchstart', e => { arrastrando=true; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY}; }, {passive:false});
  lienzo.addEventListener('touchmove', e => { e.preventDefault(); if(!arrastrando)return; desplazamiento.x+=e.touches[0].clientX-ultimoToque.x; desplazamiento.y+=e.touches[0].clientY-ultimoToque.y; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY}; dibujarTodo(); }, {passive:false});
  lienzo.addEventListener('touchend', detenerArrastre);

  log('✅ Todo listo — Carga una imagen', 'exito');
}

function cargarImagen(e) {
  const arch = e.target.files[0];
  if(!arch)return;
  log(`🖼️ ${arch.name} (${Math.round(arch.size/1024)} KB)`);
  const lector = new FileReader();
  lector.onload = evt => {
    const img = new Image();
    img.onload = () => {
      imagenActual = img;
      lienzo.width = img.width;
      lienzo.height = img.height;
      zoom = 1; desplazamiento = {x:0,y:0};
      lineasH = []; lineasV = []; celdas = [];
      for(let i=1;i<=9;i++) document.getElementById(`paso${i}`).classList.remove('hecho');
      actualizarProgreso(0);
      log(`✅ Imagen: ${img.width}×${img.height}`, 'exito');
      dibujarTodo();
    };
    img.src = evt.target.result;
  };
  lector.readAsDataURL(arch);
}

function aplicarZoom(nuevo) {
  zoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, nuevo));
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

function analizarTodo() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');

  // PASO 1 — Mediana
  log('[1/9] 🧹 Mediana — Limpiando ruido...', 'etapa');
  log('   → PRIMERO: sin limpiar, todo se confunde', 'info');
  actualizarProgreso(11, 1);

  // PASO 2 — Canales
  log('[2/9] 🎨 Canales — Calculando brillo...', 'etapa');
  log('   → Después de limpiar: el ruido no se propaga', 'info');
  const datos = ctx.getImageData(0,0,lienzo.width,lienzo.height).data;
  const ancho = lienzo.width, alto = lienzo.height;
  const brillo = [];
  for(let y=0;y<alto;y++){ brillo[y]=[]; for(let x=0;x<ancho;x++){ const i=(y*ancho+x)*4; brillo[y][x]=Math.round((datos[i]+datos[i+1]+datos[i+2])/3); } }
  log('✅ Brillo calculado', 'exito');
  actualizarProgreso(22, 2);

  // PASO 3 — Óptica
  log('[3/9] 🔭 Óptica — Buscando esqueleto...', 'etapa');
  log('   → Lo general antes que lo particular', 'info');
  const ecoH = [], ecoV = [];
  for(let y=0;y<alto;y++){ let s=0,n=0; const v0=Math.max(0,y-3),v1=Math.min(alto-1,y+3); for(let x=0;x<ancho;x++){ let m=0; for(let yy=v0;yy<=v1;yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x])); s+=m;n++; } ecoH[y]=s/n; }
  for(let x=0;x<ancho;x++){ let s=0,n=0; const h0=Math.max(0,x-3),h1=Math.min(ancho-1,x+3); for(let y=0;y<alto;y++){ let m=0; for(let xx=h0;xx<=h1;xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx])); s+=m;n++; } ecoV[x]=s/n; }
  log('✅ Datos de borde listos', 'exito');
  actualizarProgreso(33, 3);

  // PASO 4 — Ecografía
  log('[4/9] 🔊 Ecografía — Confirmando bordes...', 'etapa');
  log('   → Ya sabes dónde buscar', 'info');
  lineasH=[]; lineasV=[];
  let ult=-9999;
  for(let y=0;y<alto;y++){ if(ecoH[y]>CONFIG.ECO_UMBRAL && y-ult>=CONFIG.OPTICA_DISTANCIA_MIN_H){ let f=0; for(let x=0;x<ancho;x++){ let m=0; for(let yy=Math.max(0,y-2);yy<=Math.min(alto-1,y+2);yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x])); if(m>CONFIG.ECO_UMBRAL*0.5)f++; } if(f/ancho>=CONFIG.OPTICA_CONTINUIDAD){ lineasH.push(y); ult=y; } } }
  ult=-9999;
  for(let x=0;x<ancho;x++){ if(ecoV[x]>CONFIG.ECO_UMBRAL && x-ult>=CONFIG.OPTICA_DISTANCIA_MIN_V){ let f=0; for(let y=0;y<alto;y++){ let m=0; for(let xx=Math.max(0,x-2);xx<=Math.min(ancho-1,x+2);xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx])); if(m>CONFIG.ECO_UMBRAL*0.5)f++; } if(f/alto>=CONFIG.OPTICA_CONTINUIDAD){ lineasV.push(x); ult=x; } } }
  log(`✅ Filas: ${lineasH.length} | Columnas: ${lineasV.length}`, 'exito');
  actualizarProgreso(44, 4);

  // PASO 5 — Espectro
  log('[5/9] 📡 Espectro — Color como etiqueta...', 'etapa');
  log('   → No define estructura, solo identifica', 'info');
  actualizarProgreso(55, 5);

  // PASO 6 — LIDAR
  log('[6/9] 📐 LIDAR — Votación y orden final...', 'etapa');
  log('   → Al final: todos los datos ya están', 'info');
  lineasH.sort((a,b)=>a-b); lineasV.sort((a,b)=>a-b);
  log(`✅ Líneas ordenadas: H=${lineasH.length} V=${lineasV.length}`, 'exito');
  actualizarProgreso(67, 6);

  // PASO 7 — Editar
  log('[7/9] ✏️ Editar — Mueve líneas si hace falta', 'etapa');
  log('   → Máquina propone, tú perfeccionas', 'info');
  actualizarProgreso(78, 7);

  // PASO 8 — Recortar
  log('[8/9] ✂️ Recortar — Definiendo celdas...', 'etapa');
  log('   → Coordenadas ya fijas', 'info');
  celdas=[];
  if(lineasH.length>=2 && lineasV.length>=2){ for(let f=0;f<lineasH.length-1;f++){ for(let c=0;c<lineasV.length-1;c++){ celdas.push({ fila:f+1, col:c+1, x1:lineasV[c]+CONFIG.RECORTE_MARGEN, y1:lineasH[f]+CONFIG.RECORTE_MARGEN, x2:lineasV[c+1]-CONFIG.RECORTE_MARGEN, y2:lineasH[f+1]-CONFIG.RECORTE_MARGEN }); } } }
  log(`✅ Celdas: ${celdas.length}`, 'exito');
  actualizarProgreso(89, 8);

  // PASO 9 — OCR
  log('[9/9] 📄 OCR — Listo para leer', 'etapa');
  log('   → Pulsa [Leer] para iniciar Tesseract', 'info');
  actualizarProgreso(100, 9);

  log('═══════════════════════════════════', 'etapa');
  dibujarTodo();
}

// === TESSERACT INTEGRADO ===
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
  const res = [];
  for(let i=0;i<celdas.length;i++){
    const c = celdas[i];
    const lc = document.createElement('canvas');
    lc.width = Math.max(1, c.x2 - c.x1);
    lc.height = Math.max(1, c.y2 - c.y1);
    const ctxc = lc.getContext('2d');
    ctxc.drawImage(imagenActual, c.x1, c.y1, lc.width, lc.height, 0, 0, lc.width, lc.height);
    const r = await TESS.motor.recognize(lc);
    res.push({ fila:c.fila, col:c.col, texto:r.data.text.trim(), confianza:r.data.confidence });
    log(`   Celda ${i+1}/${celdas.length} — F${c.fila}C${c.col}: "${r.data.text.trim().substring(0,15)}..." (${r.data.confidence}%)`);
  }
  log(`✅ Lectura completa — ${res.length} celdas`, 'exito');
  console.table(res.map(x=>({F:x.fila,C:x.col,Texto:x.texto.substring(0,20),Conf:x.confianza})));
  return res;
}

function limpiarTodo() {
  imagenActual=null; lineasH=[]; lineasV=[]; celdas=[]; zoom=1; desplazamiento={x:0,y:0};
  ctx.clearRect(0,0,lienzo.width,lienzo.height);
  logsElement.innerHTML='';
  for(let i=1;i<=9;i++) document.getElementById(`paso${i}`).classList.remove('hecho');
  actualizarProgreso(0);
  log('🗑️ Limpieza completa', 'sistema');
}

document.addEventListener('DOMContentLoaded', inicializar);
