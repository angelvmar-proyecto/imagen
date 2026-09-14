async function procesarArchivoDual(excelFile, imageFile) {
    let datosExcel = [];
    if (excelFile) {
        datosExcel = await leerEstructuraExcel(excelFile);
    }
    
    const imgElement = await cargarImagenSegura(imageFile);
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);

    const datosImagenOriginal = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lineasVisualesY = detectarGeometriaEstructuralPura(datosImagenOriginal, canvas.width, canvas.height);

    console.log("Iniciando reconocimiento óptico real (OCR) con Tesseract local...");
    const resultadosOCR = await extraerTextoRealConTesseract(ctx, canvas, lineasVisualesY, datosExcel);

    if (excelFile && datosExcel.length > 0) {
        calibrarYRegistrarAprendizaje(datosExcel, lineasVisualesY);
    }

    if (typeof mostrarLogEnPantalla === 'function') {
        mostrarLogEnPantalla();
    }

    return resultadosOCR;
}

function cargarImagenSegura(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error("No se pudo decodificar la imagen."));
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

function detectarGeometriaEstructuralPura(imgData, width, height) {
    const data = imgData.data;
    const perfilDensidadY = new Array(height).fill(0);

    for (let y = 0; y < height; y++) {
        let cambiosBorde = 0;
        let lumaAnterior = 0;
        for (let x = 0; x < width; x += 3) {
            const idx = (y * width + x) * 4;
            const luma = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
            if (Math.abs(luma - lumaAnterior) > 20) {
                cambiosBorde++;
            }
            lumaAnterior = luma;
        }
        perfilDensidadY[y] = cambiosBorde;
    }

    let cortesY = [];
    let enLineaDivisoria = false;
    let umbralTransicion = width * 0.05;

    for (let y = 0; y < height; y++) {
        if (perfilDensidadY[y] > umbralTransicion && !enLineaDivisoria) {
            cortesY.push(y);
            enLineaDivisoria = true;
        } else if (perfilDensidadY[y] <= umbralTransicion && enLineaDivisioria) {
            enLineaDivisoria = false;
        }
    }

    let filasEstructurales = [];
    let ultimoY = -30;
    cortesY.forEach(y => {
        if (y - ultimoY > 20) {
            filasEstructurales.push(y);
            ultimoY = y;
        }
    });

    return filasEstructurales;
}

async function extraerTextoRealConTesseract(ctx, canvas, lineasY, datosExcel) {
    let filasExtraidas = [];
    let totalFilas = lineasY.length > 1 ? lineasY.length - 1 : (datosExcel.length > 0 ? datosExcel.length : 10);

    // Apuntando langPath a la carpeta local donde descargamos los entrenamientos
    const worker = await Tesseract.createWorker('spa+eng', 1, {
        langPath: './tessdata'
    });

    for (let i = 0; i < totalFilas; i++) {
        let yInicio = lineasY[i] || (i * 35);
        let yFin = lineasY[i + 1] || (yInicio + 35);
        let alto = yFin - yInicio;
        if (alto < 10) alto = 35;

        const subCanvas = document.createElement('canvas');
        subCanvas.width = canvas.width;
        subCanvas.height = alto;
        const subCtx = subCanvas.getContext('2d');
        
        subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);
        
        let textoExtraido = `Fila ${i+1} (Sin texto detectado)`;
        try {
            const dataURL = subCanvas.toDataURL('image/png');
            const ret = await worker.recognize(dataURL);
            if (ret && ret.data && ret.data.text) {
                textoExtraido = ret.data.text.trim().replace(/\n/g, ' | ');
            }
        } catch (err) {
            console.error("Error en celda OCR:", err);
        }

        let referenciaExcel = (datosExcel[i] && datosExcel[i].join) ? datosExcel[i].join(' | ') : `Registro ${i+1}`;

        filasExtraidas.push({
            id: i + 1,
            columnas: [textoExtraido !== "" ? textoExtraido : "Vacío"],
            referencia: referenciaExcel,
            cordYAsignada: yInicio,
            calibracionEstado: "OCR Real Local"
        });
    }

    await worker.terminate();
    return filasExtraidas;
}

function calibrarYRegistrarAprendizaje(datosExcel, lineasVisualesY) {
    let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    let patron = {
        timestamp: new Date().toISOString(),
        filasExcelCount: datosExcel.length,
        lineasVisualesCount: lineasVisualesY.length,
        mapaMuestras: lineasVisualesY.slice(0, datosExcel.length)
    };
    historial.push(patron);
    if (historial.length > 50) historial.shift();
    localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
}

async function ejecutarCalibracionDual() {
    try {
        const excelInput = document.getElementById('excelFile').files[0];
        const imageInput = document.getElementById('imageFile').files[0];
        
        if(!imageInput) {
            alert("Por favor seleccione la Imagen de WhatsApp.");
            return;
        }
        
        document.getElementById('tabla-resultados').querySelector('tbody').innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ffeb3b;">Procesando imagen con Tesseract local (Esto tomará unos segundos reales)...</td></tr>`;

        const datosProcesados = await procesarArchivoDual(excelInput, imageInput);
        renderizarTablaDinamica(datosProcesados);
        
        alert("¡Procesamiento OCR completado con éxito!");
    } catch (error) {
        console.error("Error en ejecución:", error);
        alert("Ocurrió un error al procesar el OCR local: " + error.message);
    }
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

function renderizarTablaDinamica(datos) {
    const thead = document.querySelector("#tabla-resultados thead");
    const tbody = document.querySelector("#tabla-resultados tbody");
    
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!datos || datos.length === 0) return;

    let headerTr = document.createElement('tr');
    headerTr.style.background = '#333';
    headerTr.innerHTML = `<th>#</th><th>Texto Extraído por Tesseract Local</th><th>Pos Y / Estado</th>`;
    thead.appendChild(headerTr);

    datos.forEach(row => {
        const tr = document.createElement('tr');
        let html = `<td><b>${row.id}</b></td>`;
        html += `<td style="font-family: monospace; font-size: 12px; color: #00ffcc;">${row.columnas[0]}</td>`;
        html += `<td style="font-size:10px; color:#00bcd4;">Y:${row.cordYAsignada}px<br><b>${row.calibracionEstado}</b></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}
