const TIEMPO_LIMITE=120000;
let imagenActual=null;
let escalaZoom=1;
let offsetX=0, offsetY=0;
let escalaOriginal=1;
let arrastrando=false;
let ultimoToque={x:0,y:0};
let lineasFilas=[];
let lineasColumnas=[];
let lineaSeleccionada=null;
let modoEdicion=false;
const motor={m1:{cargando:false},m2:{cargando:false},m3:{cargando:false},m4:{cargando:false},m5:{cargando:false}};

const estadoTF=document.getElementById('estadoTF');
const estadoOCR=document.getElementById('estadoOCR');
const barraGlobal=document.getElementById('barraGlobal');
const logsGlobal=document.getElementById('logsGlobal');
const logsAjustes=document.getElementById('logsAjustes');
const cargaGlobal=document.getElementById('cargaGlobal');
const seccionImagen=document.getElementById('seccionImagen');
const entradaImagen=document.getElementById('entradaImagen');
const vistaImagen=document.getElementById('vistaImagen');
const canvasPrevia=document.getElementById('canvasPrevia');
const ctxPrevia=canvasPrevia.getContext('2d');
const selectorMotor=document.getElementById('selectorMotor');
const btnCopiarLog=document.getElementById('btnCopiarLog');
const visorWrapper=document.getElementById('visorWrapper');
const visorInterior=document.getElementById('visorInterior');
const sensibilidad=document.getElementById('sensibilidad');
const espaciadoMinimo=document.getElementById('espaciadoMinimo');
const btnModoEditar=document.getElementById('btnModoEditar');
const btnAgregarFila=document.getElementById('btnAgregarFila');
const btnAgregarColumna=document.getElementById('btnAgregarColumna');
const btnBorrarLinea=document.getElementById('btnBorrarLinea');
const btnGuardarConfig=document.getElementById('btnGuardarConfig');
const btnCargarConfig=document.getElementById('btnCargarConfig');

function log(t,a,tp='info'){
  const h=new Date().toLocaleTimeString();
  const c={info:'#00ccff',ok:'#00ff00',error:'#ff4444',warn:'#ffcc00'};
  const d=document.createElement('div');
  d.style.color=c[tp];
  d.textContent=`[${h}] ${t}`;
  a.appendChild(d);
  a.scrollTop=a.scrollHeight;
}

function logAjuste(sens,esp,filas,cols){
  const h=new Date().toLocaleTimeString();
  logsAjustes.textContent=`${h} | Sensibilidad:${sens} | Espaciado:${esp} | Filas:${filas.length} | Columnas:${cols.length}`;
}

function setEstado(m,t){document.getElementById(`estado${m}`).textContent=t;}
function setBarra(m,p){document.getElementById(`barra${m}`).style.width=p+'%';}
function setResultado(m,h){document.getElementById(`resultado${m}`).innerHTML=h;}
function getLogs(m){return document.getElementById(`logs${m}`);}

// ✅ CARGA DE LIBRERÍAS LOCALES — IGUAL QUE ANTES
async function cargarLibrerias(){
  barraGlobal.style.width='10%';
  log('Verificando TF.js...',logsGlobal);
  const inicioTF=Date.now();
  while(!window.tf && Date.now()-inicioTF<15000){
    await new Promise(r=>setTimeout(r,100));
  }
  estadoTF.textContent=window.tf?'✅ TF.js: Cargado':'⚠️ TF.js: No disponible';
  log(window.tf?'TF.js cargado correctamente':'TF.js no disponible',logsGlobal,window.tf?'ok':'warn');

  barraGlobal.style.width='40%';
  log('Verificando Tesseract/OCR...',logsGlobal);
  const inicioOCR=Date.now();
  while(!window.Tesseract && Date.now()-inicioOCR<15000){
    await new Promise(r=>setTimeout(r,100));
  }
  estadoOCR.textContent=window.Tesseract?'✅ OCR: Cargado':'⚠️ OCR: No disponible';
  log(window.Tesseract?'OCR cargado correctamente':'OCR no disponible',logsGlobal,window.Tesseract?'ok':'warn');

  barraGlobal.style.width='100%';
  log('Sistema listo — carga imagen para comenzar',logsGlobal,'ok');
  setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},800);
}

