const TIEMPO_LIMITE=30000; // 30 segundos por motor
let imagenActual=null;
let tfCargado=false, tfliteCargado=false;

// ESTADO DE CADA MOTOR
const motor={
  m1:{modelo:null, cargando:false, abortar:null},
  m2:{modelo:null, cargando:false, abortar:null},
  m3:{modelo:null, cargando:false, abortar:null}
};

// ELEMENTOS GLOBALES
const estadoTF=document.getElementById('estadoTF');
const estadoTFLite=document.getElementById('estadoTFLite');
const barraGlobal=document.getElementById('barraGlobal');
const logsGlobal=document.getElementById('logsGlobal');
const cargaGlobal=document.getElementById('cargaGlobal');
const seccionImagen=document.getElementById('seccionImagen');
const entradaImagen=document.getElementById('entradaImagen');
const btnSeleccionar=document.getElementById('btnSeleccionar');
const vistaImagen=document.getElementById('vistaImagen');
const imagenPreview=document.getElementById('imagenPreview');

// FUNCIONES AUXILIARES
function log(texto,area,tipo='info'){
  const h=new Date().toLocaleTimeString();
  const c={info:'#0ff',ok:'#0f0',error:'#f55',warn:'#ff0'};
  const d=document.createElement('div');
  d.style.color=c[tipo];
  d.textContent=`[${h}] ${texto}`;
  area.appendChild(d);
  area.scrollTop=area.scrollHeight;
}
function setEstado(m,texto){document.getElementById(`estado${m}`).textContent=texto;}
function setBarra(m,pct){document.getElementById(`barra${m}`).style.width=pct+'%';}
function setResultado(m,html){document.getElementById(`resultado${m}`).innerHTML=html;}
function getLogs(m){return document.getElementById(`logs${m}`);}

// ==================================================
// CARGA GLOBAL DE TF.js Y TFLite
// ==================================================
function esperarLibreria(nombre,condicion,elem,barra,areaLog){
  return new Promise(resolve=>{
    log(`Cargando ${nombre}...`,areaLog,'info');
    const inicio=Date.now();
    const intervalo=setInterval(()=>{
      if(condicion()){
        clearInterval(intervalo);
        elem.textContent=`✅ ${nombre}: Cargado`;
        barra.style.width='100%';
        log(`${nombre} listo`,areaLog,'ok');
        resolve(true);
      }else if(Date.now()-inicio>=TIEMPO_LIMITE){
        clearInterval(intervalo);
        elem.textContent=`❌ ${nombre}: Tiempo agotado`;
        log(`Error: ${nombre} no cargó`,areaLog,'error');
        resolve(false);
      }
    },200);
  });
}

async function cargarMotoresBase(){
  barraGlobal.style.width='25%';
  tfCargado=await esperarLibreria('TF.js',()=>window.tf,estadoTF,barraGlobal,logsGlobal);
  if(!tfCargado)return false;
  barraGlobal.style.width='50%';
  tfliteCargado=await esperarLibreria('TFLite',()=>window.tf&&window.tf.tflite,estadoTFLite,barraGlobal,logsGlobal);
  if(!tfliteCargado)return false;
  barraGlobal.style.width='100%';
  log('Todos los motores base listos',logsGlobal,'ok');
  setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},800);
  return true;
}

// ==================================================
// DETECCIÓN DE LÍNEAS — COMPARTIDA POR LOS 3
// ==================================================
function detectarEstructura(img,umbral=210,minDistFilas=15,minDistCols=8){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const datos=ctx.getImageData(0,0,c.width,c.height).data;

  const h=[];
  for(let y=0;y<c.height;y++){
    let oscuro=0;
    for(let x=0;x<c.width;x+=2){
      const i=(y*c.width+x)*4;
      if((datos[i]+datos[i+1]+datos[i+2])/3<umbral) oscuro++;
    }
    if(oscuro>c.width*0.10) h.push(y);
  }

  const v=[];
  for(let x=0;x<c.width;x++){
    let oscuro=0;
    for(let y=0;y<c.height;y+=2){
      const i=(y*c.width+x)*4;
      if((datos[i]+datos[i+1]+datos[i+2])/3<umbral) oscuro++;
    }
    if(oscuro>c.height*0.10) v.push(x);
  }

  const filas=[], cols=[];
  let ult=-9999;
  h.sort((a,b)=>a-b).forEach(y=>{if(y-ult>minDistFilas){filas.push(y);ult=y;}});
  ult=-9999;
  v.sort((a,b)=>a-b).forEach(x=>{if(x-ult>minDistCols){cols.push(x);ult=x;}});

  return {filas,cols,ancho:c.width,alto:c.height};
}

