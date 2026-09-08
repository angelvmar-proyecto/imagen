const carga = document.getElementById('carga');
const progreso = document.getElementById('progreso');
const estado = document.getElementById('estado');
const paso1 = document.getElementById('paso1');
const paso2 = document.getElementById('paso2');
const paso3 = document.getElementById('paso3');
const archivo = document.getElementById('archivo');
const btnElegir = document.getElementById('btnElegir');
const vista = document.getElementById('vista');
const imagen = document.getElementById('imagen');
const btnDetectar = document.getElementById('btnDetectar');
const lienzo = document.getElementById('lienzo');
const resultados = document.getElementById('resultados');
const btnTabla = document.getElementById('btnTabla');
const btnVolver = document.getElementById('btnVolver');
const contenedorTabla = document.getElementById('contenedorTabla');
const btnCopiar = document.getElementById('btnCopiar');
const btnWA = document.getElementById('btnWA');
const btnNuevo = document.getElementById('btnNuevo');
const avisos = document.getElementById('avisos');

let modeloSSD = null;
let imagenActual = null;
let detecciones = [];
let datosTabla = [];

function mostrarAviso(texto, tipo) {
  avisos.textContent = texto;
  avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 5000);
}

async function cargarModelos() {
  estado.textContent = 'Cargando SSD MobileNet v2...';
  progreso.style.width = '40%';
  try {
    modeloSSD = await cocoSsd.load({ base: 'mobilenet_v2' });
    progreso.style.width = '100%';
    estado.textContent = 'Modelos cargados ✅';
    setTimeout(() => {
      carga.classList.add('oculto');
      paso1.classList.remove('oculto');
    }, 800);
  } catch (err) {
    estado.textContent = 'Error: ' + err.message;
    mostrarAviso('Error al cargar modelos: ' + err.message, 'error');
  }
}

btnElegir.addEventListener('click', () => archivo.click());

archivo.addEventListener('change', (e) => {
  const arch = e.target.files[0];
  if (!arch) return;
  const lector = new FileReader();
  lector.onload = (evt) => {
    imagenActual = new Image();
    imagenActual.onload = () => {
      imagen.src = evt.target.result;
      vista.classList.remove('oculto');
    };
    imagenActual.src = evt.target.result;
  };
  lector.readAsDataURL(arch);
});

btnDetectar.addEventListener('click', async () => {
  if (!imagenActual) return;
  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  resultados.innerHTML = '<p>Analizando imagen con IA...</p>';
  try {
    detecciones = await modeloSSD.detect(imagenActual);
    const ctx = lienzo.getContext('2d');
    lienzo.width = imagenActual.width;
    lienzo.height = imagenActual.height;
    ctx.drawImage(imagenActual, 0, 0);
    detecciones.forEach(d => {
      const [x, y, w, h] = d.bbox;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#00ff00';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${d.class} (${Math.round(d.score*100)}%)`, x, y > 20 ? y - 5 : y + 20);
    });
    if (detecciones.length === 0) {
      resultados.innerHTML = '<p>⚠️ No se detectaron objetos</p>';
    } else {
      resultados.innerHTML = `<p>✅ ${detecciones.length} objeto(s) detectado(s)</p>`;
    }
  } catch (err) {
    mostrarAviso('Error: ' + err.message, 'error');
    paso1.classList.remove('oculto');
    paso2.classList.add('oculto');
  }
});

btnVolver.addEventListener('click', () => {
  paso2.classList.add('oculto');
  paso1.classList.remove('oculto');
});

btnTabla.addEventListener('click', () => {
  datosTabla = [
    ['Clase', 'Confianza %', 'Posición X', 'Posición Y'],
    ...detecciones.map(d => [d.class, Math.round(d.score * 100), Math.round(d.bbox[0]), Math.round(d.bbox[1])])
  ];
  let html = '<table>';
  datosTabla.forEach((fila, i) => {
    const tag = i === 0 ? 'th' : 'td';
    html += '<tr>' + fila.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  });
  html += '</table>';
  contenedorTabla.innerHTML = html;
  paso2.classList.add('oculto');
  paso3.classList.remove('oculto');
});

btnCopiar.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(texto)
    .then(() => mostrarAviso('✅ Copiado al portapapeles', 'exito'))
    .catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
});

btnWA.addEventListener('click', () => {
  const texto = datosTabla.map(f => f.join(' | ')).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent('🏝️ DETECCIÓN IA:\n' + texto), '_blank');
});

btnNuevo.addEventListener('click', () => {
  archivo.value = '';
  imagenActual = null;
  imagen.src = '';
  vista.classList.add('oculto');
  detecciones = [];
  datosTabla = [];
  paso3.classList.add('oculto');
  paso1.classList.remove('oculto');
});

window.addEventListener('DOMContentLoaded', cargarModelos);