function mapearSensibilidad(valor){
  const mapa={
    bajo: {brillo:220,denV:0.45,denH:0.12},
    medio:{brillo:200,denV:0.35,denH:0.08},
    alto: {brillo:180,denV:0.25,denH:0.05}
  };
  return mapa[valor]||mapa.medio;
}

function mapearEspaciado(valor){return parseInt(valor);}

function detectarEstructuraAutomatica(img){
  const sensVal=sensibilidad.value;
  const espVal=mapearEspaciado(espaciadoMinimo.value);
  const params=mapearSensibilidad(sensVal);

  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width;c.height=img.height;
  ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;

  const lh=[], umbralFila=c.width*params.denH;
  for(let y=0;y<c.height;y++){
    let pix=0;
    for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      if((d[i]+d[i+1]+d[i+2])/3<params.brillo)pix++;
    }
    if(pix>umbralFila)lh.push({y,peso:pix});
  }
  const filas=[];let ultimaY=-9999;
  lh.sort((a,b)=>a.y-b.y).forEach(l=>{if(l.y-ultimaY>espVal){filas.push(l.y);ultimaY=l.y;}});

  const lv=[], umbralCol=c.height*params.denV;
  for(let x=0;x<c.width;x++){
    let pix=0;
    for(let y=0;y<c.height;y++){
      const i=(y*c.width+x)*4;
      if((d[i]+d[i+1]+d[i+2])/3<params.brillo)pix++;
    }
    if(pix>umbralCol)lv.push({x,peso:pix});
  }
  const columnas=[];let ultimaX=-9999;
  lv.sort((a,b)=>a.x-b.x).forEach(l=>{if(l.x-ultimaX>espVal){columnas.push(l.x);ultimaX=l.x;}});

  if(columnas.length<2){
    for(let dd=0.30;dd>=0.12&&columnas.length<2;dd-=0.03){
      const ub=c.height*dd, cols=[];let ux=-9999;
      lv.forEach(l=>{if(l.peso>ub&&l.x-ux>espVal){cols.push(l.x);ux=l.x;}});
      if(cols.length>=2){columnas.splice(0,0,...cols);break;}
    }
  }
  return {filas,columnas};
}

function actualizarPrevisualizacion(){
  if(!imagenActual)return;
  const sensVal=sensibilidad.value;
  const espVal=espaciadoMinimo.value;
  const rect=vistaImagen.getBoundingClientRect();
  const escalaVista=rect.width/imagenActual.width;

  ctxPrevia.clearRect(0,0,canvasPrevia.width,canvasPrevia.height);

  lineasFilas.forEach(y=>{
    const py=y*escalaVista*escalaZoom+offsetY;
    ctxPrevia.beginPath();
    ctxPrevia.moveTo(0,py);
    ctxPrevia.lineTo(canvasPrevia.width,py);
    ctxPrevia.strokeStyle=(lineaSeleccionada?.tipo==='fila'&&lineaSeleccionada.valor===y)?'#ffff00':'#ff0000';
    ctxPrevia.lineWidth=2;
    ctxPrevia.stroke();
  });

  lineasColumnas.forEach(x=>{
    const px=x*escalaVista*escalaZoom+offsetX;
    ctxPrevia.beginPath();
    ctxPrevia.moveTo(px,0);
    ctxPrevia.lineTo(px,canvasPrevia.height);
    ctxPrevia.strokeStyle=(lineaSeleccionada?.tipo==='columna'&&lineaSeleccionada.valor===x)?'#ffff00':'#0055ff';
    ctxPrevia.lineWidth=2;
    ctxPrevia.stroke();
  });

  ctxPrevia.fillStyle='rgba(0,0,0,0.75)';
  ctxPrevia.fillRect(8,8,220,28);
  ctxPrevia.font='bold 13px monospace';
  ctxPrevia.fillStyle='#fff';
  ctxPrevia.fillText(`Filas: ${lineasFilas.length}  Columnas: ${lineasColumnas.length}`,14,26);

  logAjuste(sensVal,espVal,lineasFilas,lineasColumnas);
}

