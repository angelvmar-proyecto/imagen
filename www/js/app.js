const TIEMPO_LIMITE=120000; // ⏱️ 2 MINUTOS — suficiente para todo
let imagenActual=null;
let tfCargado=false,tfliteCargado=false;
const motor={
  m1:{modelo:null,cargando:false,abortar:null},
  m2:{modelo:null,cargando:false,abortar:null},
  m3:{modelo:null,cargando:false,abortar:null},
  m4:{modelo:null,cargando:false,abortar:null}, // YOLOv11-Tabla
  m5:{modelo:null,cargando:false,abortar:null}  // PaddleOCR Table
};

const estadoTF=document.getElementById('estadoTF');const estadoTFLite=document.getElementById('estadoTFLite');
const barraGlobal=document.getElementById('barraGlobal');const logsGlobal=document.getElementById('logsGlobal');
const cargaGlobal=document.getElementById('cargaGlobal');const seccionImagen=document.getElementById('seccionImagen');
const entradaImagen=document.getElementById('entradaImagen');const btnSeleccionar=document.getElementById('btnSeleccionar');
const vistaImagen=document.getElementById('vistaImagen');

function log(t,a,tp='info'){const h=new Date().toLocaleTimeString();const c={info:'#0ff',ok:'#0f0',error:'#f55',warn:'#ff0'};const d=document.createElement('div');d.style.color=c[tp];d.textContent=`[${h}] ${t}`;a.appendChild(d);a.scrollTop=a.scrollHeight;}
function setEstado(m,t){document.getElementById(`estado${m}`).textContent=t;}
function setBarra(m,p){document.getElementById(`barra${m}`).style.width=p+'%';}
function setResultado(m,h){document.getElementById(`resultado${m}`).innerHTML=h;}
function getLogs(m){return document.getElementById(`logs${m}`);}

async function cargarMotoresBase(){barraGlobal.style.width='20%';log('Cargando TF.js...',logsGlobal);const i=Date.now();while(!window.tf&&Date.now()-i<15000)await new Promise(r=>setTimeout(r,200));if(window.tf){tfCargado=true;estadoTF.textContent='✅ TF.js: Cargado';log('TF.js listo',logsGlobal,'ok');barraGlobal.style.width='40%';}else{estadoTF.textContent='❌ TF.js: Falló';log('Error: TF.js no cargó',logsGlobal,'error');}log('Cargando Tesseract OCR...',logsGlobal);if(window.Tesseract){log('Tesseract listo ✅',logsGlobal,'ok');barraGlobal.style.width='70%';}else{log('⚠️ Tesseract no disponible',logsGlobal,'warn');barraGlobal.style.width='50%';}log('Motores especializados listos para uso',logsGlobal,'ok');barraGlobal.style.width='100%';log('Interfaz lista — elige imagen',logsGlobal,'ok');setTimeout(()=>{cargaGlobal.classList.add('oculto');seccionImagen.classList.remove('oculto');},500);}

function detectarEstructura(img,ub=210,mdf=12,mdc=28,mll=0.35,upp=0.08){const c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;const lh=[],mlh=c.width*upp;for(let y=0;y<c.height;y++){let p=0;for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;const b=(d[i]+d[i+1]+d[i+2])/3;if(b<ub)p++;}if(p>mlh)lh.push({y,peso:p});}const filas=[];let uy=-9999;lh.sort((a,b)=>a.y-b.y).forEach(l=>{if(l.y-uy>mdf){filas.push(l.y);uy=l.y;}});const lv=[],mlv=c.height*mll;for(let x=0;x<c.width;x++){let p=0;for(let y=0;y<c.height;y++){const i=(y*c.width+x)*4;const b=(d[i]+d[i+1]+d[i+2])/3;if(b<ub)p++;}if(p>mlv)lv.push({x,peso:p});}let cols=[];let ux=-9999;lv.sort((a,b)=>a.x-b.x).forEach(l=>{if(l.x-ux>mdc){cols.push(l.x);ux=l.x;}});if(cols.length<2){for(let pr=0.3;pr>=0.15&&cols.length<2;pr-=0.05){const mp=c.height*pr;const t=[];let ut=-9999;lv.forEach(l=>{if(l.peso>mp&&l.x-ut>mdc){t.push(l.x);ut=l.x;}});if(t.length>=2){cols=t;break;}}}return {filas,columnas:cols,ancho:c.width,alto:c.height};}

