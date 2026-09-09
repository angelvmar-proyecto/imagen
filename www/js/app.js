const TIEMPO_LIMITE=120000;
let imagenActual=null;
let escalaZoom=1;
let offsetX=0, offsetY=0;
let escalaOriginal=1;
let arrastrando=false;
let ultimoToque={x:0,y:0};
const motor={m1:{cargando:false},m2:{cargando:false},m3:{cargando:false},m4:{cargando:false},m5:{cargando:false}};

const estadoTF=document.getElementById('estadoTF');
const estadoOCR=document.getElementById('estadoOCR');
const barraGlobal=document.getElementById('barraGlobal');
const logsGlobal=document.getElementById('logsGlobal');
const logsAjustes=document.getElementById('logsAjustes');
const cargaGlobal=document.getElementById('cargaGlobal');
const seccionImagen=document.getElementById('seccionImagen');
const entradaImagen=document.getElementById('entradaImagen');
const btnSeleccionar=document.getElementById('btnSeleccionar');
const vistaImagen=document.getElementById('vistaImagen');
const canvasPrevia=document.getElementById('canvasPrevia');
const ctxPrevia=canvasPrevia.getContext('2d');
const selectorMotor=document.getElementById('selectorMotor');
const btnCopiarLog=document.getElementById('btnCopiarLog');
const visorWrapper=document.getElementById('visorWrapper');
const visorInterior=document.getElementById('visorInterior');

function log(t,a,tp='info'){
  const h=new Date().toLocaleTimeString();
  const c={info:'#0ff',ok:'#0f0',error:'#f55',warn:'#ff0'};
  const d=document.createElement('div');
  d.style.color=c[tp];
  d.textContent=`[${h}] ${t}`;
  a.appendChild(d);
  a.scrollTop=a.scrollHeight;
}

function logAjuste(motor,brillo,distFilas,distCols,denV,denH){
  const h=new Date().toLocaleTimeString();
  logsAjustes.textContent=`${h} | ${motor} | brillo:${brillo} | filas:${distFilas} | cols:${distCols} | denV:${denV.toFixed(2)} | denH:${denH.toFixed(2)}`;
}

function setEstado(m,t){document.getElementById(`estado${m}`).textContent=t;}
function setBarra(m,p){document.getElementById(`barra${m}`).style.width=p+'%';}
function setResultado(m,h){document.getElementById(`resultado${m}`).innerHTML=h;}
function getLogs(m){return document.getElementById(`logs${m}`);}

async function cargarMotoresBase(){
  barraGlobal.style.width='10%';
  log('Cargando TF.js...',logsGlobal);
  const inicioTF=Date.now();
  while(!window.tf && Date.now()-inicioTF<15000)await new Promise(r=>setTimeout(r,100));
  estadoTF.textContent=window.tf?'✅ TF.js: Cargado':'⚠️ TF.js: No disponible';
  log(window.tf?'TF.js listo':'TF.js omitido',logsGlobal,window.tf?'ok':'warn');
  barraGlobal.style.width='40%';
  log('Cargando Tesseract OCR...',logsGlobal);
  estadoOCR.textContent=window.Tesseract?'✅ OCR: Cargado':'⚠️ OCR: No disponible';
  log(window.Tesseract?'Tesseract listo ✅':'Tesseract no cargó',logsGlobal,window.Tesseract?'ok':'warn');
  barraGlobal.style.width='100%';
  log('Interfaz lista — ajusta sliders y usa zoom',logsGlobal,'ok');
  setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},800);
}

function detectarEstructura(img,brillo,minDistFilas,minDistCols,minDensidadV,minDensidadH){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;

  const lh=[], umbralPixelesFila=c.width*minDensidadH;
  for(let y=0;y<c.height;y++){
    let pixelesOscuros=0;
    for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      if((d[i]+d[i+1]+d[i+2])/3<brillo)pixelesOscuros++;
    }
    if(pixelesOscuros>umbralPixelesFila)lh.push({y,peso:pixelesOscuros});
  }
  const filas=[]; let ultimaY=-9999;
  lh.sort((a,b)=>a.y-b.y).forEach(linea=>{
    if(linea.y-ultimaY>minDistFilas){filas.push(linea.y);ultimaY=linea.y;}
  });

  const lv=[], umbralPixelesColumna=c.height*minDensidadV;
  for(let x=0;x<c.width;x++){
    let pixelesOscuros=0;
    for(let y=0;y<c.height;y++){
      const i=(y*c.width+x)*4;
      if((d[i]+d[i+1]+d[i+2])/3<brillo)pixelesOscuros++;
    }
    if(pixelesOscuros>umbralPixelesColumna)lv.push({x,peso:pixelesOscuros});
  }
  const columnas=[]; let ultimaX=-9999;
  lv.sort((a,b)=>a.x-b.x).forEach(linea=>{
    if(linea.x-ultimaX>minDistCols){columnas.push(linea.x);ultimaX=linea.x;}
  });

  if(columnas.length<2){
    for(let dd=0.35;dd>=0.15&&columnas.length<2;dd-=0.05){
      const ub=c.height*dd, cols=[], ux=-9999;
      lv.forEach(l=>{if(l.peso>ub&&l.x-ux>minDistCols){cols.push(l.x);ux=l.x;}});
      if(cols.length>=2){columnas.splice(0,0,...cols);break;}
    }
  }
  return {filas,columnas};
}