function aplicarZoom(){
  visorInterior.style.transformOrigin='0 0';
  visorInterior.style.transform=`translate(${offsetX}px,${offsetY}px) scale(${escalaZoom})`;
  actualizarPrevisualizacion();
}

function zoomMas(){escalaZoom=Math.min(escalaZoom+0.25,4);aplicarZoom();}
function zoomMenos(){escalaZoom=Math.max(escalaZoom-0.25,escalaOriginal);aplicarZoom();}
function zoomReset(){escalaZoom=escalaOriginal;offsetX=0;offsetY=0;aplicarZoom();}

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
    return`<p style="color:red">⚠️ Defina al menos 2 filas y 2 columnas</p>`;
  let h=`<p><strong>${nombre}</strong> — ${filas.length-1} filas × ${columnas.length-1} columnas</p><table><thead><tr>`;
  for(let i=0;i<columnas.length-1;i++)h+=`<th>C${i+1}</th>`;
  h+='</tr></thead><tbody>';
  const palabras=await leerTodoDeUnaVez(img);
  filas.sort((a,b)=>a-b);columnas.sort((a,b)=>a-b);
  for(let f=0;f<filas.length-1;f++){
    h+='<tr>';
    for(let c=0;c<columnas.length-1;c++)
      h+=`<td>${buscarTextoEnCelda(palabras,columnas[c],filas[f],columnas[c+1],filas[f+1])}</td>`;
    h+='</tr>';
  }
  return h+'</tbody></table>';
}

async function ejecutarMotor(num,nombre){
  const m=`M${num}`;
  if(!imagenActual){alert('⚠️ Cargue una imagen primero');return;}
  if(lineasFilas.length<2||lineasColumnas.length<2){alert('⚠️ Defina al menos 2 filas y 2 columnas');return;}
  if(motor[`m${num}`].cargando)return;

  motor[`m${num}`].cargando=true;
  setEstado(m,'🔄 Procesando...');setBarra(m,10);setResultado(m,'');
  const al=getLogs(m);log(`${nombre} usando líneas definidas`,al);

  const t=setTimeout(()=>{motor[`m${num}`].cargando=false;setEstado(m,'❌ Tiempo agotado');setBarra(m,0);},TIEMPO_LIMITE);
  try{
    setBarra(m,30);
    const filasOrd=[...lineasFilas].sort((a,b)=>a-b);
    const colsOrd=[...lineasColumnas].sort((a,b)=>a-b);
    setBarra(m,50);log(`→ ${filasOrd.length-1}×${colsOrd.length-1} celdas`,al,'ok');
    setResultado(m,await construirTablaConTexto(filasOrd,colsOrd,nombre,imagenActual));
    setEstado(m,'✅ Completado');setBarra(m,100);
  }catch(e){setEstado(m,'❌ Error');log(`Error:${e.message}`,al,'error');}
  finally{clearTimeout(t);motor[`m${num}`].cargando=false;}
}
function resetMotor(num){setEstado(`M${num}`,'⏳ Pendiente');setBarra(`M${num}`,0);setResultado(`M${num}`,'');getLogs(`M${num}`).innerHTML='';}

function recalcularLineas(){
  if(!imagenActual)return;
  const dt=detectarEstructuraAutomatica(imagenActual);
  lineasFilas=dt.filas;lineasColumnas=dt.columnas;
  lineaSeleccionada=null;
  actualizarPrevisualizacion();
}

function guardarConfiguracion(){
  const config={sensibilidad:sensibilidad.value,espaciado:espaciadoMinimo.value,filas:lineasFilas,columnas:lineasColumnas};
  localStorage.setItem('marCaribeConfig',JSON.stringify(config));
  alert('✅ Configuración guardada como estándar');
}

