// ============================================
// PASO 9: OCR POR CELDA con progreso GLOBAL
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso9 = { ejecutado: false, resultados: [], matriz: [], tiempoMs: 0 };

async function ejecutarPaso9() {
  if (!window.MAR.paso8 || !window.MAR.paso8.ejecutado) {
    throw new Error('Ejecuta Paso 8 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(5, 'Paso 9: Iniciando Tesseract...');
  const t0 = performance.now();

  const worker = await inicializarTesseract();
  const celdas = window.MAR.paso8.celdas;
  const numFilas = window.MAR.paso8.numFilas;
  const numColumnas = window.MAR.paso8.numColumnas;

  const total = celdas.length;
  const matriz = Array(numFilas).fill().map(() => Array(numColumnas).fill(''));
  const resultados = [];

  if (typeof setProgreso === 'function') setProgreso(10, `Procesando ${total} celdas...`);

  for (let k = 0; k < total; k++) {
    const celda = celdas[k];
    
    // Progreso GLOBAL: 10% → 95%
    const pct = 10 + Math.round((k / total) * 85);
    if (typeof setProgreso === 'function') {
      setProgreso(pct, `Celda ${k + 1} de ${total} (${Math.round((k/total)*100)}%)`);
    }

    try {
      const { data } = await worker.recognize(celda.canvas);
      const texto = (data.text || '').trim();
      matriz[celda.fila][celda.columna] = texto;
      resultados.push({ fila: celda.fila, columna: celda.columna, texto });
    } catch (e) {
      resultados.push({ fila: celda.fila, columna: celda.columna, texto: '', error: e.message });
    }
  }

  window.MAR.paso9.resultados = resultados;
  window.MAR.paso9.matriz = matriz;
  window.MAR.paso9.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso9.ejecutado = true;

  // Asignar a matrizDatos global
  if (typeof matrizDatos !== 'undefined') {
    matrizDatos = matriz;
  } else {
    window.matrizDatos = matriz;
  }

  if (typeof renderizarMatriz === 'function') {
    renderizarMatriz();
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 9 completado!');
  return window.MAR.paso9;
}

function debugPaso9() {
  const p = window.MAR.paso9;
  if (!p.ejecutado) return 'Paso 9 no ejecutado';
  const conTexto = p.resultados.filter(r => r.texto.length > 0).length;
  return `PASO 9: OCR
⏱️ ${p.tiempoMs} ms
📊 Celdas procesadas: ${p.resultados.length}
📊 Con texto: ${conTexto}
📊 Vacías: ${p.resultados.length - conTexto}`;
}
