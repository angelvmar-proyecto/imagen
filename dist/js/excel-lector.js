// ==============================================
// Excel-lector — lee archivos .xlsx con SheetJS
// ==============================================

function leerExcelDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      reject(new Error('SheetJS no cargado'));
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const primeraHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[primeraHoja];
        const matriz = XLSX.utils.sheet_to_json(hoja, {
          header: 1,
          raw: false,
          defval: ''
        });
        resolve(matrizExcelALimpia(matriz));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file);
  });
}

function leerExcelDesdeBase64(base64) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS no cargado');
  }
  const workbook = XLSX.read(base64, { type: 'base64' });
  const primeraHoja = workbook.SheetNames[0];
  const hoja = workbook.Sheets[primeraHoja];
  const matriz = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: false,
    defval: ''
  });
  return matrizExcelALimpia(matriz);
}

function matrizExcelALimpia(matriz) {
  if (!matriz || !matriz.length) return [];

  let limpia = matriz.map(fila =>
    fila.map(celda => String(celda == null ? '' : celda).trim())
  );

  while (limpia.length > 0 && limpia[limpia.length - 1].every(c => !c)) {
    limpia.pop();
  }

  const maxAncho = limpia.reduce((m, f) => Math.max(m, f.length), 0);
  let ultimaColConDatos = maxAncho - 1;
  while (ultimaColConDatos >= 0) {
    const hayDatos = limpia.some(f => f[ultimaColConDatos]);
    if (hayDatos) break;
    ultimaColConDatos--;
  }
  limpia = limpia.map(f => f.slice(0, ultimaColConDatos + 1));

  return limpia;
}

console.log('✅ Excel-lector cargado');