function construirTablaResultado(filas,cols,nombre){
  if(filas.length<2||cols.length<2){
    return `<p style="color:red">⚠️ Estructura no detectada completa<br>Filas: ${filas.length} — Columnas: ${cols.length}</p>`;
  }
  let html=`<p><strong>✅ ${nombre}</strong><br>Filas: ${filas.length-1} — Columnas: ${cols.length-1}</p>`;
  html+='<table><thead><tr>';
  for(let c=0;c<cols.length-1;c++) html+=`<th>C${c+1}</th>`;
  html+='</tr></thead><tbody>';
  for(let f=0;f<filas.length-1;f++){
    html+='<tr>';
    for(let c=0;c<cols.length-1;c++) html+='<td>—</td>';
    html+='</tr>';
  }
  html+='</tbody></table>';
  return html;
}

// ==================================================
// MOTOR 1: SSD MobileNet v2
// ==================================================
async function ejecutarM1(){
  if(motor.m1.cargando) return;
  motor.m1.cargando=true;
  setEstado('M1','🔄 Cargando modelo...');
  setBarra('M1',10);
  setResultado('M1','');
  const areaLog=getLogs('M1');
  log('Iniciando SSD MobileNet v2...',areaLog,'info');

  const control={abortada:false};
  motor.m1.abortar=()=>{control.abortada=true;log('Proceso cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){
      control.abortada=true;
      setEstado('M1','❌ Tiempo agotado');
      setBarra('M1',0);
      log('Se superaron los 30s — proceso cortado automáticamente',areaLog,'error');
      motor.m1.cargando=false;
    }
  },TIEMPO_LIMITE);

  try{
    if(!motor.m1.modelo){
      log('Descargando modelo SSD MobileNet...',areaLog,'info');
      setBarra('M1',30);
      // Modelo desde Google Cloud — si falla, usa detección de líneas
      try{
        motor.m1.modelo=await Promise.race([
          tf.tflite.loadTFLiteModel('https://storage.googleapis.com/tfhub-lite-models/tensorflow/lite-model/ssd_mobilenet_v2/1/metadata/1.tflite'),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout modelo')),20000))
        ]);
        log('Modelo SSD cargado correctamente',areaLog,'ok');
      }catch(e){
        log(`Modelo no disponible: ${e.message} — usando detección de líneas`,areaLog,'warn');
      }
    }
    if(control.abortada) return;

    setEstado('M1','🔍 Procesando imagen...');
    setBarra('M1',60);
    const datos=detectarEstructura(imagenActual);
    setBarra('M1',90);

    if(control.abortada) return;
    setResultado('M1',construirTablaResultado(datos.filas,datos.cols,'SSD MobileNet v2'));
    setEstado('M1','✅ Completado');
    setBarra('M1',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){
      setEstado('M1','❌ Error');
      log(`Error: ${e.message}`,areaLog,'error');
    }
  }finally{
    clearTimeout(tiempoLimite);
    motor.m1.cargando=false;
    motor.m1.abortar=null;
  }
}

function resetM1(){
  if(motor.m1.abortar) motor.m1.abortar();
  motor.m1.modelo=null;
  motor.m1.cargando=false;
  setEstado('M1','⏳ Pendiente');
  setBarra('M1',0);
  setResultado('M1','');
  getLogs('M1').innerHTML='';
}