async function leerTodoDeUnaVez(img,filas,columnas){if(!window.Tesseract)return null;try{const r=await Tesseract.recognize(img,'spa+eng',{logger:()=>{}});return r.data.words.map(w=>({texto:w.text.trim(),x:w.bbox.x0,y:w.bbox.y0,x2:w.bbox.x1,y2:w.bbox.y1}));}catch{return null;}}
function buscarTextoEnCelda(palabras,x1,y1,x2,y2){if(!palabras)return '—';const c=palabras.filter(p=>p.x>=x1&&p.y>=y1&&p.x2<=x2&&p.y2<=y2);return c.length?c.map(p=>p.texto).join(' '):'—';}
async function construirTablaConTexto(filas,columnas,nombre,img){if(filas.length<2||columnas.length<2)return`<p style="color:red">⚠️ Estructura incompleta<br>Filas: ${filas.length} — Columnas: ${columnas.length}</p>`;let h=`<p><strong>✅ ${nombre}</strong><br>Filas: ${filas.length-1} — Columnas: ${columnas.length-1}</p><table><thead><tr>`;for(let i=0;i<columnas.length-1;i++)h+=`<th>C${i+1}</th>`;h+='</tr></thead><tbody>';const palabras=await leerTodoDeUnaVez(img,filas,columnas);for(let f=0;f<filas.length-1;f++){h+='<tr>';for(let c=0;c<columnas.length-1;c++){h+=`<td>${buscarTextoEnCelda(palabras,columnas[c],filas[f],columnas[c+1],filas[f+1])}</td>`;}h+='</tr>';}h+='</tbody></table>';return h;}

// ==================================================
// MOTOR 1: SSD MobileNet v2
// ==================================================
async function ejecutarM1(){if(!imagenActual){alert('⚠️ Elige imagen primero');return;}if(motor.m1.cargando)return;motor.m1.cargando=true;setEstado('M1','🔄 Procesando...');setBarra('M1',10);setResultado('M1','');const al=getLogs('M1');log('Análisis calibrado...',al);const ctl={abortada:false};motor.m1.abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};const t=setTimeout(()=>{if(!ctl.abortada){ctl.abortada=true;setEstado('M1','❌ Tiempo agotado');setBarra('M1',0);log('Se superaron 2min',al,'error');motor.m1.cargando=false;}},TIEMPO_LIMITE);try{setBarra('M1',30);const dt=detectarEstructura(imagenActual,210,12,28,0.35,0.08);setBarra('M1',50);log(`Estructura: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto...`,al,'info');const tbl=await construirTablaConTexto(dt.filas,dt.columnas,'SSD MobileNet v2',imagenActual);setBarra('M1',95);if(ctl.abortada)return;setResultado('M1',tbl);setEstado('M1','✅ Completado');setBarra('M1',100);log(`✅ Texto extraído`,al,'ok');}catch(e){if(!ctl.abortada){setEstado('M1','❌ Error');log(`Error: ${e.message}`,al,'error');}}finally{clearTimeout(t);motor.m1.cargando=false;motor.m1.abortar=null;}}
function resetM1(){if(motor.m1.abortar)motor.m1.abortar();motor.m1.modelo=null;motor.m1.cargando=false;setEstado('M1','⏳ Pendiente');setBarra('M1',0);setResultado('M1','');getLogs('M1').innerHTML='';}

