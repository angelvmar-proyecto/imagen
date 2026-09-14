async function procesarArchivoDual(excelFile, imageFile) {
    const datosExcel = await leerEstructuraExcel(excelFile);
    
    const imagenBitmap = await createImageBitmap(imageFile);
    const canvas = document.createElement('canvas');
    canvas.width = imagenBitmap.width;
    canvas.height = imagenBitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imagenBitmap, 0, 0);

    const lineasVisuales = detectarCoordenadasY(ctx, canvas.width, canvas.height);
    const resultadoCalibrado = ajustarMatrizConAprendizaje(datosExcel, lineasVisuales);

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

function ajustarMatrizConAprendizaje(filasExcel, cortesY) {
    let historialAprendizaje = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    
    const resultado = filasExcel.map((filaOriginal, index) => {
        let yEstimado = cortesY[index] || (index * 25); 
        let yTeoricoEsperado = index * 25; // Patrón base de estimación
        let desvio = yEstimado - yTeoricoEsperado;

        let registroFeedback = {
            idFila: index,
            contenido: JSON.stringify(filaOriginal),
            yDetectado: yEstimado,
            desvioCalculado: desvio,
            timestamp: new Date().toISOString()
        };

        // Guardar en el log de aprendizaje local
        historialAprendizaje.push(registroFeedback);

        return {
            id: index,
            contenidoTeorico: JSON.stringify(filaOriginal),
            cordYAsignada: yEstimado,
            desvio: desvio
        };
    });

    // Guardar cambios acumulados en localStorage
    localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historialAprendizaje));
    return resultado;
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
        alert("Seleccione el Excel y la imagen.");
        return;
    }
    
    const datosProcesados = await procesarArchivoDual(excelInput, imageInput);
    renderizarTabla(datosProcesados);
    alert("¡Calibración completada y patrones registrados en el log de aprendizaje!");
}

function renderizarTabla(datos) {
    const tbody = document.querySelector("#tabla-resultados tbody");
    tbody.innerHTML = "";
    datos.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.contenidoTeorico}</td>
            <td>${row.cordYAsignada} px</td>
            <td>Desvío: ${row.desvio} px</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportarLogAprendizaje() {
    const logData = localStorage.getItem('mar_caribe_learning_log') || '[]';
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning_log_${Date.now()}.json`;
    a.click();
}
