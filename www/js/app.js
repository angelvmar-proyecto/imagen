// ELEMENTOS DEL HTML — TAL CUAL ESTÁN
const selImagen = document.getElementById('selectorImagen');
const btnSeleccionar = document.getElementById('btnSeleccionar');
const vistaImagen = document.getElementById('vistaImagen');
const imgPreview = document.getElementById('imgPreview');
const btnLeer = document.getElementById('btnLeer');
const paso1 = document.getElementById('paso1');
const paso2 = document.getElementById('paso2');
const paso3 = document.getElementById('paso3');
const textoExtraido = document.getElementById('textoExtraido');
const btnCrearTabla = document.getElementById('btnCrearTabla');
const btnVolver1 = document.getElementById('btnVolver1');
const contenedorTabla = document.getElementById('contenedorTabla');
const btnCopiar = document.getElementById('btnCopiar');
const btnEnviarWA = document.getElementById('btnEnviarWA');
const btnNueva = document.getElementById('btnNueva');
const mensaje = document.getElementById('mensaje');

let imagenCargada = null;
let datosTabla = [];

// ==================================
// CONECTAR BOTONES — DIRECTO Y CLARO
// ==================================
btnSeleccionar.addEventListener('click', () => {
  selImagen.click();
});

selImagen.addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  
  const lector = new FileReader();
  lector.onload = (e) => {
    imagenCargada = e.target.result;
    imgPreview.src = imagenCargada;
    vistaImagen.style.display = 'block';
    mostrarMensaje('Imagen cargada ✅', 'exito');
  };
  lector.readAsDataURL(archivo);
});

btnLeer.addEventListener('click', () => {
  if (!imagenCargada) {
    mostrarMensaje('Primero selecciona una imagen', 'error');
    return;
  }
  // Simulación de lectura OCR — aquí va el real después
  textoExtraido.value = `FECHA|CLIENTE|HAB|ENTRADA|SALIDA|IMPORTE
09/08/2026|Juan Pérez|302|09/10/2026|09/15/2026|12450
09/08/2026|María López|405|09/12/2026|09/18/2026|8900`;
  paso1.style.display = 'none';
  paso2.style.display = 'block';
  mostrarMensaje('Texto extraído ✅', 'exito');
});

btnCrearTabla.addEventListener('click', () => {
  const lineas = textoExtraido.value.trim().split('\n');
  datosTabla = lineas.map(l => l.split('|'));
  
  let html = '<table border="1" cellpadding="8" cellspacing="0" style="width:100%;">';
  datosTabla.forEach((fila, i) => {
    html += '<tr>' + fila.map(c => i===0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>';
  });
  html += '</table>';
  
  contenedorTabla.innerHTML = html;
  paso2.style.display = 'none';
  paso3.style.display = 'block';
  mostrarMensaje('Tabla creada ✅', 'exito');
});

btnVolver1.addEventListener('click', () => {
  paso2.style.display = 'none';
  paso1.style.display = 'block';
});

btnCopiar.addEventListener('click', () => {
  let texto = datosTabla.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(texto).then(() => {
    mostrarMensaje('Copiado al portapapeles ✅', 'exito');
  });
});

btnEnviarWA.addEventListener('click', () => {
  let texto = datosTabla.map(f => f.join(' | ')).join('\n');
  const url = 'https://wa.me/?text=' + encodeURIComponent('🏝️ TABLA COMPARTIDA:\n' + texto);
  window.open(url, '_blank');
});

btnNueva.addEventListener('click', () => {
  selImagen.value = '';
  imagenCargada = null;
  vistaImagen.style.display = 'none';
  textoExtraido.value = '';
  contenedorTabla.innerHTML = '';
  paso3.style.display = 'none';
  paso1.style.display = 'block';
});

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.style.padding = '10px';
  mensaje.style.marginTop = '10px';
  mensaje.style.borderRadius = '6px';
  mensaje.style.background = tipo==='exito'?'#dcfce7':'#fee2e2';
  mensaje.style.color = tipo==='exito'?'#166534':'#991b1b';
  setTimeout(() => mensaje.textContent='', 4000);
}

