const pantallaCarga=document.getElementById('pantallaCarga'),barraProgreso=document.getElementById('barraProgreso'),estadoOCR=document.getElementById('estadoOCR'),pantallaPrincipal=document.getElementById('pantallaPrincipal'),entradaImagen=document.getElementById('entradaImagen'),btnSeleccionar=document.getElementById('btnSeleccionar'),vistaImagen=document.getElementById('vistaImagen'),imagenPreview=document.getElementById('imagenPreview'),btnAnalizar=document.getElementById('btnAnalizar'),resultadoTabla=document.getElementById('resultadoTabla'),contenedorTabla=document.getElementById('contenedorTabla'),btnNuevaImagen=document.getElementById('btnNuevaImagen');

let imagenActual=null, reconocedor=null;

async function cargarOCR(){
  log('🔤 Cargando Tesseract.js OCR...','info');
  try{
    reconocedor=await Tesseract.createWorker('spa+eng',1,{
      logger:m=>{if(m.status==='recognizing text') barraProgreso.style.width=`${Math.round(m.progress*100)}%`;}
    });
    await reconocedor.setParameters({preserve_interword_spaces:'1'});
    estadoOCR.textContent='✅ OCR listo';
    barraProgreso.style.width='100%';
    log('✅ Tesseract.js listo — español + inglés','ok');
    return true;
  }catch(e){
    estadoOCR.textContent='❌ Error OCR';
    log(`❌ ${e.message}`,'error');
    return false;
  }
}

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
      if((datos[i]+datos[i+1]+datos[i+2])/3<220) oscuro++;
    }
    if(oscuro>c.width*0.08) h.push(y);
  }

  const v=[];
  for(let x=0;x<c.width;x++){
    let oscuro=0;
    for(let y=0;y<c.height;y+=2){
      const i=(y*c.width+x)*4;
      if((datos[i]+datos[i+1]+datos[i+2])/3<220) oscuro++;
    }
    if(oscuro>c.height*0.08) v.push(x);
  }

  const filas=[], cols=[], minDist=5;
  let ult=-9999;
  h.sort((a,b)=>a-b).forEach(y=>{if(y-ult>minDist){filas.push(y);ult=y;}});
  ult=-9999;
  v.sort((a,b)=>a-b).forEach(x=>{if(x-ult>minDist){cols.push(x);ult=x;}});

  log(`📊 ${filas.length} filas, ${cols.length} columnas detectadas`,'ok');
  return {filas,cols,ctx,c};
}

async function leerCelda(ctx,x1,y1,x2,y2){
  const w=x2-x1, h=y2-y1;
  if(w<8||h<8) return '';
  const temp=document.createElement('canvas');
  temp.width=w; temp.height=h;
  const tctx=temp.getContext('2d');
  tctx.drawImage(ctx.canvas,x1,y1,w,h,0,0,w,h);
  try{
    const {data:{text}}=await reconocedor.recognize(temp);
    return text.trim().replace(/\s+/g,' ');
  }catch{return '';}
}

async function construirTabla(datos){
  const{filas,cols,ctx}=datos;
  if(filas.length<2||cols.length<2){
    return `<p style="color:red;padding:20px;">⚠️ Tabla no detectada completa<br>Filas: ${filas.length} — Columnas: ${cols.length}<br>Revisa que la imagen sea clara y bien iluminada</p>`;
  }
  log('📝 Leyendo contenido de celdas...','info');
  let html='<table><thead><tr>';
  for(let c=0;c<cols.length-1;c++) html+=`<th>C${c+1}</th>`;
  html+='</tr></thead><tbody>';
  for(let f=0;f<filas.length-1;f++){
    html+='<tr>';
    for(let c=0;c<cols.length-1;c++){
      const texto=await leerCelda(ctx,cols[c],filas[f],cols[c+1],filas[f+1]);
      html+=`<td>${texto||'-'}</td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  log('✅ Tabla construida con texto real','ok');
  return html;
}

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
  if(!imagenActual||!reconocedor)return;
  const datos=detectarLineas(imagenActual);
  contenedorTabla.innerHTML=await construirTabla(datos);
  vistaImagen.classList.add('oculto');
  resultadoTabla.classList.remove('oculto');
});

btnNuevaImagen.addEventListener('click',()=>{
  entradaImagen.value='';imagenActual=null;imagenPreview.src='';
  vistaImagen.classList.add('oculto');resultadoTabla.classList.add('oculto');
  log('🔄 Lista para nueva imagen','info');
});

window.addEventListener('load',iniciar);
