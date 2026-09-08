// ==============================================
// MAR CARIBE — LECTURA REAL DE IMÁGENES
// SIN EJEMPLOS, SIN SIMULACIONES: TU IMAGEN → TU TEXTO → TU TABLA
// ==============================================

// Elementos del HTML
const selImagen = document.getElementById('selectorImagen');
const btnElegir = document.getElementById('btnElegir');
const contenedorImagen = document.getElementById('contenedorImagen');
const imagenSubida = document.getElementById('imagenSubida');
const btnLeerAhora = document.getElementById('btnLeerAhora');
const paso1 = document.getElementById('paso1');
const paso2 = document.getElementById('paso2');
const paso3 = document.getElementById('paso3');
const barraCarga = document.getElementById('barraCarga');
const progresoOCR = document.getElementById('progresoOCR');
const textoLeido = document.getElementById('textoLeido');
const btnCrearTabla = document.getElementById('btnCrearTabla');
const btnVolver = document.getElementById('btnVolver');
const contenedorTablaReal = document.getElementById('contenedorTablaReal');
const btnCopiarTodo = document.getElementById('btnCopiarTodo');
const btnEnviarWhatsApp = document.getElementById('btnEnviarWhatsApp');
const btnEmpezarDeNuevo = document.getElementById('btnEmpezarDeNuevo');
const avisos = document.getElementById('avisos');

// Datos reales
let datosTablaFinal = [];

// ==============================================
// PASO 1: SELECCIONAR Y VER IMAGEN REAL
// ==============================================
btnElegir.addEventListener('click', () => {
  selImagen.click();
});

selImagen.addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  if (!archivo.type.startsWith('image/')) {
    mostrarAviso('❌ El archivo no es una imagen válida', 'error');
    return;
  }

  // ✅ AQUÍ SE CARGA Y SE VE TU IMAGEN — NO ES EJEMPLO
  const lector = new FileReader();
  lector.onload = (eventoLectura) => {
    imagenSubida.src = eventoLectura.target.result;
    contenedorImagen.classList.remove('oculto');
    mostrarAviso('✅ Imagen cargada correctamente', 'exito');
  };
  lector.readAsDataURL(archivo);
});

// ==============================================
// PASO 2: LEER TEXTO REAL CON TESSERACT.JS
// ==============================================
btnLeerAhora.addEventListener('click', async () => {
  if (!imagenSubida.src) {
    mostrarAviso('⚠️ Primero selecciona una imagen', 'alerta');
    return;
  }

  paso1.classList.add('oculto');
  paso2.classList.remove('oculto');
  barraCarga.classList.remove('oculto');
  progresoOCR.style.width = '0%';
  textoLeido.value = '';

  try {
    // ✅ OCR REAL — LEE LO QUE DICE TU IMAGEN
    const resultado = await Tesseract.recognize(
      imagenSubida.src,
      'spa+eng', // Español + Inglés
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            progresoOCR.style.width = Math.round(m.progress * 100) + '%';
          }
        }
      }
    );

    // ✅ TEXTO REAL EXTRAÍDO DE TU IMAGEN — NADA ESCRITO POR MÍ
    textoLeido.value = resultado.data.text.trim();
    
    if (!textoLeido.value) {
      mostrarAviso('⚠️ No se pudo leer texto de la imagen', 'alerta');
    } else {
      mostrarAviso('✅ Texto leído: ' + resultado.data.text.length + ' caracteres', 'exito');
    }

  } catch (error) {
    mostrarAviso('❌ Error al leer: ' + error.message, 'error');
    paso1.classList.remove('oculto');
    paso2.classList.add('oculto');
  }
});

// Volver a elegir imagen
btnVolver.addEventListener('click', () => {
  paso2.classList.add('oculto');
  paso1.classList.remove('oculto');
});

// ==============================================
// PASO 3: CONVERTIR TEXTO REAL EN TABLA
// ==============================================
btnCrearTabla.addEventListener('click', () => {
  const texto = textoLeido.value.trim();
  if (!texto) {
    mostrarAviso('⚠️ No hay texto para convertir', 'alerta');
    return;
  }

  paso2.classList.add('oculto');
  paso3.classList.remove('oculto');

  // ✅ PARSEAR EL TEXTO REAL QUE VINO DE TU IMAGEN
  const lineas = texto.split('\n').filter(l => l.trim().length > 0);
  
  datosTablaFinal = lineas.map(linea => {
    // Detectar separador: | , tabulaciones o espacios múltiples
    if (linea.includes('|')) return linea.split('|').map(c => c.trim());
    if (linea.includes('\t')) return linea.split('\t').map(c => c.trim());
    return linea.split(/\s{3,}/).map(c => c.trim()).filter(c => c);
  });

  // ✅ DIBUJAR TABLA REAL
  let htmlTabla = '<table><tbody>';
  datosTablaFinal.forEach((fila, indice) => {
    const etiqueta = indice === 0 ? 'th' : 'td';
    htmlTabla += '<tr>' + fila.map(celda => `<${etiqueta}>${celda}</${etiqueta}>`).join('') + '</tr>';
  });
  htmlTabla += '</tbody></table>';

  contenedorTablaReal.innerHTML = htmlTabla;
  mostrarAviso(`✅ Tabla creada: ${datosTablaFinal.length} filas leídas de TU imagen`, 'exito');
});

// ==============================================
// ACCIONES FINALES
// ==============================================
btnCopiarTodo.addEventListener('click', () => {
  const textoPlano = datosTablaFinal.map(f => f.join(' | ')).join('\n');
  navigator.clipboard.writeText(textoPlano)
    .then(() => mostrarAviso('✅ Tabla copiada al portapapeles', 'exito'))
    .catch(() => mostrarAviso('❌ No se pudo copiar', 'error'));
});

btnEnviarWhatsApp.addEventListener('click', () => {
  const textoPlano = datosTablaFinal.map(f => f.join(' | ')).join('\n');
  const mensaje = encodeURIComponent('🏝️ TABLA DESDE IMAGEN\n\n' + textoPlano);
  window.open(`https://wa.me/?text=${mensaje}`, '_blank');
  mostrarAviso('💬 Abriendo WhatsApp...', 'exito');
});

btnEmpezarDeNuevo.addEventListener('click', () => {
  // ✅ REINICIAR TODO
  selImagen.value = '';
  imagenSubida.src = '';
  contenedorImagen.classList.add('oculto');
  textoLeido.value = '';
  contenedorTablaReal.innerHTML = '';
  datosTablaFinal = [];
  progresoOCR.style.width = '0%';
  
  paso3.classList.add('oculto');
  paso1.classList.remove('oculto');
});

// ==============================================
// UTILIDADES
// ==============================================
function mostrarAviso(texto, tipo) {
  avisos.textContent = texto;
  avisos.className = `aviso aviso-${tipo}`;
  setTimeout(() => avisos.textContent = '', 6000);
}

