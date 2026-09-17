// ============================================
// PASO 9: OCR POR CELDA (Tesseract)
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso9 = {
  ejecutado: false,
  resultados: [],
  matriz: [],
  tiempoMs: 0
};

async function ejecutarPaso9() {
  if (!window.MAR.paso8.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 8.');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(5, 'Paso 9: Iniciando Tesseract...');
  const t0 = performance.now();

  const worker = await inicializarTesseract();
  const celdas = window.MAR.paso8.celdas;
  const numFilas = window.MAR.paso8.numFilas;
  const numColumnas = window.MAR.paso8.numColumnas;

  // Crear matriz vacía
  const matriz = Array(numFilas).fill().map(() => Array(numColumnas).fill(''));
  const resultados = [];

  // Procesar celda por celda
  for (let k = 0; k < celdas.length; k++) {
    const celda = celdas[k];
    const pct = Math.round((k / celdas.length) * 90) + 5;
    
    if (typeof setProgreso === 'function') {
      setProgreso(pct, `OCR celda ${k + 1}/${celdas.length}`);
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

  const t1 = performance.now();
  window.MAR.paso9.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso9.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 9 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 9: ${celdas.length} celdas procesadas`, 'success');

  actualizarEstadoBoton('paso9', true);
  return window.MAR.paso9;
}

function debugPaso9() {
  const p = window.MAR.paso9;
  if (!p.ejecutado) return '⚠️ Paso 9 no ejecutado';
  
  const celdasConTexto = p.resultados.filter(r => r.texto.length > 0).length;
  
  return `
═══════════════════════════════════════
PASO 9: OCR POR CELDA
═══════════════════════════════════════

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms
   - Promedio por celda: ${Math.round(p.tiempoMs / p.resultados.length)} ms

📈 RESULTADO:
   - Celdas procesadas: ${p.resultados.length}
   - Celdas con texto: ${celdasConTexto}
   - Celdas vacías: ${p.resultados.length - celdasConTexto}
═══════════════════════════════════════`;
}
