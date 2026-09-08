const TIEMPO_MAX=20000;
const pantallaCarga=document.getElementById('pantallaCarga'),barraProgreso=document.getElementById('barraProgreso'),estadoCarga=document.getElementById('estadoCarga'),estadoTF=document.getElementById('estadoTF'),estadoTFLite=document.getElementById('estadoTFLite'),estadoSSD=document.getElementById('estadoSSD'),estadoEfficient=document.getElementById('estadoEfficient'),pantallaPrincipal=document.getElementById('pantallaPrincipal'),entradaImagen=document.getElementById('entradaImagen'),btnSeleccionar=document.getElementById('btnSeleccionar'),vistaImagen=document.getElementById('vistaImagen'),imagenPreview=document.getElementById('imagenPreview'),btnAnalizar=document.getElementById('btnAnalizar'),resultadoTabla=document.getElementById('resultadoTabla'),contenedorTabla=document.getElementById('contenedorTabla'),btnNuevaImagen=document.getElementById('btnNuevaImagen');
let modeloSSD=null,modeloEfficient=null,imagenActual=null;
const RUTA_SSD='assets/models/ssd_mobilenet_v2.tflite',RUTA_EFFICIENT='assets/models/efficientdet_lite0.tflite';

function esperarLibreria(nombre,condicion,elem){
  return new Promise(resolve=>{
    log(`⌛ Cargando ${nombre}... máx 20s`,'info');
    const inicio=Date.now();
    const intervalo=setInterval(()=>{
      if(condicion()){clearInterval(intervalo);elem.textContent=`✅ ${nombre}: Cargado`;log(`✅ ${nombre} listo`,'ok');resolve(true);}
      else if(Date.now()-inicio>=TIEMPO_MAX){clearInterval(intervalo);elem.textContent=`❌ ${nombre}: Tiempo agotado`;log(`❌ ${nombre} no cargó en 20s → salto`,'error');resolve(false);}
    },200);
  });
}

async function cargarModelo(ruta,nombre,elem){
  log(`🤖 ${nombre}... máx 20s`,'info');
  elem.textContent=`⏳ ${nombre}: Cargando...`;
  try{
    if(!window.tf||!window.tf.tflite)throw new Error('Librería no disponible');
    const m=await Promise.race([
      tf.tflite.loadTFLiteModel(ruta),
      new Promise((_,r)=>setTimeout(()=>r(new Error('Tiempo agotado')),TIEMPO_MAX))
    ]);
    elem.textContent=`✅ ${nombre}: Cargado`;log(`✅ ${nombre} OK`,'ok');return m;
  }catch(e){
    elem.textContent=`⚠️ ${nombre}: ${e.message}`;log(`⚠️ ${nombre} salta: ${e.message}`,'warn');return null;
  }
}

function analizarTabla(img){
  log('🔍 Analizando tabla...','info');
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data,umbral=90,h=[],v=[];
  for(let y=0;y<c.height;y+=2){let n=0;for(let x=0;x<c.width;x++)if((d[(y*c.width+x)*4]+d[(y*c.width+x)*4+1]+d[(y*c.width+x)*4+2])/3<umbral)n++;if(n>c.width*0.25)h.push(y);}
  for(let x=0;x<c.width;x+=2){let n=0;for(let y=0;y<c.height;y++)if((d[(y*c.width+x)*4]+d[(y*c.width+x)*4+1]+d[(y*c.width+x)*4+2])/3<umbral)n++;if(n>c.height*0.25)v.push(x);}
  const filas=[],cols=[];let ult=-9999;h.forEach(y=>{if(y-ult>12){filas.push(y);ult=y;}});ult=-9999;v.forEach(x=>{if(x-ult>12){cols.push(x);ult=x;}});
  log(`✅ ${filas.length} filas, ${cols.length} columnas`,'ok');return{filas,cols};
}

function construirTabla(datos){
  const{filas,cols}=datos;
  if(filas.length<2||cols.length<2)return'<p style="color:red">⚠️ No se detectó tabla</p>';
  let h='<table>';for(let f=0;f<filas.length-1;f++){h+='<tr>';for(let c=0;c<cols.length-1;c++){const t=f===0?'th':'td';h+=`<${t}>${f+1},${c+1}</${t}>`;}h+='</tr>';}return h+'</table>';
}

async function iniciar(){
  log('🚀 Iniciando... 20s máx por cada uno','info');
  estadoCarga.textContent='Cargando TF.js...';
  const tfOK=await esperarLibreria('TF.js',()=>window.tf,estadoTF);
  barraProgreso.style.width='20%';

  estadoCarga.textContent='Cargando TFLite...';
  const tfliteOK=tfOK?await esperarLibreria('TFLite',()=>window.tf&&window.tf.tflite,estadoTFLite):false;
  barraProgreso.style.width='40%';

  estadoCarga.textContent='SSD MobileNet...';
  modeloSSD=tfliteOK?await cargarModelo(RUTA_SSD,'SSD MobileNet v2',estadoSSD):(estadoSSD.textContent='⚠️ Se salta',null);
  barraProgreso.style.width='70%';

  estadoCarga.textContent='EfficientDet...';
  modeloEfficient=tfliteOK?await cargarModelo(RUTA_EFFICIENT,'EfficientDet-Lite0',estadoEfficient):(estadoEfficient.textContent='⚠️ Se salta',null);
  barraProgreso.style.width='100%';

  estadoCarga.textContent=tfliteOK?'✅ Todo listo':'⚠️ App lista — modelos AI no disponibles';
  log('🎉 Interfaz lista','ok');
  setTimeout(()=>{pantallaCarga.classList.add('oculto');pantallaPrincipal.classList.remove('oculto');},500);
}

btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
entradaImagen.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=evt=>{imagenActual=new Image();imagenActual.onload=()=>{imagenPreview.src=evt.target.result;vistaImagen.classList.remove('oculto');resultadoTabla.classList.add('oculto');log('✅ Imagen cargada','ok');};imagenActual.src=evt.target.result;};r.readAsDataURL(f);});
btnAnalizar.addEventListener('click',()=>{if(!imagenActual)return;contenedorTabla.innerHTML=construirTabla(analizarTabla(imagenActual));vistaImagen.classList.add('oculto');resultadoTabla.classList.remove('oculto');});
btnNuevaImagen.addEventListener('click',()=>{entradaImagen.value='';imagenActual=null;imagenPreview.src='';vistaImagen.classList.add('oculto');resultadoTabla.classList.add('oculto');log('🔄 Lista para nueva','info');});
window.addEventListener('load',iniciar);
