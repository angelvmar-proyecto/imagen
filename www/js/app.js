const TIEMPO_LIMITE=120000;
let imagenActual=null;
const motor={m1:{cargando:false},m2:{cargando:false},m3:{cargando:false},m4:{cargando:false},m5:{cargando:false}};

// Elementos globales
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

// ==================================================
// SISTEMA DE LOGS — 2 CANALES: General + AJUSTES
// ==================================================
function log(t,a,tp='info'){
  const h=new Date().toLocaleTimeString();
  const c={info:'#0ff',ok:'#0f0',error:'#f55',warn:'#ff0'};
  const d=document.createElement('div');
  d.style.color=c[tp];
  d.textContent=`[${h}] ${t}`;
  a.appendChild(d);
  a.scrollTop=a.scrollHeight;
}

// 📋 LOG DE AJUSTES — CADA CAMBIO SE REGISTRA AQUÍ
function logAjuste(motor,brillo,distFilas,distCols,denV,denH){
  const h=new Date().toLocaleTimeString();
  const d=document.createElement('div');
  d.style.color='#ffd700';
  d.style.fontFamily='monospace';
  d.style.fontSize='12px';
  d.textContent=`[${h}] ${motor} | brillo:${brillo} | distFilas:${distFilas} | distCols:${distCols} | denV:${denV.toFixed(2)} | denH:${denH.toFixed(2)}`;
  logsAjustes.appendChild(d);
  logsAjustes.scrollTop=logsAjustes.scrollHeight;
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
  log(window.Tesseract?'Tesseract listo ✅':'Tesseract no cargó — solo estructura',logsGlobal,window.Tesseract?'ok':'warn');
  barraGlobal.style.width='100%';

  log('Interfaz lista — elige imagen y ajusta sliders',logsGlobal,'ok');
  log('📋 Log de ajustes ACTIVADO — cada cambio se registra abajo',logsGlobal,'ok');
  setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},800);
}

// ==================================================
// DETECCIÓN DE ESTRUCTURA — TOMA VALORES DE LOS SLIDERS
// ==================================================
function detectarEstructura(img,brillo,minDistFilas,minDistCols,minDensidadV,minDensidadH){
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;

  // DETECTAR FILAS
  const lh=[], umbralPixelesFila=c.width*minDensidadH;
  for(let y=0;y<c.height;y++){
    let pixelesOscuros=0;
    for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;
      const brilloPixel=(d[i]+d[i+1]+d[i+2])/3;
      if(brilloPixel<brillo)pixelesOscuros++;
    }
    if(pixelesOscuros>umbralPixelesFila)lh.push({y,peso:pixelesOscuros});
  }
  const filas=[]; let ultimaY=-9999;
  lh.sort((a,b)=>a.y-b.y).forEach(linea=>{
    if(linea.y-ultimaY>minDistFilas){
      filas.push(linea.y);
      ultimaY=linea.y;
    }
  });

  // DETECTAR COLUMNAS
  const lv=[], umbralPixelesColumna=c.height*minDensidadV;
  for(let x=0;x<c.width;x++){
    let pixelesOscuros=0;
    for(let y=0;y<c.height;y++){
      const i=(y*c.width+x)*4;
      const brilloPixel=(d[i]+d[i+1]+d[i+2])/3;
      if(brilloPixel<brillo)pixelesOscuros++;
    }
    if(pixelesOscuros>umbralPixelesColumna)lv.push({x,peso:pixelesOscuros});
  }
  const columnas=[]; let ultimaX=-9999;
  lv.sort((a,b)=>a.x-b.x).forEach(linea=>{
    if(linea.x-ultimaX>minDistCols){
      columnas.push(linea.x);
      ultimaX=linea.x;
    }
  });

  // Respaldo si hay pocas columnas
  if(columnas.length<2){
    for(let densidadBajar=0.35;densidadBajar>=0.15&&columnas.length<2;densidadBajar-=0.05){
      const umbralBajo=c.height*densidadBajar;
      const colsBajas=[], ultimaXB=-9999;
      lv.forEach(linea=>{
        if(linea.peso>umbralBajo&&linea.x-ultimaXB>minDistCols){
          colsBajas.push(linea.x);
          ultimaXB=linea.x;
        }
      });
      if(colsBajas.length>=2){columnas.splice(0,columnas.length,...colsBajas);break;}
    }
  }

  return {filas,columnas,brillo,minDistFilas,minDistCols,minDensidadV,minDensidadH,ancho:c.width,alto:c.height};
}

