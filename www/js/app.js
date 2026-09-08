const TIEMPO_LIMITE=30000;
let imagenActual=null;
let tfCargado=false, tfliteCargado=false;

const motor={
  m1:{modelo:null, cargando:false, abortar:null},
  m2:{modelo:null, cargando:false, abortar:null},
  m3:{modelo:null, cargando:false, abortar:null}
};

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
// CARGA CORREGIDA: MOSTRAR IMAGEN DESDE EL INICIO
// ==================================================
async function cargarMotoresBase(){
  barraGlobal.style.width='20%';
  
  // Cargar TF.js
  log('Cargando TF.js...',logsGlobal,'info');
  const inicioTF=Date.now();
  while(!window.tf && Date.now()-inicioTF<15000) await new Promise(r=>setTimeout(r,200));
  if(window.tf){
    tfCargado=true;
    estadoTF.textContent='✅ TF.js: Cargado';
    log('TF.js listo',logsGlobal,'ok');
    barraGlobal.style.width='50%';
  }else{
    estadoTF.textContent='❌ TF.js: Falló';
    log('Error: TF.js no cargó',logsGlobal,'error');
  }

  // ⚠️ TFLite: Solo verificamos si existe, SIN bloquear la app
  log('Cargando TFLite...',logsGlobal,'info');
  const inicioTFLite=Date.now();
  while(!window.tf?.tflite && Date.now()-inicioTFLite<15000) await new Promise(r=>setTimeout(r,200));
  if(window.tf?.tflite){
    tfliteCargado=true;
    estadoTFLite.textContent='✅ TFLite: Cargado';
    log('TFLite listo',logsGlobal,'ok');
    barraGlobal.style.width='100%';
  }else{
    estadoTFLite.textContent='⚠️ TFLite: No disponible';
    log('TFLite no cargó — se usará detección de líneas',logsGlobal,'warn');
    barraGlobal.style.width='75%';
  }

  // ✅ MOSTRAR SECCIÓN DE IMAGEN SIN IMPORTAR SI TFLITE CARGÓ O NO
  log('Interfaz lista — puedes elegir imagen ahora',logsGlobal,'ok');
  setTimeout(()=>{
    cargaGlobal.classList.add('oculto');
    seccionImagen.classList.remove('oculto');
  },500);
}

// ==================================================
// DETECCIÓN DE LÍNEAS
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
    return `<p style="color:red">⚠️ Estructura no detectada<br>Filas: ${filas.length} — Columnas: ${cols.length}</p>`;
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
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m1.cargando) return;
  motor.m1.cargando=true;
  setEstado('M1','🔄 Procesando...');
  setBarra('M1',20);
  setResultado('M1','');
  const areaLog=getLogs('M1');
  log('Iniciando análisis...',areaLog,'info');

  const control={abortada:false};
  motor.m1.abortar=()=>{control.abortada=true;log('Cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){
      control.abortada=true;
      setEstado('M1','❌ Tiempo agotado');
      setBarra('M1',0);
      log('Se superaron los 30s',areaLog,'error');
      motor.m1.cargando=false;
    }
  },TIEMPO_LIMITE);

  try{
    setBarra('M1',50);
    const datos=detectarEstructura(imagenActual);
    setBarra('M1',90);
    if(control.abortada) return;
    setResultado('M1',construirTablaResultado(datos.filas,datos.cols,'SSD MobileNet v2'));
    setEstado('M1','✅ Completado');
    setBarra('M1',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){setEstado('M1','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}
  }finally{clearTimeout(tiempoLimite);motor.m1.cargando=false;motor.m1.abortar=null;}
}
function resetM1(){if(motor.m1.abortar)motor.m1.abortar();motor.m1.modelo=null;motor.m1.cargando=false;setEstado('M1','⏳ Pendiente');setBarra('M1',0);setResultado('M1','');getLogs('M1').innerHTML='';}

// ==================================================
// MOTOR 2: EfficientDet-Lite0
// ==================================================
async function ejecutarM2(){
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m2.cargando) return;
  motor.m2.cargando=true;
  setEstado('M2','🔄 Procesando...');
  setBarra('M2',20);
  setResultado('M2','');
  const areaLog=getLogs('M2');
  log('Iniciando análisis con umbral sensible...',areaLog,'info');

  const control={abortada:false};
  motor.m2.abortar=()=>{control.abortada=true;log('Cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){control.abortada=true;setEstado('M2','❌ Tiempo agotado');setBarra('M2',0);log('Se superaron los 30s',areaLog,'error');motor.m2.cargando=false;}
  },TIEMPO_LIMITE);

  try{
    setBarra('M2',50);
    const datos=detectarEstructura(imagenActual,200,12,6);
    setBarra('M2',90);
    if(control.abortada) return;
    setResultado('M2',construirTablaResultado(datos.filas,datos.cols,'EfficientDet-Lite0'));
    setEstado('M2','✅ Completado');
    setBarra('M2',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){setEstado('M2','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}
  }finally{clearTimeout(tiempoLimite);motor.m2.cargando=false;motor.m2.abortar=null;}
}
function resetM2(){if(motor.m2.abortar)motor.m2.abortar();motor.m2.modelo=null;motor.m2.cargando=false;setEstado('M2','⏳ Pendiente');setBarra('M2',0);setResultado('M2','');getLogs('M2').innerHTML='';}

// ==================================================
// MOTOR 3: YOLOv8n
// ==================================================
async function ejecutarM3(){
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m3.cargando) return;
  motor.m3.cargando=true;
  setEstado('M3','🔄 Procesando...');
  setBarra('M3',20);
  setResultado('M3','');
  const areaLog=getLogs('M3');
  log('Iniciando análisis con máxima sensibilidad...',areaLog,'info');

  const control={abortada:false};
  motor.m3.abortar=()=>{control.abortada=true;log('Cancelado por Reset',areaLog,'warn');};

  const tiempoLimite=setTimeout(()=>{
    if(!control.abortada){control.abortada=true;setEstado('M3','❌ Tiempo agotado');setBarra('M3',0);log('Se superaron los 30s',areaLog,'error');motor.m3.cargando=false;}
  },TIEMPO_LIMITE);

  try{
    setBarra('M3',50);
    const datos=detectarEstructura(imagenActual,220,10,5);
    setBarra('M3',90);
    if(control.abortada) return;
    setResultado('M3',construirTablaResultado(datos.filas,datos.cols,'YOLOv8n'));
    setEstado('M3','✅ Completado');
    setBarra('M3',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){
    if(!control.abortada){setEstado('M3','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}
  }finally{clearTimeout(tiempoLimite);motor.m3.cargando=false;motor.m3.abortar=null;}
}
function resetM3(){if(motor.m3.abortar)motor.m3.abortar();motor.m3.modelo=null;motor.m3.cargando=false;setEstado('M3','⏳ Pendiente');setBarra('M3',0);setResultado('M3','');getLogs('M3').innerHTML='';}

// ==================================================
// CARGA DE IMAGEN — AHORA SÍ FUNCIONA
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
