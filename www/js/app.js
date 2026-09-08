// ==============================================
// MAR Caribe — Lector de Tablas desde Imagen
// ==============================================

// Estado global
const estado = {
  paginaActual: 'imagen',
  imagen: null,
  texto: '',
  tabla: { cabezera: [], filas: [] }
};

// INICIO — Se ejecuta cuando la página ya está cargada
document.addEventListener('DOMContentLoaded', function() {
  console.log('🏝️ MAR Caribe — App cargada');
  conectarBotones();
  mostrarPagina('imagen');
});

// ==============================================
// CONECTAR TODOS LOS BOTONES A SUS ACCIONES
// ==============================================
function conectarBotones() {
  console.log('🔗 Conectando botones...');

  // --- Navegación inferior ---
  document.querySelectorAll('nav button').forEach(boton => {
    boton.addEventListener('click', function() {
      const pagina = this.getAttribute('data-pagina');
      if (pagina === 'imagen') mostrarPagina('imagen');
      if (pagina === 'texto') mostrarPagina('texto');
      if (pagina === 'tabla') mostrarPagina('tabla');
    });
  });

  // --- Página Imagen ---
  const btnElegir = document.getElementById('btn-elegir-imagen');
  const btnTomar = document.getElementById('btn-tomar-foto');
  const inputArchivo = document.getElementById('input-archivo');
  const btnProcesar = document.getElementById('btn-procesar-imagen');

  if (btnElegir) btnElegir.addEventListener('click', () => {
    console.log('👉 Botón: Elegir imagen');
    inputArchivo.click();
  });

  if (btnTomar) btnTomar.addEventListener('click', () => {
    console.log('👉 Botón: Tomar foto');
    inputArchivo.click();
  });

  if (inputArchivo) inputArchivo.addEventListener('change', cargarImagen);

  if (btnProcesar) btnProcesar.addEventListener('click', () => {
    console.log('👉 Botón: Procesar imagen');
    procesarImagen();
  });

  // --- Página Texto ---
  const btnATabla = document.getElementById('btn-a-tabla');
  const btnVolver = document.getElementById('btn-volver-imagen');

  if (btnATabla) btnATabla.addEventListener('click', () => {
    console.log('👉 Botón: Convertir a tabla');
    convertirATabla();
  });

  if (btnVolver) btnVolver.addEventListener('click', () => {
    console.log('👉 Botón: Volver a imagen');
    mostrarPagina('imagen');
  });

  // --- Página Tabla ---
  const btnCopiar = document.getElementById('btn-copiar');
  const btnWhatsApp = document.getElementById('btn-whatsapp');
  const btnNuevo = document.getElementById('btn-nuevo');

  if (btnCopiar) btnCopiar.addEventListener('click', () => {
    console.log('👉 Botón: Copiar tabla');
    copiarTabla();
  });

  if (btnWhatsApp) btnWhatsApp.addEventListener('click', () => {
    console.log('👉 Botón: Enviar WhatsApp');
    enviarWhatsApp();
  });

  if (btnNuevo) btnNuevo.addEventListener('click', () => {
    console.log('👉 Botón: Nuevo proceso');
    reiniciar();
  });

  console.log('✅ TODOS los botones conectados');
}

// ==============================================
// CAMBIAR DE PÁGINA
// ==============================================
function mostrarPagina(nombre) {
  // Ocultar todas
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'));
  // Desactivar todos los botones de nav
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
  
  // Mostrar la seleccionada
  const pagina = document.getElementById('pagina-' + nombre);
  if (pagina) pagina.classList.add('activa');
  
  // Activar botón de nav
  document.querySelector(`nav button[data-pagina="${nombre}"]`)?.classList.add('activo');
  
  estado.paginaActual = nombre;
  console.log('📍 Página:', nombre);
}

// ==============================================
// CARGAR IMAGEN DESDE EL DISPOSITIVO
// ==============================================
function cargarImagen(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  if (!archivo.type.startsWith('image/')) {
    mostrarMensaje('imagen', '❌ El archivo no es una imagen válida', 'error');
    return;
  }

  const lector = new FileReader();
  lector.onload = function(e) {
    estado.imagen = e.target.result;
    
    const preview = document.getElementById('imagen-preview');
    const vista = document.getElementById('vista-previa');
    const btnProc = document.getElementById('btn-procesar-imagen');
    
    if (preview) preview.src = estado.imagen;
    if (vista) vista.classList.remove('oculto');
    if (btnProc) btnProc.classList.remove('oculto');
    
    mostrarMensaje('imagen', '✅ Imagen cargada correctamente', 'exito');
  };
  lector.readAsDataURL(archivo);
}

// ==============================================
// SIMULAR LECTURA OCR
// ==============================================
function procesarImagen() {
  if (!estado.imagen) {
    mostrarMensaje('imagen', '⚠️ Selecciona una imagen primero', 'alerta');
    return;
  }

  mostrarPagina('texto');
  mostrarMensaje('texto', '🔍 Leyendo texto de la imagen...', 'info');
  mostrarBarraProgreso();

  // Simulación de lectura — aquí va Tesseract.js después
  setTimeout(() => {
    estado.texto = `FECHA        | NOMBRE          | HAB | ENTRADA    | SALIDA     | PAX | TOTAL
-------------|-----------------|-----|------------|------------|-----|-----------
09/08/2026   | Pérez Juan      | 302 | 09/10/2026 | 09/15/2026 | 4   | $12,450.00
09/08/2026   | López María     | 405 | 09/12/2026 | 09/18/2026 | 2   | $8,900.00
09/08/2026   | García Carlos   | 201 | 09/15/2026 | 09/20/2026 | 3   | $9,600.00`;

    const areaTexto = document.getElementById('area-texto');
    if (areaTexto) areaTexto.value = estado.texto;
    
    ocultarBarraProgreso();
    mostrarMensaje('texto', '✅ Texto extraído correctamente', 'exito');
  }, 1500);
}

