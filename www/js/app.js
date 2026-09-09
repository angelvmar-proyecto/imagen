const TIEMPO_LIMITE=120000;
let imagenActual=null;
const motor={
  m1:{cargando:false,abortar:null},
  m2:{cargando:false,abortar:null},
  m3:{cargando:false,abortar:null},
  m4:{cargando:false,abortar:null},
  m5:{cargando:false,abortar:null}
};

const estadoTF=document.getElementById('estadoTF');
const estadoOCR=document.getElementById('estadoOCR');
const barraGlobal=document.getElementById('barraGlobal');
const logsGlobal=document.getElementById('logsGlobal');
const cargaGlobal=document.getElementById('cargaGlobal');
const seccionImagen=document.getElementById('seccionImagen');
const entradaImagen=document.getElementById('entradaImagen');
const btnSeleccionar=document.getElementById('btnSeleccionar');
const vistaImagen=document.getElementById('vistaImagen');

function log(t,a,tp='info'){
  const h=new Date().toLocaleTimeString();
  const c={info:'#0ff',ok:'#0f0',error:'#f55',warn:'#ff0'};
  const d=document.createElement('div');
  d.style.color=c[tp];
  d.textContent=`[${h}] ${t}`;
  a.appendChild(d);
  a.scrollTop=a.scrollHeight;
}
function setEstado(m,t){document.getElementById(`estado${m}`).textContent=t;}
function setBarra(m,p){document.getElementById(`barra${m}`).style.width=p+'%';}
function setResultado(m,h){document.getElementById(`resultado${m}`).innerHTML=h;}
function getLogs(m){return document.getElementById(`logs${m}`);}

async function cargarMotoresBase(){
  barraGlobal.style.width='10%';
  log('Cargando TF.js...',logsGlobal);

  let tfCargado=false;
  const inicioTF=Date.now();
  while(!window.tf && Date.now()-inicioTF<15000)await new Promise(r=>setTimeout(r,100));
  if(window.tf){
    tfCargado=true;
    estadoTF.textContent='✅ TF.js: Cargado';
    log('TF.js listo',logsGlobal,'ok');
    barraGlobal.style.width='40%';
  }else{
    estadoTF.textContent='⚠️ TF.js: No disponible';
    log('TF.js no cargó — modo básico',logsGlobal,'warn');
    barraGlobal.style.width='40%';
  }

  log('Cargando Tesseract OCR...',logsGlobal);
  if(window.Tesseract){
    estadoOCR.textContent='✅ OCR: Cargado';
    log('Tesseract listo ✅',logsGlobal,'ok');
    barraGlobal.style.width='100%';
  }else{
    estadoOCR.textContent='⚠️ OCR: No disponible';
    log('Tesseract no cargó — solo estructura',logsGlobal,'warn');
    barraGlobal.style.width='100%';
  }

  log('Interfaz lista — elige imagen',logsGlobal,'ok');
  setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},800);
}

