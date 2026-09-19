// ==============================================
// PATCH v10.0.2: Umbral adaptativo más permisivo
// ==============================================

// Guardar la función original si existe
const _analizarTodoConUmbral = analizarTodo;

analizarTodo = function() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  
  // Llamar al patch de preprocesamiento (que a su vez llama al original)
  if (typeof _analizarTodoConUmbral === 'function') {
    _analizarTodoConUmbral();
  }
};

console.log('✅ Patch v10.0.2 cargado');
