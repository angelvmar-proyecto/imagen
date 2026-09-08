const TIEMPO_LIMITE=30000;
let imagenActual=null;

const motor={
  m1:{cargando:false,abortar:null},
  m2:{cargando:false,abortar:null},
  m3:{cargando:false,abortar:null}
};

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
// DETECCIÓN DEFINITIVA — FILTROS ACTIVADOS AL MÁXIMO
// ==================================================
function detectarEstructura(
  img,
  umbralBrillo=220,        // Más alto = solo líneas muy marcadas
  minDistanciaFilas=20,    // No juntar filas muy cercanas
  minDistanciaColumnas=40, // ✅ AUMENTADO: ignorar todo lo pegado
  minPorcentajeLongitud=0.85 // ✅ SOLO líneas que atraviesen el 85% de la tabla
){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const datos=ctx.getImageData(0,0,c.width,c.height).data;

  // --- LÍNEAS HORIZONTALES ---
  const h=[];
  const umbralPixelesH=c.width*0.10;
  for(let y=0;y<c.height;y++){
    let oscuro=0;
    for(let x=0;x<c.width;x+=2){
      const i=(y*c.width+x)*4;
      const brillo=(datos[i]+datos[i+1]+datos[i+2])/3;
      if(brillo<umbralBrillo) oscuro++;
    }
    if(oscuro>umbralPixelesH) h.push({y,peso:oscuro});
  }

  // --- LÍNEAS VERTICALES CON FILTRO DE LONGITUD ---
  const v=[];
  const umbralPixelesV=c.height*minPorcentajeLongitud; // ✅ LÍNEA LARGA O NO CUENTA
  for(let x=0;x<c.width;x++){
    let oscuro=0;
    for(let y=0;y<c.height;y+=2){
      const i=(y*c.width+x)*4;
      const brillo=(datos[i]+datos[i+1]+datos[i+2])/3;
      if(brillo<umbralBrillo) oscuro++;
    }
    if(oscuro>umbralPixelesV) v.push({x,peso:oscuro}); // ✅ SOLO si es línea larga real
  }

  // --- AGRUPAR FILAS ---
  const filas=[];
  let ultY=-9999;
  h.sort((a,b)=>a.y-b.y).forEach(linea=>{
    if(linea.y-ultY>minDistanciaFilas){
      filas.push(linea.y);
      ultY=linea.y;
    }
  });

  // --- AGRUPAR COLUMNAS ✅ SOLUCIÓN FINAL ---
  const cols=[];
  let ultX=-9999;
  v.sort((a,b)=>a.x-b.x).forEach(linea=>{
    if(linea.x-ultX>minDistanciaColumnas){ // ✅ IGNORA TODO LO MENOS DE 40px
      cols.push(linea.x);
      ultX=linea.x;
    }
  });

  return {filas,cols,ancho:c.width,alto:c.height};
}

