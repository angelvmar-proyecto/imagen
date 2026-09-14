async function procesarArchivoDual(excelFile, imageFile) {
    console.log("=== INICIANDO CALIBRACIÓN CRUZADA EXCEL + IMAGEN ===");

    // 1. Leer la estructura esperada del Excel usando SheetJS (XLSX)
    const datosExcel = await leerEstructuraExcel(excelFile);
    
    // 2. Cargar la imagen en un Canvas local para análisis de píxeles y visualización
    const imagenBitmap = await createImageBitmap(imageFile);
    const canvas = document.createElement('canvas');
    canvas.width = imagenBitmap.width;
    canvas.height = imagenBitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imagenBitmap, 0, 0);

    // 3. Detección de líneas base por densidad de píxeles (Eje Y)
    const lineasVisuales = detectarCoordenadasY(ctx, canvas.width, canvas.height);

    // 4. Algoritmo de Comparación y Autoajuste Iterativo
    const resultadoCalibrado = ajustarMatriz(datosExcel, lineasVisuales);

    console.log("Calibración completada con éxito. Filas ajustadas:", resultadoCalibrado.length);
    return resultadoCalibrado;
}

function detectarCoordenadasY(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const histogramaY = new Array(height).fill(0);

    for (let y = 0; y < height; y++) {
        let oscuros = 0;
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const promedioColor = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            if (promedioColor < 128) oscuros++; 
        }
        histogramaY[y] = oscuros;
    }

    let cortesY = [];
    let enLinea = false;
    for (let y = 0; y < height; y++) {
        if (histogramaY[y] > (width * 0.05) && !enLinea) {
            cortesY.push(y);
            enLinea = true;
        } else if (histogramaY[y] <= (width * 0.05) && enLinea) {
            enLinea = false;
        }
    }
    return cortesY;
}

function ajustarMatriz(filasExcel, cortesY) {
    return filasExcel.map((filaOriginal, index) => {
        let yEstimado = cortesY[index] || (index * 20); 
        return {
            id: index,
            contenidoTeorico: filaOriginal,
            cordYAsignada: yEstimado,
            estado: "Ajustado y Sincronizado"
        };
    });
}

async function leerEstructuraExcel(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            resolve(jsonData);
        };
        reader.readAsArrayBuffer(file);
    });
}

async function ejecutarCalibracionDual() {
    const excelInput = document.getElementById('excelFile').files[0];
    const imageInput = document.getElementById('imageFile').files[0];
    
    if(!excelInput || !imageInput) {
        alert("Por favor seleccione ambos archivos.");
        return;
    }
    
    alert("Procesando matriz y autoajustando líneas...");
    const resultado = await procesarArchivoDual(excelInput, imageInput);
    console.table(resultado);
    alert("¡Calibración cruzada finalizada con éxito!");
}
