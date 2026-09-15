// ==============================================
// MAR Caribe — Escáner de Tablas v2.8
// ✅ 5 ARCHIVOS LOCALES COMPLETOS — Tesseract.js v4
// ==============================================

const CONFIG = {
  UMBRAL_V: 42, UMBRAL_H: 38,
  DISTANCIA_MIN_V: 22, DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55, VENTANA_ECO: 3, UMBRAL_ECO: 25,
  ANCHO_LINEA: 2.2, ZOOM_MIN: 1, ZOOM_MAX: 5, ZOOM_PASO: 0.5,

  // 📖 NOMBRES CONFIRMADOS — EXACTAMENTE COMO EXISTEN ✅
  RUTA_TESSDATA: 'tessdata/',
  ARCHIVO_CORE: 'tesseract-core.js',  // ✅ SIN duplicado .wasm
  IDIOMAS: 'spa+eng',
  MIN_ANCHO_CELDA: 8, MIN_ALTO_CELDA: 6, ESCALA_OCR: 2
};

let imagenActual = null, lienzo = null, ctx = null;
let lineasH = [], lineasV = [], zoom = 1, desplazamiento = {x:0,y:0};
let trabajadorOCR = null, ocrListo = false;

const entradaImagen = document.getElementById('entradaImagen');
const lienzoElement = document.getElementById('lienzo');
const btnCargar = document.getElementById('btnCargar');
const btnAnalizar = document.getElementById('btnAnalizar');
const btnLeer = document.getElementById('btnLeer');
const btnMenosZoom = document.getElementById('btnMenosZoom');
const btnMasZoom = document.getElementById('btnMasZoom');
const btnVista = document.getElementById('btnVista');
const btnLimpiar = document.getElementById('btnLimpiar');
const logsElement = document.getElementById('logs');
const contenidoTablaElement = document.getElementById('contenidoTabla');

function log(msg, tipo='info') {
  const h = new Date().toLocaleTimeString();
  const c = {info:'#60a5fa', exito:'#4ade80', alerta:'#fbbf24', error:'#f87171', sistema:'#c084fc'};
  logsElement.innerHTML += `<div style="color:${c[tipo]}">[${h}] ${msg}</div>`;
  logsElement.scrollTop = logsElement.scrollHeight;
}

function inicializar() {
  log('═══════════════════════════════════', 'sistema');
  log('🚀 MAR Caribe v2.8 — 5 ARCHIVOS LOCALES', 'sistema');
  log(`📂 Ruta: ${CONFIG.RUTA_TESSDATA}`, 'sistema');
  log(`📄 Core: ${CONFIG.ARCHIVO_CORE}`, 'sistema');
  log('═══════════════════════════════════', 'sistema');
  
  lienzo = lienzoElement;
  ctx = lienzo.getContext('2d');
  inicializarOCR();

  btnCargar.onclick = () => { log('🟢 [Imagen] → presionado'); entradaImagen.click(); };
  entradaImagen.onchange = (e) => cargarImagen(e);
  btnAnalizar.onclick = () => { log('🟢 [Líneas] → Detectando'); analizarEspectroTriple(); };
  btnLeer.onclick = () => {
    if (!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
    if (lineasH.length < 2 || lineasV.length < 2) { log('⚠️ Presiona [Líneas] primero', 'alerta'); return; }
    procesarCeldas();
  };
  btnMenosZoom.onclick = () => aplicarZoom(zoom - CONFIG.ZOOM_PASO);
  btnMasZoom.onclick = () => aplicarZoom(zoom + CONFIG.ZOOM_PASO);
  btnVista.onclick = () => { zoom=1; desplazamiento={x:0,y:0}; dibujarTodo(); log('🔄 Vista restablecida'); };
  btnLimpiar.onclick = limpiarTodo;

  let arrastrando = false, ultimoToque = {x:0,y:0};
  lienzo.addEventListener('touchstart', e => { if (e.touches.length===1) {arrastrando=true; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY};} }, {passive:false});
  lienzo.addEventListener('touchmove', e => { e.preventDefault(); if (!arrastrando||e.touches.length!==1) return; desplazamiento.x+=e.touches[0].clientX-ultimoToque.x; desplazamiento.y+=e.touches[0].clientY-ultimoToque.y; ultimoToque={x:e.touches[0].clientX,y:e.touches[0].clientY}; dibujarTodo(); }, {passive:false});
  lienzo.addEventListener('touchend', () => arrastrando=false);
  log('✅ Eventos conectados', 'exito');
}

