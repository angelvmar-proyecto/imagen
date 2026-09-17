document.addEventListener('DOMContentLoaded', () => {
  const conexiones = [
    { id: 'paso1', fn: ejecutarPaso1, dbg: debugPaso1 },
    { id: 'paso2', fn: ejecutarPaso2, dbg: debugPaso2 },
    { id: 'paso3', fn: ejecutarPaso3, dbg: debugPaso3 },
    { id: 'paso4', fn: ejecutarPaso4, dbg: debugPaso4 },
    { id: 'paso5', fn: ejecutarPaso5, dbg: debugPaso5 },
    { id: 'paso6', fn: ejecutarPaso6, dbg: debugPaso6 },
    { id: 'paso7', fn: ejecutarPaso7, dbg: debugPaso7 },
    { id: 'paso8', fn: ejecutarPaso8, dbg: debugPaso8 },
    { id: 'paso9', fn: ejecutarPaso9, dbg: debugPaso9 }
  ];

  conexiones.forEach(c => {
    const btn = document.getElementById('btn-' + c.id);
    if (btn) {
      btn.addEventListener('click', () => {
        ejecutarYDebug(c.fn, c.dbg, c.id);
      });
    }
  });

  const btnTodo = document.getElementById('btnEjecutarTodo');
  if (btnTodo) btnTodo.addEventListener('click', ejecutarTodo);

  const btnCopiarDebug = document.getElementById('btnCopiarDebug');
  if (btnCopiarDebug) {
    btnCopiarDebug.addEventListener('click', async () => {
      const txt = document.getElementById('debugTexto').textContent;
      try {
        if (window.Capacitor?.Plugins?.Clipboard) {
          await window.Capacitor.Plugins.Clipboard.write({ string: txt });
        } else {
          await navigator.clipboard.writeText(txt);
        }
        alert('✅ Debug copiado');
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });
  }
});
