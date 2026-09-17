// ============================================
// DEBUG + DIBUJO DE LÍNEAS
// ============================================

window.MAR = window.MAR || {};

const COLORES_ALGORITMO = {
  3: { vertical: 'rgba(255, 100, 100, 0.85)', horizontal: 'rgba(100, 100, 255, 0.85)' },
  4: { vertical: 'rgba(255, 165, 0, 0.85)', horizontal: 'rgba(160, 32, 240, 0.85)' },
  5: { vertical: 'rgba(0, 200, 0, 0.85)', horizontal: 'rgba(255, 215, 0, 0.85)' },
  6: { vertical: 'rgba(255, 0, 0, 1)', horizontal: 'rgba(0, 0, 255, 1)' }
};

const GROSOR_LINEA = 0.5; // Líneas más finas

function actualizarEstadoBoton(pasoId, ejecutado, error) {
  const estado = document.getElementById('estado-' + pasoId);
  const btn = document.getElementById('btn-' + pasoId);
  if (!estado) return;
  
  if (error) {
    estado.textContent = '❌';
    if (btn) {
      btn.classList.remove('paso-ejecutando', 'paso-ejecutado');
      btn.classList.add('paso-error');
    }
  } else if (ejecutado) {
    estado.textContent = '✅';
    if (btn) {
      btn.classList.remove('paso-ejecutando', 'paso-error');
      btn.classList.add('paso-ejecutado');
    }
  } else {
    estado.textContent = '⏳';
    if (btn) btn.classList.remove('paso-ejecutando', 'paso-ejecutado', 'paso-error');
  }
}

function marcarEjecutando(pasoId) {
  const btn = document.getElementById('btn-' + pasoId);
  const estado = document.getElementById('estado-' + pasoId);
  if (btn) btn.classList.add('paso-ejecutando');
  if (estado) estado.textContent = '🔄';
}

function mostrarDebug(texto) {
  const panel = document.getElementById('debugContent');
  const textoEl = document.getElementById('debugTexto');
  if (textoEl) textoEl.textContent = texto;
  console.log(texto);
}

function actualizarContadores(numV, numH) {
  const cv = document.getElementById('contadorV');
  const ch = document.getElementById('contadorH');
  if (cv) cv.textContent = numV + ' verticales';
  if (ch) ch.textContent = numH + ' horizontales';
}

function dibujarLineasPaso(numPaso, verticales, horizontales) {
  const img = document.getElementById('imgPreview');
  const canvas = document.getElementById('deteccionCanvas');
  if (!img || !canvas || !img.clientWidth) return;

  if (numPaso === 3) {
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
  } else if (numPaso === 6) {
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
  }

  const ctx = canvas.getContext('2d');
  const escalaX = img.clientWidth / img.naturalWidth;
  const escalaY = img.clientHeight / img.naturalHeight;
  const colores = COLORES_ALGORITMO[numPaso] || COLORES_ALGORITMO[6];

  ctx.strokeStyle = colores.vertical;
  ctx.lineWidth = GROSOR_LINEA;
  for (const v of verticales) {
    const x = (v.posicion !== undefined ? v.posicion : v) * escalaX;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  ctx.strokeStyle = colores.horizontal;
  ctx.lineWidth = GROSOR_LINEA;
  for (const h of horizontales) {
    const y = (h.posicion !== undefined ? h.posicion : h) * escalaY;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}

async function ejecutarYDebug(pasoFn, debugFn, pasoId) {
  try {
    if (pasoId) marcarEjecutando(pasoId);
    await pasoFn();
    const dbg = debugFn();
    mostrarDebug(dbg);
    if (pasoId) actualizarEstadoBoton(pasoId, true, false);
  } catch (e) {
    const errMsg = '❌ Error: ' + e.message;
    mostrarDebug(errMsg);
    console.error(e);
    if (pasoId) actualizarEstadoBoton(pasoId, false, true);
  }
}

async function ejecutarTodo() {
  const pasos = [
    { fn: ejecutarPaso1, dbg: debugPaso1, nombre: 'Mediana', id: 'paso1' },
    { fn: ejecutarPaso2, dbg: debugPaso2, nombre: 'Canales', id: 'paso2' },
    { fn: ejecutarPaso3, dbg: debugPaso3, nombre: 'Óptica', id: 'paso3' },
    { fn: ejecutarPaso4, dbg: debugPaso4, nombre: 'Ecografía', id: 'paso4' },
    { fn: ejecutarPaso5, dbg: debugPaso5, nombre: 'Espectro', id: 'paso5' },
    { fn: ejecutarPaso6, dbg: debugPaso6, nombre: 'LIDAR', id: 'paso6' },
    { fn: ejecutarPaso7, dbg: debugPaso7, nombre: 'Edición', id: 'paso7' },
    { fn: ejecutarPaso8, dbg: debugPaso8, nombre: 'Recorte', id: 'paso8' },
    { fn: ejecutarPaso9, dbg: debugPaso9, nombre: 'OCR', id: 'paso9' }
  ];

  let debugTotal = '═══════════════════════════════════════\n';
  debugTotal += 'EJECUCIÓN COMPLETA - 9 PASOS\n';
  debugTotal += '═══════════════════════════════════════\n\n';

  for (let i = 0; i < pasos.length; i++) {
    const paso = pasos[i];
    debugTotal += `[${i + 1}/${pasos.length}] ${paso.nombre}...\n`;
    mostrarDebug(debugTotal);
    
    try {
      marcarEjecutando(paso.id);
      await paso.fn();
      debugTotal += paso.dbg() + '\n\n';
      actualizarEstadoBoton(paso.id, true, false);
    } catch (e) {
      debugTotal += `❌ Error: ${e.message}\n\n`;
      actualizarEstadoBoton(paso.id, false, true);
      break;
    }
    mostrarDebug(debugTotal);
  }

  debugTotal += '✅ COMPLETADO\n';
  mostrarDebug(debugTotal);
}