async function inicializarOCR() {
  log('📖 Cargando Tesseract — TODO LOCAL...', 'info');
  try {
    trabajadorOCR = await Tesseract.createWorker(CONFIG.IDIOMAS, 1, {
      langPath: CONFIG.RUTA_TESSDATA,
      corePath: CONFIG.RUTA_TESSDATA + CONFIG.ARCHIVO_CORE,
      logger: m => { if (m.status==='recognizing text') log(`📖 OCR: ${Math.round(m.progress*100)}%`); }
    });
    ocrListo = true;
    log('✅ ✅ Tesseract LISTO — 100% LOCAL', 'exito');
  } catch (e) {
    log(`❌ ERROR OCR: ${e.message}`, 'error');
    ocrListo = false;
  }
}

function cargarImagen(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  log(`🖼️ ${archivo.name} (${Math.round(archivo.size/1024)} KB)`);
  const lector = new FileReader();
  lector.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      imagenActual = img;
      lienzo.width = img.width; lienzo.height = img.height;
      zoom=1; desplazamiento={x:0,y:0}; lineasH=[]; lineasV=[];
      log(`✅ ${img.width}×${img.height}`, 'exito');
      dibujarTodo();
    };
    img.src = ev.target.result;
  };
  lector.readAsDataURL(archivo);
}

function analizarEspectroTriple() {
  if (!imagenActual) return;
  ctx.drawImage(imagenActual,0,0);
  const datos = ctx.getImageData(0,0,lienzo.width,lienzo.height).data;
  const ancho = lienzo.width, alto = lienzo.height;

  const brillo = [];
  for (let y=0; y<alto; y++) { brillo[y]=[]; for (let x=0; x<ancho; x++) { const i=(y*ancho+x)*4; brillo[y][x]=Math.round((datos[i]+datos[i+1]+datos[i+2])/3); }}

  const ecoH = [];
  for (let y=0; y<alto; y++) { let s=0,c=0; const v1=Math.max(0,y-3),v2=Math.min(alto-1,y+3); for (let x=0; x<ancho; x++) {let m=0; for(let yy=v1;yy<=v2;yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x])); s+=m;c++;} ecoH[y]=c?s/c:0; }

  const ecoV = [];
  for (let x=0; x<ancho; x++) { let s=0,c=0; const h1=Math.max(0,x-3),h2=Math.min(ancho-1,x+3); for (let y=0; y<alto; y++) {let m=0; for(let xx=h1;xx<=h2;xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx])); s+=m;c++;} ecoV[x]=c?s/c:0; }

  lineasH=[]; let ult=-9999;
  for (let y=0; y<alto; y++) if (ecoH[y]>25 && y-ult>=24) { let f=0; for(let x=0;x<ancho;x++){let m=0;for(let yy=Math.max(0,y-2);yy<=Math.min(alto-1,y+2);yy++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[yy][x]));if(m>12.5)f++;} if(f/ancho>=0.55){lineasH.push(y);ult=y;} }

  lineasV=[]; ult=-9999;
  for (let x=0; x<ancho; x++) if (ecoV[x]>25 && x-ult>=22) { let f=0; for(let y=0;y<alto;y++){let m=0;for(let xx=Math.max(0,x-2);xx<=Math.min(ancho-1,x+2);xx++)m=Math.max(m,Math.abs(brillo[y][x]-brillo[y][xx]));if(m>12.5)f++;} if(f/alto>=0.55){lineasV.push(x);ult=x;} }

  log(`✅ ✅ Líneas: ${lineasH.length} filas × ${lineasV.length} columnas`, 'exito');
  dibujarTodo();
}