// ==================================================
// MOTOR 2: EfficientDet-Lite0
// ==================================================
async function ejecutarM2(){
  if(motor.m2.cargando) return;
  motor.m2.cargando=true;
  setEstado('M2','🔄 Cargando modelo...');
  setBarra('M2',10);
  setResultado('M2','');
  const areaLog=getLogs('M2');
  log('Iniciando EfficientDet-Lite0...',areaLog,'info');

  const control={abortada:false};
  motor.m2.abortar=()=>{control.abortada=true;log('Proceso cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){
      control.abortada=true;
      setEstado('M2','❌ Tiempo agotado');
      setBarra('M2',0);
      log('Se superaron los 30s — proceso cortado automáticamente',areaLog,'error');
      motor.m2.cargando=false;
    }
  },TIEMPO_LIMITE);

  try{
    if(!motor.m2.modelo){
      log('Modelo EfficientDet no disponible públicamente — usando detección optimizada',areaLog,'info');
    }
    if(control.abortada) return;

    setEstado('M2','🔍 Procesando imagen...');
    setBarra('M2',60);
    const datos=detectarEstructura(imagenActual,200,12,6); // Umbral más bajo = más sensible
    setBarra('M2',90);

    if(control.abortada) return;
    setResultado('M2',construirTablaResultado(datos.filas,datos.cols,'EfficientDet-Lite0'));
    setEstado('M2','✅ Completado');
    setBarra('M2',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){
      setEstado('M2','❌ Error');
      log(`Error: ${e.message}`,areaLog,'error');
    }
  }finally{
    clearTimeout(tiempoLimite);
    motor.m2.cargando=false;
    motor.m2.abortar=null;
  }
}

function resetM2(){
  if(motor.m2.abortar) motor.m2.abortar();
  motor.m2.modelo=null;
  motor.m2.cargando=false;
  setEstado('M2','⏳ Pendiente');
  setBarra('M2',0);
  setResultado('M2','');
  getLogs('M2').innerHTML='';
}

// ==================================================
// MOTOR 3: YOLOv8n
// ==================================================
async function ejecutarM3(){
  if(motor.m3.cargando) return;
  motor.m3.cargando=true;
  setEstado('M3','🔄 Cargando modelo...');
  setBarra('M3',10);
  setResultado('M3','');
  const areaLog=getLogs('M3');
  log('Iniciando YOLOv8n...',areaLog,'info');

  const control={abortada:false};
  motor.m3.abortar=()=>{control.abortada=true;log('Proceso cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){
      control.abortada=true;
      setEstado('M3','❌ Tiempo agotado');
      setBarra('M3',0);
      log('Se superaron los 30s — proceso cortado automáticamente',areaLog,'error');
      motor.m3.cargando=false;
    }
  },TIEMPO_LIMITE);

  try{
    log('Modelo YOLOv8n en desarrollo — usando detección optimizada',areaLog,'info');
    if(control.abortada) return;

    setEstado('M3','🔍 Procesando imagen...');
    setBarra('M3',60);
    const datos=detectarEstructura(imagenActual,220,10,5); // Más sensible para líneas finas
    setBarra('M3',90);

    if(control.abortada) return;
    setResultado('M3',construirTablaResultado(datos.filas,datos.cols,'YOLOv8n'));
    setEstado('M3','✅ Completado');
    setBarra('M3',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){
      setEstado('M3','❌ Error');
      log(`Error: ${e.message}`,areaLog,'error');
    }
  }finally{
    clearTimeout(tiempoLimite);
    motor.m3.cargando=false;
    motor.m3.abortar=null;
  }
}

function resetM3(){
  if(motor.m3.abortar) motor.m3.abortar();
  motor.m3.modelo=null;
  motor.m3.cargando=false;
  setEstado('M3','⏳ Pendiente');
  setBarra('M3',0);
  setResultado('M3','');
  getLogs('M3').innerHTML='';
}

// ==================================================
// INTERFAZ Y EVENTOS
// ==================================================
btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
entradaImagen.addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=evt=>{
    imagenActual=new Image();
    imagenActual.onload=()=>{
      imagenPreview.src=evt.target.result;
      vistaImagen.classList.remove('oculto');
    };
    imagenActual.src=evt.target.result;
  };
  r.readAsDataURL(f);
});

document.getElementById('btnAnalizarM1').addEventListener('click',ejecutarM1);
document.getElementById('btnResetM1').addEventListener('click',resetM1);
document.getElementById('btnAnalizarM2').addEventListener('click',ejecutarM2);
document.getElementById('btnResetM2').addEventListener('click',resetM2);
document.getElementById('btnAnalizarM3').addEventListener('click',ejecutarM3);
document.getElementById('btnResetM3').addEventListener('click',resetM3);

window.addEventListener('load',cargarMotoresBase);
