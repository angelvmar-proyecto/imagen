// ELEMENTOS
const input = document.getElementById('archivo');
const btnSel = document.getElementById('btnSeleccionar');
const vista = document.getElementById('vista');
const foto = document.getElementById('foto');
const btnLeer = document.getElementById('btnLeer');
const cajaTexto = document.getElementById('cajaTexto');
const texto = document.getElementById('texto');
const btnTabla = document.getElementById('btnTabla');
const cajaTabla = document.getElementById('cajaTabla');
const tabla = document.getElementById('tabla');
const btnCopiar = document.getElementById('btnCopiar');
const btnWA = document.getElementById('btnWA');
const btnNuevo = document.getElementById('btnNuevo');

let datos = [];

// 1. ABRIR SELECCIONADOR
btnSel.addEventListener('click', () => {
  input.click();
});

// 2. CARGAR Y MOSTRAR TU IMAGEN — CUALQUIERA
input.addEventListener('change', (e) => {
  const arch = e.target.files[0];
  if (!arch) return;

  const lector = new FileReader();
  lector.onload = function(e) {
    foto.src = e.target.result;
    vista.style.display = 'block';
    cajaTexto.style.display = 'none';
    cajaTabla.style.display = 'none';
  };
  lector.readAsDataURL(arch);
});

// 3. SIMULACIÓN DE LECTURA (Tesseract se agrega después — primero que todo funcione)
btnLeer.addEventListener('click', () => {
  if (!foto.src) return;
  
  // AQUÍ VA EL TEXTO REAL CUANDO INTEGREMOS TESSERACT
  // Por ahora: la estructura funciona, tú verás tu imagen
  texto.value = "FECHA | NOMBRE | HAB | TOTAL\n08/09 | Juan Pérez | 301 | 1250\n08/09 | María López | 405 | 980";
  
  vista.style.display = 'none';
  cajaTexto.style.display = 'block';
});

// 4. HACER TABLA
btnTabla.addEventListener('click', () => {
  const lineas = texto.value.trim().split('\n');
  datos = lineas.map(l => l.split('|').map(c => c.trim()));
  
  let html = '<table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;">';
  datos.forEach((fila, i) => {
    html += '<tr>' + fila.map(c => i==0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>';
  });
  html += '</table>';
  
  tabla.innerHTML = html;
  cajaTexto.style.display = 'none';
  cajaTabla.style.display = 'block';
});

// 5. COPIAR
btnCopiar.addEventListener('click', () => {
  const t = datos.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(t);
  alert('¡Copiado!');
});

// 6. WHATSAPP
btnWA.addEventListener('click', () => {
  const t = datos.map(f => f.join(' | ')).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent('TABLA:\n' + t), '_blank');
});

// 7. NUEVO
btnNuevo.addEventListener('click', () => {
  input.value = '';
  foto.src = '';
  vista.style.display = 'none';
  cajaTexto.style.display = 'none';
  cajaTabla.style.display = 'none';
  datos = [];
});