// OCR
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
    return`<p style="color:red">⚠️ Estructura incompleta<br>Filas detectadas: ${filas.length} — Columnas detectadas: ${columnas.length}</p>`;
  let h=`<p><strong>✅ ${nombre}</strong><br>FILAS: ${filas.length-1} — COLUMNAS: ${columnas.length-1}</p><table><thead><tr>`;
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

// ==================================================
// OBTENER VALORES DIRECTO DE LOS SLIDERS DE CADA MOTOR
// ==================================================
function getValoresMotor(num){
  return {
    brillo: parseInt(document.getElementById(`sliderBrilloM${num}`).value),
    distFilas: parseInt(document.getElementById(`sliderFilasM${num}`).value),
    distCols: parseInt(document.getElementById(`sliderColsM${num}`).value),
    denV: parseFloat(document.getElementById(`sliderDenVM${num}`).value),
    denH: parseFloat(document.getElementById(`sliderDenHM${num}`).value)
  };
}

// Actualizar etiquetas de valores en vivo
function conectarSliders(num){
  const actualizar=()=>{
    const v=getValoresMotor(num);
    document.getElementById(`valBrilloM${num}`).textContent=v.brillo;
    document.getElementById(`valFilasM${num}`).textContent=v.distFilas;
    document.getElementById(`valColsM${num}`).textContent=v.distCols;
    document.getElementById(`valDenVM${num}`).textContent=v.denV.toFixed(2);
    document.getElementById(`valDenHM${num}`).textContent=v.denH.toFixed(2);
    // Registrar cada cambio en el log de ajustes
    logAjuste(`M${num}`,v.brillo,v.distFilas,v.distCols,v.denV,v.denH);
  };
  [`sliderBrilloM${num}`,`sliderFilasM${num}`,`sliderColsM${num}`,`sliderDenVM${num}`,`sliderDenHM${num}`].forEach(id=>{
    document.getElementById(id).addEventListener('input',actualizar);
  });
  actualizar(); // Mostrar valores iniciales
}

// ==================================================
// EJECUTOR — USA LOS VALORES ACTUALES DE LOS SLIDERS
// ==================================================
async function ejecutarMotor(num,nombre){
  const m=`M${num}`;
  if(!imagenActual){alert('⚠️ Elige imagen primero');return;}
  if(motor[`m${num}`].cargando)return;

  // TOMAR VALORES DIRECTO DE LOS SLIDERS
  const v=getValoresMotor(num);

  motor[`m${num}`].cargando=true;
  setEstado(m,'🔄 Procesando...');
  setBarra(m,10);
  setResultado(m,'');
  const al=getLogs(m);
  log(`${nombre} — Parámetros: brillo=${v.brillo}, distFilas=${v.distFilas}, distCols=${v.distCols}, denV=${v.denV}, denH=${v.denH}`,al);

  const t=setTimeout(()=>{
    motor[`m${num}`].cargando=false;
    setEstado(m,'❌ Tiempo agotado');
    setBarra(m,0);
    log('Se superaron 2 minutos',al,'error');
  },TIEMPO_LIMITE);

  try{
    setBarra(m,30);
    const dt=detectarEstructura(imagenActual,v.brillo,v.distFilas,v.distCols,v.denV,v.denH);
    setBarra(m,50);
    log(`→ DETECTADO: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas`,al,'ok');
    const tbl=await construirTablaConTexto(dt.filas,dt.columnas,nombre,imagenActual);
    setBarra(m,95);
    setResultado(m,tbl);
    setEstado(m,'✅ Completado');
    setBarra(m,100);
    log('✅ Texto extraído',al,'ok');
  }catch(e){
    setEstado(m,'❌ Error');
    log(`Error: ${e.message}`,al,'error');
  }finally{
    clearTimeout(t);
    motor[`m${num}`].cargando=false;
  }
}

function resetMotor(num){
  const m=`M${num}`;
  motor[`m${num}`].cargando=false;
  setEstado(m,'⏳ Pendiente');
  setBarra(m,0);
  setResultado(m,'');
  getLogs(m).innerHTML='';
}

// ==================================================
// INICIALIZAR SLIDERS Y CONECTAR EVENTOS
// ==================================================
window.addEventListener('load',()=>{
  // Conectar sliders de los 5 motores para que registren cambios
  for(let i=1;i<=5;i++)conectarSliders(i);

  // Eventos de imagen
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
        log('Imagen cargada — ajusta sliders y presiona Analizar',logsGlobal,'ok');
      };
      imagenActual.src=ev.target.result;
    };
    r.readAsDataURL(f);
  });

  // Botones de cada motor
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