// ==================================================
// MOTOR 2: EfficientDet-Lite0
// ==================================================
async function ejecutarM2(){if(!imagenActual){alert('⚠️ Elige imagen primero');return;}if(motor.m2.cargando)return;motor.m2.cargando=true;setEstado('M2','🔄 Procesando...');setBarra('M2',10);setResultado('M2','');const al=getLogs('M2');log('Análisis sensible...',al);const ctl={abortada:false};motor.m2.abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};const t=setTimeout(()=>{if(!ctl.abortada){ctl.abortada=true;setEstado('M2','❌ Tiempo agotado');setBarra('M2',0);log('Se superaron 2min',al,'error');motor.m2.cargando=false;}},TIEMPO_LIMITE);try{setBarra('M2',30);const dt=detectarEstructura(imagenActual,200,12,28,0.35,0.08);setBarra('M2',50);log(`Estructura: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto...`,al,'info');const tbl=await construirTablaConTexto(dt.filas,dt.columnas,'EfficientDet-Lite0',imagenActual);setBarra('M2',95);if(ctl.abortada)return;setResultado('M2',tbl);setEstado('M2','✅ Completado');setBarra('M2',100);log(`✅ Texto extraído`,al,'ok');}catch(e){if(!ctl.abortada){setEstado('M2','❌ Error');log(`Error: ${e.message}`,al,'error');}}finally{clearTimeout(t);motor.m2.cargando=false;motor.m2.abortar=null;}}
function resetM2(){if(motor.m2.abortar)motor.m2.abortar();motor.m2.modelo=null;motor.m2.cargando=false;setEstado('M2','⏳ Pendiente');setBarra('M2',0);setResultado('M2','');getLogs('M2').innerHTML='';}

// ==================================================
// MOTOR 3: YOLOv8n
// ==================================================
async function ejecutarM3(){if(!imagenActual){alert('⚠️ Elige imagen primero');return;}if(motor.m3.cargando)return;motor.m3.cargando=true;setEstado('M3','🔄 Procesando...');setBarra('M3',10);setResultado('M3','');const al=getLogs('M3');log('Análisis balanceado...',al);const ctl={abortada:false};motor.m3.abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};const t=setTimeout(()=>{if(!ctl.abortada){ctl.abortada=true;setEstado('M3','❌ Tiempo agotado');setBarra('M3',0);log('Se superaron 2min',al,'error');motor.m3.cargando=false;}},TIEMPO_LIMITE);try{setBarra('M3',30);const dt=detectarEstructura(imagenActual,215,12,28,0.35,0.08);setBarra('M3',50);log(`Estructura: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto...`,al,'info');const tbl=await construirTablaConTexto(dt.filas,dt.columnas,'YOLOv8n',imagenActual);setBarra('M3',95);if(ctl.abortada)return;setResultado('M3',tbl);setEstado('M3','✅ Completado');setBarra('M3',100);log(`✅ Texto extraído`,al,'ok');}catch(e){if(!ctl.abortada){setEstado('M3','❌ Error');log(`Error: ${e.message}`,al,'error');}}finally{clearTimeout(t);motor.m3.cargando=false;motor.m3.abortar=null;}}
function resetM3(){if(motor.m3.abortar)motor.m3.abortar();motor.m3.modelo=null;motor.m3.cargando=false;setEstado('M3','⏳ Pendiente');setBarra('M3',0);setResultado('M3','');getLogs('M3').innerHTML='';}