function dibujarTodo() {
  if (!imagenActual) return;
  ctx.clearRect(0,0,lienzo.width,lienzo.height);
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom,zoom);
  ctx.drawImage(imagenActual,0,0);
  ctx.strokeStyle='#ff0000'; ctx.lineWidth=2.2/zoom;
  lineasH.forEach(y=>{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(imagenActual.width,y);ctx.stroke();});
  ctx.strokeStyle='#0088ff';
  lineasV.forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,imagenActual.height);ctx.stroke();});
  ctx.restore();
}

function aplicarZoom(z) { zoom=Math.max(1,Math.min(5,z)); log(`🔍 Zoom ${Math.round(zoom*100)}%`); dibujarTodo(); }
function limpiarTodo() { imagenActual=null; lineasH=[]; lineasV=[]; zoom=1; desplazamiento={x:0,y:0}; ctx.clearRect(0,0,lienzo.width,lienzo.height); logsElement.innerHTML=''; contenidoTablaElement.innerHTML=''; log('🗑️ Limpio', 'sistema'); }

async function procesarCeldas() {
  log('📖 Leyendo celdas...', 'info');
  lineasH.sort((a,b)=>a-b); lineasV.sort((a,b)=>a-b);
  const filas=[]; const total=(lineasH.length-1)*(lineasV.length-1); let textoCnt=0;
  const datosImg = ctx.getImageData(0,0,lienzo.width,lienzo.height).data;

  for (let f=0; f<lineasH.length-1; f++) {
    const y1=lineasH[f], y2=lineasH[f+1], ah=y2-y1;
    const fila=[];
    for (let c=0; c<lineasV.length-1; c++) {
      const x1=lineasV[c], x2=lineasV[c+1], an=x2-x1;
      if (an<8 || ah<6) { fila.push({color:'#fff',texto:''}); continue; }

      let r=0,g=0,b=0,n=0;
      for (let yy=y1; yy<y2; yy+=4) for (let xx=x1; xx<x2; xx+=4) { if(yy>=0&&yy<lienzo.height&&xx>=0&&xx<lienzo.width){const i=(yy*lienzo.width+xx)*4;r+=datosImg[i];g+=datosImg[i+1];b+=datosImg[i+2];n++;} }
      const color = n ? `rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})` : '#fff';

      let texto='';
      if (ocrListo && trabajadorOCR) {
        try {
          const cv=document.createElement('canvas'); cv.width=an*2; cv.height=ah*2;
          const cc=cv.getContext('2d');
          cc.drawImage(imagenActual,x1,y1,an,ah,0,0,cv.width,cv.height);
          const imgD=cc.getImageData(0,0,cv.width,cv.height);
          for(let i=0;i<imgD.data.length;i+=4){const g=(imgD.data[i]+imgD.data[i+1]+imgD.data[i+2])/3;const bn=g>180?255:0;imgD.data[i]=imgD.data[i+1]=imgD.data[i+2]=bn;}
          cc.putImageData(imgD,0,0);
          const res=await trabajadorOCR.recognize(cv);
          texto=res?.data?.text?.trim().replace(/\s+/g,' ')||'';
          if(texto) textoCnt++;
        } catch(e) { texto=''; }
      }
      fila.push({color,texto});
    }
    filas.push(fila);
  }

  log(`✅ ✅ ${total} celdas — Texto: ${textoCnt} celdas`, 'exito');
  let html='<table style="border-collapse:collapse;width:100%;font-size:0.7rem;">';
  html+='<tr style="background:#334155;"><th>#</th>';
  for(let c=0;c<filas[0]?.length;c++)html+=`<th>C${c+1}</th>`;
  html+='</tr>';
  for(let f=0;f<filas.length;f++){html+=`<tr><td>${f+1}</td>`;
    for(let c=0;c<filas[f].length;c++){
      const cel=filas[f][c];
      const [r,g,b]=cel.color.match(/\d+/g)?.map(Number)||[255,255,255];
      const tx=(r*299+g*587+b*114)/1000>128?'#000':'#fff';
      html+=`<td style="background:${cel.color};color:${tx};border:1px solid #475569;padding:3px;max-width:80px;word-break:break-all;">${cel.texto||'&nbsp;'}</td>`;
    }
    html+='</tr>';
  }
  html+='</table>';
  contenidoTablaElement.innerHTML=html;
}

document.addEventListener('DOMContentLoaded', inicializar);
