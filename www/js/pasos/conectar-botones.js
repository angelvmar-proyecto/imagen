// ============================================
// CONECTAR BOTONES DE LOS 10 PASOS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Botones de cada paso
  const btn1 = document.getElementById('btn-paso1');
  const btn2 = document.getElementById('btn-paso2');
  const btn3 = document.getElementById('btn-paso3');
  const btn4 = document.getElementById('btn-paso4');
  const btn5 = document.getElementById('btn-paso5');
  const btn6 = document.getElementById('btn-paso6');
  const btn7 = document.getElementById('btn-paso7');
  const btn8 = document.getElementById('btn-paso8');
  const btn9 = document.getElementById('btn-paso9');
  const btn10 = document.getElementById('btn-paso10');

  if (btn1) btn1.addEventListener('click', () => ejecutarYDebug(ejecutarPaso1, debugPaso1));
  if (btn2) btn2.addEventListener('click', () => ejecutarYDebug(ejecutarPaso2, debugPaso2));
  if (btn3) btn3.addEventListener('click', () => ejecutarYDebug(ejecutarPaso3, debugPaso3));
  if (btn4) btn4.addEventListener('click', () => ejecutarYDebug(ejecutarPaso4, debugPaso4));
  if (btn5) btn5.addEventListener('click', () => ejecutarYDebug(ejecutarPaso5, debugPaso5));
  if (btn6) btn6.addEventListener('click', () => ejecutarYDebug(ejecutarPaso6, debugPaso6));
  if (btn7) btn7.addEventListener('click', () => ejecutarYDebug(ejecutarPaso7, debugPaso7));
  if (btn8) btn8.addEventListener('click', () => ejecutarYDebug(ejecutarPaso8, debugPaso8));
  if (btn9) btn9.addEventListener('click', () => ejecutarYDebug(ejecutarPaso9, debugPaso9));
  if (btn10) btn10.addEventListener('click', () => ejecutarYDebug(ejecutarPaso10, debugPaso10));

  const btnTodo = document.getElementById('btnEjecutarTodo');
  if (btnTodo) btnTodo.addEventListener('click', ejecutarTodo);
});