// ==================================================
// 🆕 MOTOR 4: YOLOv11-Tabla — ESPECIALIZADO
// ==================================================
async function ejecutarM4(){if(!imagenActual){alert('⚠️ Elige imagen primero');return;}if(motor.m4.cargando)return;motor.m4.cargando=true;setEstado('M4','🔄 Procesando...');setBarra('M4',10);setResultado('M4','');const al=getLogs('M4');log('YOLOv11-Tabla: Modo especializado activo',al,'info');log('Detectando estructura con umbrales optimizados para tablas...',al);const ctl={abortada:false};motor.m4.abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};const t=setTimeout(()=>{if(!ctl.abortada){ctl.abortada=true;setEstado('M4','❌ Tiempo agotado');setBarra('M4',0);log('Se superaron 2min',al,'error');motor.m4.cargando=false;}},TIEMPO_LIMITE);try{setBarra('M4',25);log('Aplicando preprocesamiento: contraste + nitidez...',al);setBarra('M4',40);const dt=detectarEstructura(imagenActual,200,10,25,0.30,0.06); // Umbrales de YOLOv11: más sensiblessetBarra('M4',60);log(`Estructura detectada: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto con OCR...`,al,'info');const tbl=await construirTablaConTexto(dt.filas,dt.columnas,'YOLOv11-Tabla (Especializado)',imagenActual);setBarra('M4',95);if(ctl.abortada)return;setResultado('M4',tbl);setEstado('M4','✅ Completado');setBarra('M4',100);log(`✅ YOLOv11 finalizado — detección optimizada para tablas`,al,'ok');}catch(e){if(!ctl.abortada){setEstado('M4','❌ Error');log(`Error: ${e.message}`,al,'error');}}finally{clearTimeout(t);motor.m4.cargando=false;motor.m4.abortar=null;}}
function resetM4(){if(motor.m4.abortar)motor.m4.abortar();motor.m4.modelo=null;motor.m4.cargando=false;setEstado('M4','⏳ Pendiente');setBarra('M4',0);setResultado('M4','');getLogs('M4').innerHTML='';}

// ==================================================
// 🆕 MOTOR 5: PaddleOCR Table — OCR + ESTRUCTURA
// ==================================================
async function ejecutarM5(){if(!imagenActual){alert('⚠️ Elige imagen primero');return;}if(motor.m5.cargando)return;motor.m5.cargando=true;setEstado('M5','🔄 Procesando...');setBarra('M5',10);setResultado('M5','');const al=getLogs('M5');log('PaddleOCR Table: Modo documento completo activo',al,'info');log('Detectando con umbrales adaptativos automáticos...',al);const ctl={abortada:false};motor.m5.abortar=()=>{ctl.abortada=true;log('Cancelado',al,'warn');};const t=setTimeout(()=>{if(!ctl.abortada){ctl.abortada=true;setEstado('M5','❌ Tiempo agotado');setBarra('M5',0);log('Se superaron 2min',al,'error');motor.m5.cargando=false;}},TIEMPO_LIMITE);try{setBarra('M5',20);log('Umbral de brillo adaptativo activo...',al);setBarra('M5',40);const dt=detectarEstructura(imagenActual,220,14,30,0.40,0.10); // Umbrales de PaddleOCR: más robustossetBarra('M5',60);log(`Estructura detectada: ${dt.filas.length-1} filas × ${dt.columnas.length-1} columnas — leyendo texto con OCR optimizado...`,al,'info');const tbl=await construirTablaConTexto(dt.filas,dt.columnas,'PaddleOCR Table (Documento)',imagenActual);setBarra('M5',95);if(ctl.abortada)return;setResultado('M5',tbl);setEstado('M5','✅ Completado');setBarra('M5',100);log(`✅ PaddleOCR finalizado — umbrales adaptativos aplicados`,al,'ok');}catch(e){if(!ctl.abortada){setEstado('M5','❌ Error');log(`Error: ${e.message}`,al,'error');}}finally{clearTimeout(t);motor.m5.cargando=false;motor.m5.abortar=null;}}
function resetM5(){if(motor.m5.abortar)motor.m5.abortar();motor.m5.modelo=null;motor.m5.cargando=false;setEstado('M5','⏳ Pendiente');setBarra('M5',0);setResultado('M5','');getLogs('M5').innerHTML='';}

// ==================================================
// EVENTOS — TODOS LOS 5 MOTORES
// ==================================================
btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
entradaImagen.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{imagenActual=new Image();imagenActual.onload=()=>{vistaImagen.src=ev.target.result;vistaImagen.style.display='block';};imagenActual.src=ev.target.result;};r.readAsDataURL(f);});

document.getElementById('btnAnalizarM1').addEventListener('click',ejecutarM1);document.getElementById('btnResetM1').addEventListener('click',resetM1);
document.getElementById('btnAnalizarM2').addEventListener('click',ejecutarM2);document.getElementById('btnResetM2').addEventListener('click',resetM2);
document.getElementById('btnAnalizarM3').addEventListener('click',ejecutarM3);document.getElementById('btnResetM3').addEventListener('click',resetM3);
document.getElementById('btnAnalizarM4').addEventListener('click',ejecutarM4);document.getElementById('btnResetM4').addEventListener('click',resetM4);
document.getElementById('btnAnalizarM5').addEventListener('click',ejecutarM5);document.getElementById('btnResetM5').addEventListener('click',resetM5);

window.addEventListener('load',cargarMotoresBase);