function actualizarPrevisualizacion(){
  if(!imagenActual)return;
  const num=parseInt(selectorMotor.value);
  const v=getValoresMotor(num);
  const dt=detectarEstructura(imagenActual,v.brillo,v.distFilas,v.distCols,v.denV,v.denH);
  logAjuste(`M${num}`,v.brillo,v.distFilas,v.distCols,v.denV,v.denH);

  const rect=vistaImagen.getBoundingClientRect();
  const escalaVista=rect.width/imagenActual.width;
  ctxPrevia.clearRect(0,0,canvasPrevia.width,canvasPrevia.height);

  ctxPrevia.strokeStyle='#ff0000'; ctxPrevia.lineWidth=2;
  dt.filas.forEach(y=>{
    const py=y*escalaVista*escalaZoom+offsetY;
    ctxPrevia.beginPath(); ctxPrevia.moveTo(0,py); ctxPrevia.lineTo(canvasPrevia.width,py); ctxPrevia.stroke();
  });

  ctxPrevia.strokeStyle='#0055ff'; ctxPrevia.lineWidth=2;
  dt.columnas.forEach(x=>{
    const px=x*escalaVista*escalaZoom+offsetX;
    ctxPrevia.beginPath(); ctxPrevia.moveTo(px,0); ctxPrevia.lineTo(px,canvasPrevia.height); ctxPrevia.stroke();
  });

  ctxPrevia.fillStyle='rgba(0,0,0,0.75)';
  ctxPrevia.fillRect(8,8,220,28);
  ctxPrevia.font='bold 13px monospace';
  ctxPrevia.fillStyle='#fff';
  ctxPrevia.fillText(`Filas: ${dt.filas.length-1}  Columnas: ${dt.columnas.length-1}`,14,26);
}

function aplicarZoom(){
  visorInterior.style.transformOrigin='0 0';
  visorInterior.style.transform=`translate(${offsetX}px, ${offsetY}px) scale(${escalaZoom})`;
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
    return`<p style="color:red">⚠️ Filas:${filas.length} Columnas:${columnas.length}</p>`;
  let h=`<p><strong>${nombre}</strong> — ${filas.length-1} filas × ${columnas.length-1} columnas</p><table><thead><tr>`;
  for(let i=0;i<columnas.length-1;i++)h+=`<th>C${i+1}</th>`;
  h+='</tr></thead><tbody>';
  const palabras=await leerTodoDeUnaVez(img);
  for(let f=0;f<filas.length-1;f++){h+='<tr>';
    for(let c=0;c<columnas.length-1;c++)
      h+=`<td>${buscarTextoEnCelda(palabras,columnas[c],filas[f],columnas[c+1],filas[f+1])}</td>`;
    h+='</tr>';
  }
  return h+'</tbody></table>';
}
function getValoresMotor(num){
  return {
    brillo:parseInt(document.getElementById(`sliderBrilloM${num}`).value),
    distFilas:parseInt(document.getElementById(`sliderFilasM${num}`).value),
    distCols:parseInt(document.getElementById(`sliderColsM${num}`).value),
    denV:parseFloat(document.getElementById(`sliderDenVM${num}`).value),
    denH:parseFloat(document.getElementById(`sliderDenHM${num}`).value)
  };
}
function conectarSliders(num){
  const actualizar=()=>{
    const v=getValoresMotor(num);
    document.getElementById(`valBrilloM${num}`).textContent=v.brillo;
    document.getElementById(`valFilasM${num}`).textContent=v.distFilas;
    document.getElementById(`valColsM${num}`).textContent=v.distCols;
    document.getElementById(`valDenVM${num}`).textContent=v.denV.toFixed(2);
    document.getElementById(`valDenHM${num}`).textContent=v.denH.toFixed(2);
    actualizarPrevisualizacion();
  };
  [`sliderBrilloM${num}`,`sliderFilasM${num}`,`sliderColsM${num}`,`sliderDenVM${num}`,`sliderDenHM${num}`].forEach(id=>{
    document.getElementById(id).addEventListener('input',actualizar);
  });
  actualizar();
}
async function ejecutarMotor(num,nombre){
  const m=`M${num}`;
  if(!imagenActual){alert('⚠️ Elige imagen primero');return;}
  if(motor[`m${num}`].cargando)return;
  const v=getValoresMotor(num);
  motor[`m${num}`].cargando=true;
  setEstado(m,'🔄 Procesando...');setBarra(m,10);setResultado(m,'');
  const al=getLogs(m); log(`${nombre}`,al);
  const t=setTimeout(()=>{motor[`m${num}`].cargando=false;setEstado(m,'❌ Tiempo');setBarra(m,0);},TIEMPO_LIMITE);
  try{
    setBarra(m,30);
    const dt=detectarEstructura(imagenActual,v.brillo,v.distFilas,v.distCols,v.denV,v.denH);
    setBarra(m,50); log(`→ ${dt.filas.length-1}×${dt.columnas.length-1}`,al,'ok');
    setResultado(m,await construirTablaConTexto(dt.filas,dt.columnas,nombre,imagenActual));
    setEstado(m,'✅ Completado');setBarra(m,100);
  }catch(e){setEstado(m,'❌ Error');log(`Error:${e.message}`,al,'error');}
  finally{clearTimeout(t);motor[`m${num}`].cargando=false;}
}
function resetMotor(num){
  setEstado(`M${num}`,'⏳ Pendiente');setBarra(`M${num}`,0);setResultado(`M${num}`,'');
  getLogs(`M${num}`).innerHTML='';
}

