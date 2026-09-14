async function procesarArchivoDual(excelFile, imageFile) {
    const datosExcel = await leerEstructuraExcel(excelFile);
    
    const imagenBitmap = await createImageBitmap(imageFile);
    const canvas = document.createElement('canvas');
    canvas.width = imagenBitmap.width;
    canvas.height = imagenBitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imagenBitmap, 0, 0);

    const lineasVisuales = detectarCoordenadasY(ctx, canvas.width, canvas.height);
    const resultadoCalibrado = aplicarAprendizajeYProcesar(datosExcel, lineasVisuales);

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

function aplicarAprendizajeYProcesar(filasExcel, cortesY) {
    let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    
    let factorCorreccion = 0;
    if (historial.length > 0) {
        const ultimosDesvios = historial.slice(-10).map(h => h.desvioCalculado);
        const promedioDesvio = ultimosDesvios.reduce((a, b) => a + b, 0) / ultimosDesvios.length;
        factorCorreccion = promedioDesvio * 0.1;
    }

    const resultado = filasExcel.map((filaOriginal, index) => {
        let yEstimado = (cortesY[index] || (index * 25)) - factorCorreccion; 
        let desvio = yEstimado - (index * 25);

        historial.push({
            idFila: index,
            desvioCalculado: desvio,
            timestamp: new Date().toISOString()
        });

        let celdas = Array.isArray(filaOriginal) ? filaOriginal : [String(filaOriginal)];

        return {
            id: index,
            columnas: celdas,
            cordYAsignada: Math.round(yEstimado),
            desvio: Math.round(desvio)
        };
    });

    localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
    return resultado;
}

async function leerEstructuraExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                resolve(jsonData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

async function ejecutarCalibracionDual() {
    try {
        const excelInput = document.getElementById('excelFile').files[0];
        const imageInput = document.getElementById('imageFile').files[0];
        
        if(!excelInput || !imageInput) {
            alert("Por favor seleccione ambos archivos (Excel e Imagen).");
            return;
        }
        
        console.log("Iniciando procesamiento...");
        const datosProcesados = await procesarArchivoDual(excelInput, imageInput);
        renderizarTablaDinamica(datosProcesados);
        alert("¡Calibración con aprendizaje inteligente aplicada con éxito!");
    } catch (error) {
        console.error("Error en ejecución:", error);
        alert("Ocurrió un error al procesar los archivos: " + error.message);
    }
}

function renderizarTablaDinamica(datos) {
    const thead = document.querySelector("#tabla-resultados thead");
    const tbody = document.querySelector("#tabla-resultados tbody");
    
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!datos || datos.length === 0) return;

    let maxCols = Math.max(...datos.map(d => d.columnas.length));

    let headerTr = document.createElement('tr');
    headerTr.style.background = '#333';
    headerTr.innerHTML = `<th>#</th>`;
    for(let i = 0; i < maxCols; i++) {
        headerTr.innerHTML += `<th>Col ${i+1}</th>`;
    }
    headerTr.innerHTML += `<th>Pos Y / Desvío</th>`;
    thead.appendChild(headerTr);

    datos.forEach(row => {
        const tr = document.createElement('tr');
        let html = `<td><b>${row.id}</b></td>`;
        
        for(let i = 0; i < maxCols; i++) {
            let valorCelda = row.columnas[i] !== undefined ? row.columnas[i] : "";
            html += `<td>${valorCelda}</td>`;
        }
        html += `<td style="font-size:10px; color:#00bcd4;">Y:${row.cordYAsignada}px<br>Desv:${row.desvio}</td>`;
        tr.innerHTML = html;
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

function importarLogAprendizaje(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenidoJSON = JSON.parse(e.target.result);
            if (Array.isArray(contenidoJSON)) {
                localStorage.setItem('mar_caribe_learning_log', JSON.stringify(contenidoJSON));
                alert(`¡Log importado con éxito! Se cargaron ${contenidoJSON.length} registros.`);
            } else {
                alert("El archivo JSON no tiene un formato válido.");
            }
        } catch (error) {
            alert("Error al parsear el archivo JSON.");
            console.error(error);
        }
    };
    reader.readAsText(file);
}
