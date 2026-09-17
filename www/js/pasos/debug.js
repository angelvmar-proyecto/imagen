// ============================================
// SISTEMA DE DEBUG COMÚN
// ============================================

window.MAR = window.MAR || {};

// Actualizar estado visual del botón
function actualizarEstadoBoton(pasoId, ejecutado) {
  const btn = document.getElementById('btn-' + pasoId);
  if (!btn) return;
  
  if (ejecutado) {
    btn.classList.add('paso-ejecutado');
    const estado = btn.querySelector('.estado');
    if (estado) estado.textContent = '✅';
  }
}

// Mostrar debug en pantalla
function mostrarDebug(texto) {
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.textContent = texto;
    panel.style.display = 'block';
  }
}

// Ejecutar un paso y mostrar su debug
async function ejecutarYDebug(pasoFn, debugFn) {
  try {
    await pasoFn();
    const dbg = debugFn();
    mostrarDebug(dbg);
    console.log(dbg);
  } catch (e) {
    mostrarDebug('❌ Error: ' + e.message);
    console.error(e);
  }
}

// Ejecutar todos los pasos
async function ejecutarTodo() {
  const pasos = [
    { fn: ejecutarPaso1, dbg: debugPaso1, nombre: 'Mediana' },
    { fn: ejecutarPaso2, dbg: debugPaso2, nombre: 'Canales' },
    { fn: ejecutarPaso3, dbg: debugPaso3, nombre: 'Óptica' },
    { fn: ejecutarPaso4, dbg: debugPaso4, nombre: 'Ecografía' },
    { fn: ejecutarPaso5, dbg: debugPaso5, nombre: 'Espectro' },
    { fn: ejecutarPaso6, dbg: debugPaso6, nombre: 'LIDAR' },
    { fn: ejecutarPaso7, dbg: debugPaso7, nombre: 'Edición' },
    { fn: ejecutarPaso8, dbg: debugPaso8, nombre: 'Recorte' },
    { fn: ejecutarPaso9, dbg: debugPaso9, nombre: 'OCR' },
    { fn: ejecutarPaso10, dbg: debugPaso10, nombre: 'Aprendizaje' }
  ];

  let debugTotal = '═══════════════════════════════════════\n';
  debugTotal += 'EJECUCIÓN COMPLETA - TODOS LOS PASOS\n';
  debugTotal += '═══════════════════════════════════════\n\n';

  for (let i = 0; i < pasos.length; i++) {
    const paso = pasos[i];
    debugTotal += `[${i + 1}/10] ${paso.nombre}...\n`;
    mostrarDebug(debugTotal);
    
    try {
      await paso.fn();
      debugTotal += paso.dbg() + '\n';
    } catch (e) {
      debugTotal += `❌ Error: ${e.message}\n`;
      break;
    }
    mostrarDebug(debugTotal);
  }

  debugTotal += '\n✅ COMPLETADO\n';
  mostrarDebug(debugTotal);
}