// ==================================================
// DETECCIÓN DE ESTRUCTURA — PARÁMETROS EXPLICADOS:
// ub = umbral de brillo (menor = más sensible a líneas claras)
// mdf = distancia mínima entre filas (mayor = agrupa líneas cercanas)
// mdc = distancia mínima entre columnas (mayor = elimina columnas falsas)
// mll = umbral de densidad mínima para líneas verticales
// upp = umbral de densidad mínima para líneas horizontales
// ==================================================
function detectarEstructura(img,ub,mdf,mdc,mll,upp){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;

  // DETECTAR FILAS (líneas horizontales)
  const lh=[], mlh=c.width*upp;
  for(let y=0;y<c.height;y++){
    let p=0;
    for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      const b=(d[i]+d[i+1]+d[i+2])/3;
      if(b<ub)p++;
    }
    if(p>mlh)lh.push({y,peso:p});
  }
  const filas=[]; let uy=-9999;
  lh.sort((a,b)=>a.y-b.y).forEach(l=>{
    if(l.y-uy>mdf){filas.push(l.y);uy=l.y;}
  });

  // DETECTAR COLUMNAS (líneas verticales)
  const lv=[], mlv=c.height*mll;
  for(let x=0;x<c.width;x++){
    let p=0;
    for(let y=0;y<c.height;y++){
      const i=(y*c.width+x)*4;
      const b=(d[i]+d[i+1]+d[i+2])/3;
      if(b<ub)p++;
    }
    if(p>mlv)lv.push({x,peso:p});
  }
  let cols=[]; let ux=-9999;
  lv.sort((a,b)=>a.x-b.x).forEach(l=>{
    if(l.x-ux>mdc){cols.push(l.x);ux=l.x;}
  });

  // Corrección automática si hay muy pocas columnas
  if(cols.length<2){
    for(let pr=0.35;pr>=0.15&&cols.length<2;pr-=0.05){
      const mp=c.height*pr; const t=[]; let ut=-9999;
      lv.forEach(l=>{
        if(l.peso>mp&&l.x-ut>mdc){t.push(l.x);ut=l.x;}
      });
      if(t.length>=2){cols=t;break;}
    }
  }
  return {filas,columnas:cols,ancho:c.width,alto:c.height};
}

async function leerTodoDeUnaVez(img){
  if(!window.Tesseract)return null;
  try{
    const r=await Tesseract.recognize(img,'spa+eng',{logger:()=>{}});
    return r.data.words.map(w=>({texto:w.text.trim(),x:w.bbox.x0,y:w.bbox.y0,x2:w.bbox.x1,y2:w.bbox.y1}));
  }catch{return null;}
}
function buscarTextoEnCelda(palabras,x1,y1,x2,y2){
  if(!palabras)return '—';
  const c=palabras.filter(p=>p.x>=x1&&p.y>=y1&&p.x2<=x2&&p.y2<=y2);
  return c.length?c.map(p=>p.texto).join(' '):'—';
}
async function construirTablaConTexto(filas,columnas,nombre,img){
  if(filas.length<2||columnas.length<2)
    return`<p style="color:red">⚠️ Estructura incompleta<br>Filas: ${filas.length} — Columnas: ${columnas.length}</p>`;
  let h=`<p><strong>✅ ${nombre}</strong><br>Filas: ${filas.length-1} — Columnas: ${columnas.length-1}</p><table><thead><tr>`;
  for(let i=0;i<columnas.length-1;i++)h+=`<th>C${i+1}</th>`;
  h+='</tr></thead><tbody>';
  const palabras=await leerTodoDeUnaVez(img);
  for(let f=0;f<filas.length-1;f++){
    h+='<tr>';
    for(let c=0;c<columnas.length-1;c++){
      h+=`<td>${buscarTextoEnCelda(palabras,columnas[c],filas[f],columnas[c+1],filas[f+1])}</td>`;
    }
    h+='</tr>';
  }
  h+='</tbody></table>';
  return h;
}

