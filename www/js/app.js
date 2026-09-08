const pantallaCarga=document.getElementById('pantallaCarga'),barraProgreso=document.getElementById('barraProgreso'),estadoOCR=document.getElementById('estadoOCR'),pantallaPrincipal=document.getElementById('pantallaPrincipal'),entradaImagen=document.getElementById('entradaImagen'),btnSeleccionar=document.getElementById('btnSeleccionar'),vistaImagen=document.getElementById('vistaImagen'),imagenPreview=document.getElementById('imagenPreview'),btnAnalizar=document.getElementById('btnAnalizar'),resultadoTabla=document.getElementById('resultadoTabla'),contenedorTabla=document.getElementById('contenedorTabla'),btnNuevaImagen=document.getElementById('btnNuevaImagen');

let imagenActual=null, reconocedor=null;

// ==================================================
// PASO 1: CARGAR TESSERACT — igual, pero solo UNA VEZ
// ==================================================
async function cargarOCR(){
  log('🔤 Cargando Tesseract.js OCR...','info');
  try{
    reconocedor=await Tesseract.createWorker('spa+eng',1,{
      logger:m=>{if(m.status==='recognizing text') barraProgreso.style.width=`${Math.round(m.progress*100)}%`;}
    });
    await reconocedor.setParameters({preserve_interword_spaces:'1'});
    estadoOCR.textContent='✅ OCR listo';
    barraProgreso.style.width='100%';
    log('✅ Tesseract.js listo','ok');
    return true;
  }catch(e){
    estadoOCR.textContent='❌ Error OCR';
    log(`❌ ${e.message}`,'error');
    return false;
  }
}

// ==================================================
// PASO 2: DETECTAR LÍNEAS — MEJORADO, SIN LÍNEAS FALSAS
// ==================================================
function detectarLineas(img){
  log('🔍 Detectando líneas de tabla...','info');
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=img.width; c.height=img.height;
  ctx.drawImage(img,0,0);
  const datos=ctx.getImageData(0,0,c.width,c.height).data;

  const h=[];
  for(let y=0;y<c.height;y++){
    let oscuro=0;
    for(let x=0;x<c.width;x+=2){
      const i=(y*c.width+x)*4;
      if((datos[i]+datos[i+1]+datos[i+2])/3<200) oscuro++;
    }
    if(oscuro>c.width*0.10) h.push(y);
  }

  const v=[];
  for(let x=0;x<c.width;x++){
    let oscuro=0;
    for(let y=0;y<c.height;y+=2){
      const i=(y*c.width+x)*4;
      if((datos[i]+datos[i+1]+datos[i+2])/3<200) oscuro++;
    }
    if(oscuro>c.height*0.10) v.push(x);
  }

  const filas=[], cols=[], minDistFilas=15, minDistCols=8;
  let ult=-9999;
  h.sort((a,b)=>a-b).forEach(y=>{if(y-ult>minDistFilas){filas.push(y);ult=y;}});
  ult=-9999;
  v.sort((a,b)=>a-b).forEach(x=>{if(x-ult>minDistCols){cols.push(x);ult=x;}});

  log(`📊 ${filas.length} filas, ${cols.length} columnas detectadas`,'ok');
  return {filas,cols,ctx,c};
}

// ==================================================
// PASO 3: OCR UNA SOLA VEZ + ORGANIZAR POR POSICIÓN
// ==================================================
async function extraerTextoCompleto(img){
  log('📝 Extrayendo texto de toda la imagen...','info');
  try{
    const {data:{words}}=await reconocedor.recognize(img,{output:'words'});
    log(`✅ ${words.length} palabras encontradas`,'ok');
    return words.map(w=>({
      texto:w.text.trim(),
      x:w.bbox.x0,
      y:w.bbox.y0,
      ancho:w.bbox.x1-w.bbox.x0,
      alto:w.bbox.y1-w.bbox.y0
    }));
  }catch(e){
    log(`❌ Error OCR: ${e.message}`,'error');
    return [];
  }
}

// ==================================================
// PASO 4: ASIGNAR PALABRAS A CELDAS SEGÚN POSICIÓN
// ==================================================
function construirTabla(datos,palabras){
  const{filas,cols}=datos;
  if(filas.length<2||cols.length<2){
    return `<p style="color:red;padding:20px;">⚠️ Tabla no detectada<br>Filas: ${filas.length} — Columnas: ${cols.length}</p>`;
  }

  const tabla=Array(filas.length-1).fill().map(()=>Array(cols.length-1).fill(''));

  for(const p of palabras){
    for(let f=0;f<filas.length-1;f++){
      for(let c=0;c<cols.length-1;c++){
        if(p.x>=cols[c]&&p.x<cols[c+1]&&p.y>=filas[f]&&p.y<filas[f+1]){
          tabla[f][c]+=(tabla[f][c]?' ':'')+p.texto;
          break;
        }
      }
    }
  }

  let html='<table><thead><tr>';
  for(let c=0;c<cols.length-1;c++) html+=`<th>C${c+1}</th>`;
  html+='</tr></thead><tbody>';
  for(let f=0;f<filas.length-1;f++){
    html+='<tr>';
    for(let c=0;c<cols.length-1;c++){
      html+=`<td>${tabla[f][c]||'-'}</td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  log('✅ Tabla construida con texto real','ok');
  return html;
}

// ==================================================
// PASO 5: FLUJO COMPLETO — SIN BLOQUEOS
// ==================================================
async function iniciar(){
  const ok=await cargarOCR();
  setTimeout(()=>{
    pantallaCarga.classList.add('oculto');
    pantallaPrincipal.classList.remove('oculto');
  }, ok?500:0);
}

btnSeleccionar.addEventListener('click',()=>entradaImagen.click());
entradaImagen.addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=evt=>{
    imagenActual=new Image();
    imagenActual.onload=()=>{
      imagenPreview.src=evt.target.result;
      vistaImagen.classList.remove('oculto');
      resultadoTabla.classList.add('oculto');
      log(`✅ Imagen cargada: ${imagenActual.width}×${imagenActual.height}`,'ok');
    };
    imagenActual.src=evt.target.result;
  };
  r.readAsDataURL(f);
});

btnAnalizar.addEventListener('click',async ()=>{
  if(!imagenActual||!reconocedor){log('⚠️ OCR no listo','warn');return;}
  log('🚀 Iniciando extracción...','info');
  const datosLineas=detectarLineas(imagenActual);
  const palabras=await extraerTextoCompleto(imagenActual);
  contenedorTabla.innerHTML=construirTabla(datosLineas,palabras);
  vistaImagen.classList.add('oculto');
  resultadoTabla.classList.remove('oculto');
});

btnNuevaImagen.addEventListener('click',()=>{
  entradaImagen.value='';imagenActual=null;imagenPreview.src='';
  vistaImagen.classList.add('oculto');resultadoTabla.classList.add('oculto');
  log('🔄 Lista para nueva imagen','info');
});

window.addEventListener('load',iniciar);