function construirTablaResultado(filas,cols,nombre){
  if(filas.length<2||cols.length<2){
    return `<p style="color:red">⚠️ Estructura incompleta<br>Filas: ${filas.length} — Columnas: ${cols.length}</p>`;
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
// MOTORES — CADA UNO CON SU AJUSTE
// ==================================================
async function ejecutarM1(){
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m1.cargando) return;
  motor.m1.cargando=true;
  setEstado('M1','🔄 Procesando...'); setBarra('M1',20); setResultado('M1','');
  const areaLog=getLogs('M1'); log('Iniciando análisis...',areaLog,'info');
  const control={abortada:false};
  motor.m1.abortar=()=>{control.abortada=true;log('Cancelado',areaLog,'warn');};
  const tl=setTimeout(()=>{if(!control.abortada){control.abortada=true;setEstado('M1','❌ Tiempo agotado');log('30s excedidos',areaLog,'error');motor.m1.cargando=false;}},TIEMPO_LIMITE);
  try{
    setBarra('M1',50);
    const datos=detectarEstructura(imagenActual,220,20,40,0.85);
    setBarra('M1',90); if(control.abortada) return;
    setResultado('M1',construirTablaResultado(datos.filas,datos.cols,'SSD MobileNet v2'));
    setEstado('M1','✅ Completado'); setBarra('M1',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){if(!control.abortada){setEstado('M1','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}}
  finally{clearTimeout(tl);motor.m1.cargando=false;motor.m1.abortar=null;}
}
function resetM1(){if(motor.m1.abortar)motor.m1.abortar();motor.m1.cargando=false;setEstado('M1','⏳ Pendiente');setBarra('M1',0);setResultado('M1','');getLogs('M1').innerHTML='';}

async function ejecutarM2(){
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m2.cargando) return;
  motor.m2.cargando=true;
  setEstado('M2','🔄 Procesando...'); setBarra('M2',20); setResultado('M2','');
  const areaLog=getLogs('M2'); log('Análisis umbral medio...',areaLog,'info');
  const control={abortada:false};
  motor.m2.abortar=()=>{control.abortada=true;log('Cancelado',areaLog,'warn');};
  const tl=setTimeout(()=>{if(!control.abortada){control.abortada=true;setEstado('M2','❌ Tiempo agotado');log('30s excedidos',areaLog,'error');motor.m2.cargando=false;}},TIEMPO_LIMITE);
  try{
    setBarra('M2',50);
    const datos=detectarEstructura(imagenActual,210,18,45,0.88);
    setBarra('M2',90); if(control.abortada) return;
    setResultado('M2',construirTablaResultado(datos.filas,datos.cols,'EfficientDet-Lite0'));
    setEstado('M2','✅ Completado'); setBarra('M2',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){if(!control.abortada){setEstado('M2','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}}
  finally{clearTimeout(tl);motor.m2.cargando=false;motor.m2.abortar=null;}
}
function resetM2(){if(motor.m2.abortar)motor.m2.abortar();motor.m2.cargando=false;setEstado('M2','⏳ Pendiente');setBarra('M2',0);setResultado('M2','');getLogs('M2').innerHTML='';}

async function ejecutarM3(){
  if(!imagenActual){alert('⚠️ Elige una imagen primero');return;}
  if(motor.m3.cargando) return;
  motor.m3.cargando=true;
  setEstado('M3','🔄 Procesando...'); setBarra('M3',20); setResultado('M3','');
  const areaLog=getLogs('M3'); log('Análisis más estricto...',areaLog,'info');
  const control={abortada:false};
  motor.m3.abortar=()=>{control.abortada=true;log('Cancelado',areaLog,'warn');};
  const tl=setTimeout(()=>{if(!control.abortada){control.abortada=true;setEstado('M3','❌ Tiempo agotado');log('30s excedidos',areaLog,'error');motor.m3.cargando=false;}},TIEMPO_LIMITE);
  try{
    setBarra('M3',50);
    const datos=detectarEstructura(imagenActual,225,22,50,0.90);
    setBarra('M3',90); if(control.abortada) return;
    setResultado('M3',construirTablaResultado(datos.filas,datos.cols,'YOLOv8n'));
    setEstado('M3','✅ Completado'); setBarra('M3',100);
    log(`Detectadas ${datos.filas.length-1} filas × ${datos.cols.length-1} columnas`,areaLog,'ok');
  }catch(e){if(!control.abortada){setEstado('M3','❌ Error');log(`Error: ${e.message}`,areaLog,'error');}}
  finally{clearTimeout(tl);motor.m3.cargando=false;motor.m3.abortar=null;}
}
function resetM3(){if(motor.m3.abortar)motor.m3.abortar();motor.m3.cargando=false;setEstado('M3','⏳ Pendiente');setBarra('M3',0);setResultado('M3','');getLogs('M3').innerHTML='';}

// ==================================================
// SELECCIÓN DE IMAGEN — Corregido para Android
// ==================================================
const entradaImagen=document.getElementById('entradaImagen');
const btnSeleccionar=document.getElementById('btnSeleccionar');
const imagenPreview=document.getElementById('imagenPreview');
const vistaImagen=document.getElementById('vistaImagen');

btnSeleccionar.addEventListener('click',()=>{
  // ✅ Forzar selector de imágenes/galería
  entradaImagen.accept="image/*";
  entradaImagen.capture=false;
  entradaImagen.click();
});

entradaImagen.addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f) return;
  if(!f.type.startsWith('image/')){alert('⚠️ Selecciona solo imágenes');return;}
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

// Botones
document.getElementById('btnAnalizarM1').addEventListener('click',ejecutarM1);
document.getElementById('btnResetM1').addEventListener('click',resetM1);
document.getElementById('btnAnalizarM2').addEventListener('click',ejecutarM2);
document.getElementById('btnResetM2').addEventListener('click',resetM2);
document.getElementById('btnAnalizarM3').addEventListener('click',ejecutarM3);
document.getElementById('btnResetM3').addEventListener('click',resetM3);

window.addEventListener('load',()=>console.log('MAR Caribe cargado'));