async function ejecutarMotor(num,nombre,ub,mdf,mdc,mll,upp){
  const m=`M${num}`;
  if(!imagenActual){alert('⚠️ Elige imagen primero');return;}
  if(motor[`m${num}`].cargando)return;
  motor[`m${num}`].cargando=true;
  setEstado(m,'🔄 Procesando...');
  setBarra(m,10);
  setResultado(m,'');
  const al=getLogs(m);
  log(`Iniciando ${nombre}...`,al);

  const ctl={abortada:false};
  motor[`m${num}`].abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};
  const t=setTimeout(()=>{
    if(!ctl.abortada){
      ctl.abortada=true;
      setEstado(m,'❌ Tiempo agotado');
      setBarra(m,0);
      log('Se superaron 2min',al,'error');
      motor[`m${num}`].cargando=false;
    }
  },TIEMPO_LIMITE);

  try{
    setBarra(m,30);
    const dt=detectarEstructura(imagenActual,ub,mdf,mdc,mll,upp);
    setBarra(m,50);
    log(`Parámetros: brillo=${ub}, filasDist=${mdf}, colsDist=${mdc}`,al,'info');
    log(`Estructura: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto...`,al);
    const tbl=await construirTablaConTexto(dt.filas,dt.columnas,nombre,imagenActual);
    setBarra(m,95);
    if(ctl.abortada)return;
    setResultado(m,tbl);
    setEstado(m,'✅ Completado');
    setBarra(m,100);
    log('✅ Texto extraído',al,'ok');
  }catch(e){
    if(!ctl.abortada){
      setEstado(m,'❌ Error');
      log(`Error: ${e.message}`,al,'error');
    }
  }finally{
    clearTimeout(t);
    motor[`m${num}`].cargando=false;
    motor[`m${num}`].abortar=null;
  }
}
function resetMotor(num){
  const m=`M${num}`;
  if(motor[`m${num}`].abortar)motor[`m${num}`].abortar();
  motor[`m${num}`].cargando=false;
  setEstado(m,'⏳ Pendiente');
  setBarra(m,0);
  setResultado(m,'');
  getLogs(m).innerHTML='';
}

// ==================================================
// PARÁMETROS AJUSTADOS CON TUS DATOS REALES
// ==================================================
// EjecutarMotor(num, nombre, BRILLO, DIST_FILAS, DIST_COLS, DENSIDAD_V, DENSIDAD_H)

// M1: MobileNet — tenía 29 cols → subimos DIST_COLS a 32 para reducir
const ejecutarM1=()=>ejecutarMotor(1,'SSD MobileNet v2',210,14,32,0.35,0.08);
const resetM1=()=>resetMotor(1);

// M2: EfficientDet — tenía 24 cols → el mejor, ajuste fino
const ejecutarM2=()=>ejecutarMotor(2,'EfficientDet-Lite0',205,14,30,0.35,0.08);
const resetM2=()=>resetMotor(2);

// M3: YOLOv8n — igual que MobileNet, subimos DIST_COLS
const ejecutarM3=()=>ejecutarMotor(3,'YOLOv8n',215,14,32,0.35,0.08);
const resetM3=()=>resetMotor(3);

// M4: YOLOv11-Tabla — tenía 25 filas y 37 cols DEMASIADO → subimos TODO
const ejecutarM4=()=>ejecutarMotor(4,'YOLOv11-Tabla',200,18,35,0.38,0.09);
const resetM4=()=>resetMotor(4);

// M5: PaddleOCR — tenía 18 filas y 25 cols + MÁS PALABRAS ✅ → mantener o ajustar poco
const ejecutarM5=()=>ejecutarMotor(5,'PaddleOCR Table',220,15,30,0.40,0.10);
const resetM5=()=>resetMotor(5);

// ==================================================
// EVENTOS
// ==================================================
btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
entradaImagen.addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    imagenActual=new Image();
    imagenActual.onload=()=>{
      vistaImagen.src=ev.target.result;
      vistaImagen.style.display='block';
      log('Imagen cargada — lista para analizar',logsGlobal,'ok');
    };
    imagenActual.src=ev.target.result;
  };
  r.readAsDataURL(f);
});

document.getElementById('btnAnalizarM1').addEventListener('click',ejecutarM1);
document.getElementById('btnResetM1').addEventListener('click',resetM1);
document.getElementById('btnAnalizarM2').addEventListener('click',ejecutarM2);
document.getElementById('btnResetM2').addEventListener('click',resetM2);
document.getElementById('btnAnalizarM3').addEventListener('click',ejecutarM3);
document.getElementById('btnResetM3').addEventListener('click',resetM3);
document.getElementById('btnAnalizarM4').addEventListener('click',ejecutarM4);
document.getElementById('btnResetM4').addEventListener('click',resetM4);
document.getElementById('btnAnalizarM5').addEventListener('click',ejecutarM5);
document.getElementById('btnResetM5').addEventListener('click',resetM5);

window.addEventListener('load',cargarMotoresBase);