function cargarConfiguracion(){
  const g=localStorage.getItem('marCaribeConfig');
  if(!g){alert('⚠️ No hay configuración guardada');return;}
  try{
    const c=JSON.parse(g);
    sensibilidad.value=c.sensibilidad;
    espaciadoMinimo.value=c.espaciado;
    lineasFilas=c.filas||[];
    lineasColumnas=c.columnas||[];
    actualizarPrevisualizacion();
    alert('✅ Configuración cargada');
  }catch{alert('❌ Error al cargar configuración');}
}

let modoAgregar=null;
function iniciarAgregarFila(){modoAgregar='fila';alert('Toque la imagen para agregar fila horizontal');}
function iniciarAgregarColumna(){modoAgregar='columna';alert('Toque la imagen para agregar columna vertical');}

function obtenerCoordenadaImagen(x,y){
  const r=vistaImagen.getBoundingClientRect();
  const escalaVista=imagenActual?imagenActual.width/r.width:1;
  return {
    x:Math.max(0,Math.min(imagenActual.width,(x-offsetX)/escalaZoom*escalaVista)),
    y:Math.max(0,Math.min(imagenActual.height,(y-offsetY)/escalaZoom*escalaVista))
  };
}

function manejarToqueEdicion(x,y){
  if(!modoEdicion||!imagenActual)return;
  const {x:imgX,y:imgY}=obtenerCoordenadaImagen(x,y);

  if(modoAgregar==='fila'){
    lineasFilas.push(imgY);lineasFilas.sort((a,b)=>a-b);modoAgregar=null;actualizarPrevisualizacion();return true;
  }
  if(modoAgregar==='columna'){
    lineasColumnas.push(imgX);lineasColumnas.sort((a,b)=>a-b);modoAgregar=null;actualizarPrevisualizacion();return true;
  }

  const umbral=10/escalaZoom;
  let masCerca=null,minD=umbral;
  lineasFilas.forEach((v,i)=>{const d=Math.abs(imgY-v);if(d<minD){minD=d;masCerca={tipo:'fila',indice:i,valor:v}}});
  lineasColumnas.forEach((v,i)=>{const d=Math.abs(imgX-v);if(d<minD){minD=d;masCerca={tipo:'columna',indice:i,valor:v}}});

  lineaSeleccionada=masCerca;
  if(masCerca)ultimoToque={x:imgX,y:imgY,valor:masCerca.valor};
  actualizarPrevisualizacion();
  return !!masCerca;
}

function moverLinea(x,y){
  if(!lineaSeleccionada||!modoEdicion||!imagenActual)return;
  const {x:imgX,y:imgY}=obtenerCoordenadaImagen(x,y);
  if(lineaSeleccionada.tipo==='fila'){
    lineasFilas[lineaSeleccionada.indice]=imgY;
    lineasFilas.sort((a,b)=>a-b);
  }else{
    lineasColumnas[lineaSeleccionada.indice]=imgX;
    lineasColumnas.sort((a,b)=>a-b);
  }
  actualizarPrevisualizacion();
}

function borrarLineaSeleccionada(){
  if(!lineaSeleccionada){alert('Seleccione primero una línea tocándola');return;}
  if(lineaSeleccionada.tipo==='fila')lineasFilas.splice(lineaSeleccionada.indice,1);
  else lineasColumnas.splice(lineaSeleccionada.indice,1);
  lineaSeleccionada=null;
  actualizarPrevisualizacion();
}

function toggleModoEdicion(){
  modoEdicion=!modoEdicion;
  btnModoEditar.textContent=modoEdicion?'✅ Bloquear Líneas':'✏️ Editar Líneas';
  [btnAgregarFila,btnAgregarColumna,btnBorrarLinea].forEach(b=>b.disabled=!modoEdicion);
  if(!modoEdicion){lineaSeleccionada=null;modoAgregar=null;actualizarPrevisualizacion();}
}