// ==============================================
// CONVERTIR TEXTO A TABLA
// ==============================================
function convertirATabla() {
  const areaTexto = document.getElementById('area-texto');
  estado.texto = areaTexto ? areaTexto.value : '';

  if (!estado.texto.trim()) {
    mostrarMensaje('texto', '⚠️ No hay texto para convertir', 'alerta');
    return;
  }

  mostrarPagina('tabla');
  mostrarMensaje('tabla', '📊 Convirtiendo a tabla...', 'info');

  // Separar por líneas y quitar líneas de separación
  const lineas = estado.texto.trim().split('\n').filter(l => l.trim() && !l.includes('---'));
  
  if (lineas.length === 0) {
    mostrarMensaje('tabla', '❌ No se encontraron datos', 'error');
    return;
  }

  // Primera línea = encabezados
  estado.tabla.cabezera = parsearFila(lineas[0]);
  // Resto = filas de datos
  estado.tabla.filas = lineas.slice(1).map(fila => parsearFila(fila));

  dibujarTabla();
  mostrarMensaje('tabla', `✅ Tabla lista: ${estado.tabla.filas.length} filas`, 'exito');
}

// Parsear una fila reconociendo separador | o espacios
function parsearFila(texto) {
  if (texto.includes('|')) {
    return texto.split('|').map(c => c.trim()).filter(c => c !== '');
  }
  return texto.split(/\s{2,}/).map(c => c.trim()).filter(c => c !== '');
}

// Dibujar la tabla en pantalla
function dibujarTabla() {
  const cabeza = document.getElementById('tabla-cabeza');
  const cuerpo = document.getElementById('tabla-cuerpo');

  if (cabeza) {
    cabeza.innerHTML = '<tr>' + 
      estado.tabla.cabezera.map(col => `<th>${col}</th>`).join('') + 
    '</tr>';
  }

  if (cuerpo) {
    cuerpo.innerHTML = estado.tabla.filas.map(fila => 
      '<tr>' + fila.map(dato => `<td>${dato}</td>`).join('') + '</tr>'
    ).join('');
  }
}

// ==============================================
// ACCIONES FINALES
// ==============================================
function copiarTabla() {
  const texto = generarTextoTabla();
  navigator.clipboard.writeText(texto)
    .then(() => mostrarMensaje('tabla', '✅ ¡Tabla copiada al portapapeles!', 'exito'))
    .catch(() => mostrarMensaje('tabla', '❌ No se pudo copiar', 'error'));
}

function enviarWhatsApp() {
  const texto = generarTextoTabla();
  const mensaje = encodeURIComponent('🏝️ MAR Caribe — Tabla Convertida\n\n' + texto);
  const url = `https://wa.me/?text=${mensaje}`;
  
  mostrarMensaje('tabla', '💬 Abriendo WhatsApp...', 'exito');
  
  if (window.Capacitor?.Browser) {
    Capacitor.Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}

function generarTextoTabla() {
  let t = '🏝️ MAR Caribe — Tabla Convertida\n';
  t += 'Fecha: ' + new Date().toLocaleString() + '\n\n';
  t += estado.tabla.cabezera.join(' | ') + '\n';
  t += '-'.repeat(50) + '\n';
  estado.tabla.filas.forEach(fila => {
    t += fila.join(' | ') + '\n';
  });
  return t;
}

function reiniciar() {
  estado.imagen = null;
  estado.texto = '';
  estado.tabla = { cabezera: [], filas: [] };

  document.getElementById('input-archivo').value = '';
  document.getElementById('vista-previa').classList.add('oculto');
  document.getElementById('btn-procesar-imagen').classList.add('oculto');
  document.getElementById('area-texto').value = '';
  document.getElementById('tabla-cabeza').innerHTML = '';
  document.getElementById('tabla-cuerpo').innerHTML = '';

  mostrarPagina('imagen');
}

// ==============================================
// UTILIDADES
// ==============================================
function mostrarMensaje(pagina, texto, tipo = 'info') {
  const el = document.getElementById('mensaje-' + pagina);
  if (!el) return;
  el.className = `estado estado-${tipo} visible`;
  el.textContent = texto;
  setTimeout(() => el.classList.remove('visible'), 5000);
}

function mostrarBarraProgreso() {
  const barra = document.getElementById('barra-progreso');
  const prog = document.getElementById('progreso');
  if (barra) barra.classList.remove('oculto');
  if (prog) prog.style.width = '0%';
  let pct = 0;
  const intervalo = setInterval(() => {
    pct += 7;
    if (pct >= 100) {
      clearInterval(intervalo);
      pct = 100;
      setTimeout(() => ocultarBarraProgreso(), 200);
    }
    if (prog) prog.style.width = pct + '%';
  }, 100);
}

function ocultarBarraProgreso() {
  document.getElementById('barra-progreso')?.classList.add('oculto');
}