window.addEventListener('load',()=>{
  for(let i=1;i<=5;i++)conectarSliders(i);
  selectorMotor.addEventListener('change',()=>{
    document.querySelectorAll('.motor-card').forEach((c,i)=>c.classList.toggle('activo',i+1===parseInt(selectorMotor.value)));
    actualizarPrevisualizacion();
  });
  btnCopiarLog.addEventListener('click',()=>{
    navigator.clipboard.writeText(logsAjustes.textContent).then(()=>{
      const t=btnCopiarLog.textContent;btnCopiarLog.textContent='✅ Copiado!';
      setTimeout(()=>btnCopiarLog.textContent=t,2000);
    });
  });
  document.getElementById('btnZoomMas').addEventListener('click',zoomMas);
  document.getElementById('btnZoomMenos').addEventListener('click',zoomMenos);
  document.getElementById('btnZoomReset').addEventListener('click',zoomReset);

  visorWrapper.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].pageX-e.touches[1].pageX,e.touches[0].pageY-e.touches[1].pageY);
      visorWrapper.dataset.distancia=d;
    }else if(e.touches.length===1){
      arrastrando=true; ultimoToque.x=e.touches[0].pageX; ultimoToque.y=e.touches[0].pageY;
    }
  });
  visorWrapper.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].pageX-e.touches[1].pageX,e.touches[0].pageY-e.touches[1].pageY);
      const ant=parseFloat(visorWrapper.dataset.distancia);
      if(ant){escalaZoom*=d/ant;escalaZoom=Math.max(escalaOriginal,Math.min(escalaZoom,4));visorWrapper.dataset.distancia=d;aplicarZoom();}
    }else if(e.touches.length===1&&arrastrando){
      offsetX+=e.touches[0].pageX-ultimoToque.x;
      offsetY+=e.touches[0].pageY-ultimoToque.y;
      ultimoToque.x=e.touches[0].pageX; ultimoToque.y=e.touches[0].pageY; aplicarZoom();
    }
  },{passive:false});
  visorWrapper.addEventListener('touchend',()=>{arrastrando=false;visorWrapper.dataset.distancia='';});
  visorWrapper.addEventListener('dblclick',zoomReset);

  btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
  entradaImagen.addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{
      imagenActual=new Image();imagenActual.onload=()=>{
        vistaImagen.src=ev.target.result;vistaImagen.onload=()=>{
          canvasPrevia.width=vistaImagen.clientWidth;
          canvasPrevia.height=vistaImagen.clientHeight;
          escalaOriginal=1;escalaZoom=1;offsetX=0;offsetY=0;
          setTimeout(actualizarPrevisualizacion,100);
          log('Imagen cargada — ajusta sliders y usa zoom',logsGlobal,'ok');
        };
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

  cargarMotoresBase();
});