window.addEventListener('load',()=>{
  sensibilidad.addEventListener('change',recalcularLineas);
  espaciadoMinimo.addEventListener('input',recalcularLineas);

  btnModoEditar.addEventListener('click',toggleModoEdicion);
  btnAgregarFila.addEventListener('click',iniciarAgregarFila);
  btnAgregarColumna.addEventListener('click',iniciarAgregarColumna);
  btnBorrarLinea.addEventListener('click',borrarLineaSeleccionada);
  btnGuardarConfig.addEventListener('click',guardarConfiguracion);
  btnCargarConfig.addEventListener('click',cargarConfiguracion);

  btnCopiarLog.addEventListener('click',()=>{
    navigator.clipboard.writeText(logsAjustes.textContent).then(()=>{const t=btnCopiarLog.textContent;btnCopiarLog.textContent='✅ Copiado!';setTimeout(()=>btnCopiarLog.textContent=t,2000);});
  });

  document.getElementById('btnZoomMenos').addEventListener('click',zoomMenos);
  document.getElementById('btnZoomReset').addEventListener('click',zoomReset);
  document.getElementById('btnZoomMas').addEventListener('click',zoomMas);

  visorWrapper.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    if(modoEdicion){manejarToqueEdicion(t.clientX,t.clientY);return;}
    if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      visorWrapper.dataset.distancia=d;
    }else if(e.touches.length===1){
      arrastrando=true;ultimoToque.x=t.clientX;ultimoToque.y=t.clientY;
    }
  },{passive:false});

  visorWrapper.addEventListener('touchmove',e=>{
    e.preventDefault();
    const t=e.touches[0];
    if(modoEdicion&&lineaSeleccionada){moverLinea(t.clientX,t.clientY);return;}
    if(modoEdicion&&modoAgregar){manejarToqueEdicion(t.clientX,t.clientY);return;}
    if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      const ant=parseFloat(visorWrapper.dataset.distancia);
      if(ant){escalaZoom*=d/ant;escalaZoom=Math.max(escalaOriginal,Math.min(escalaZoom,4));visorWrapper.dataset.distancia=d;aplicarZoom();}
    }else if(e.touches.length===1&&arrastrando){
      offsetX+=t.clientX-ultimoToque.x;
      offsetY+=t.clientY-ultimoToque.y;
      ultimoToque.x=t.clientX;ultimoToque.y=t.clientY;
      aplicarZoom();
    }
  },{passive:false});

  visorWrapper.addEventListener('touchend',()=>{arrastrando=false;visorWrapper.dataset.distancia='';});
  visorWrapper.addEventListener('click',e=>{if(modoEdicion&&modoAgregar)manejarToqueEdicion(e.clientX,e.clientY);});

  entradaImagen.addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{
      imagenActual=new Image();imagenActual.onload=()=>{
        canvasPrevia.width=vistaImagen.clientWidth;
        canvasPrevia.height=vistaImagen.clientHeight;
        escalaZoom=escalaOriginal;offsetX=0;offsetY=0;
        recalcularLineas();
        log('Imagen cargada — ajuste sensibilidad o edite líneas',logsGlobal,'ok');
      };imagenActual.src=ev.target.result;
    };r.readAsDataURL(f);
  });

  document.getElementById('btnAnalizarM1').addEventListener('click',()=>ejecutarMotor(1,'SSD MobileNet v2'));
  document.getElementById('btnResetM1').addEventListener('click',()=>resetMotor(1));
  document.getElementById('btnAnalizarM2').addEventListener('click',()=>ejecutarMotor(2,'EfficientDet-Lite0'));
  document.getElementById('btnResetM2').addEventListener('click',()=>resetMotor(2));
  document.getElementById('btnAnalizarM3').addEventListener('click',()=>ejecutarMotor(3,'YOLOv8n'));
  document.getElementById('btnResetM3').addEventListener('click',()=>resetMotor(3));
  document.getElementById('btnAnalizarM4').addEventListener('click',()=>ejecutarMotor(4,'YOLOv11-Tabla'));
  document.getElementById('btnResetM4').addEventListener('click',()=>resetMotor(4));
  document.getElementById('btnAnalizarM5').addEventListener('click',()=>ejecutarMotor(5,'PaddleOCR Table'));
  document.getElementById('btnResetM5').addEventListener('click',()=>resetMotor(5));

  cargarLibrerias();
});
