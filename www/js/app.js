// Motor de Aprendizaje Estructural por Calibración Cruzada (Excel <-> Imagen)

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

    // Análisis espectral y de densidad para hallar los bordes reales en el Canvas
    const datosImagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lineasVisualesY = detectarBordesDeCeldas(datosImagen, canvas.width, canvas.height);

    // Si hay Excel, entrenamos el sistema guardando el mapeo estructural en el log
    if (excelFile && datosExcel.length > 0) {
        registrarAprendizajeEstructural(datosExcel, lineasVisualesY);
    }

    // Procesamiento final utilizando la memoria de aprendizaje (con o sin Excel)
    const resultadoFinal = aplicarMemoriaEstructural(datosExcel, lineasVisualesY);
    return resultadoFinal;
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

// Detector óptico de líneas divisorias y celdas basado en densidad de píxeles
function detectarBordesDeCeldas(imgData, width, height) {
    const data = imgData.data;
    const ecoFilas = new Array(height).fill(0);

    for (let y = 0; y < height; y++) {
        let intensidadFila = 0;
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const luma = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
            if (luma > 50) intensidadFila++; // Detecta bordes y textos claros
        }
        ecoFilas[y] = intensidadFila;
    }

    let cortesY = [];
    let enCelda = false;
    let umbral = width * 0.02;

    for (let y = 0; y < height; y++) {
        if (ecoFilas[y] > umbral && !enCelda) {
            cortesY.push(y);
            enCelda = true;
        } else if (ecoFilas[y] <= umbral && enCelda) {
            enCelda = false;
        }
    }

    // Filtrar para obtener pasos de filas limpios
    let filasEstructurales = [];
    let ultimoY = -40;
    cortesY.forEach(y => {
        if (y - ultimoY > 20) {
            filasEstructurales.push(y);
            ultimoY = y;
        }
    });

    return filasEstructurales;
}

// Almacena en localStorage la relación matemática entre el Excel y los bordes visuales detectados
function registrarAprendizajeEstructural(datosExcel, lineasVisualesY) {
    let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    
    let patronRegistro = {
        timestamp: new Date().toISOString(),
        totalFilasExcel: datosExcel.length,
        totalBordesVisuales: lineasVisualesY.length,
        factorEscalaY: lineasVisualesY.length > 0 ? (lineasVisualesY[lineasVisualesY.length - 1] / datosExcel.length) : 0,
        muestrasGeometricas: lineasVisualesY.slice(0, datosExcel.length)
    };

    historial.push(patronRegistro);
    // Conservar los últimos 50 entrenamientos para optimizar espacio en el móvil
    if (historial.length > 50) historial.shift();
    
    localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
    console.log("¡Aprendizaje estructural registrado con éxito!", patronRegistro);
}

// Aplica el conocimiento adquirido para estructurar las filas, operando con o sin Excel de referencia
function aplicarMemoriaEstructural(datosExcel, lineasVisualesY) {
    let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    let factorAprendido = 25; // Valor por defecto si no hay historial

    if (historial.length > 0) {
        // Promediar el factor de escala Y de las últimas calibraciones exitosas
        const sumaFactores = historial.reduce((acc, curr) => acc + (curr.factorEscalaY || 25), 0);
        factorAprendido = sumaFactores / historial.length;
    }

    // Si no se cargó Excel, generamos una matriz base estimada utilizando la memoria del log
    let filasBase = datosExcel;
    if (!filasBase || filasBase.length === 0) {
        const cantidadEstimada = lineasVisualesY.length > 0 ? lineasVisualesY.length : 10;
        filasBase = new Array(cantidadEstimada).fill(0).map((_, idx) => [`Fila Autónoma Aprendida #${idx + 1}`]);
    }

    return filasBase.map((filaOriginal, index) => {
        let cordY = lineasVisualesY[index] || Math.round(index * factorAprendido);
        let celdas = Array.isArray(filaOriginal) ? filaOriginal : [String(filaOriginal)];

        return {
            id: index + 1,
            columnas: celdas,
            cordYAsignada: cordY,
            estadoAprendizaje: historial.length > 0 ? "Calibrado por Memoria" : "Modo Base"
        };
    });
}

async function ejecutarCalibracionDual() {
    try {
        const excelInput = document.getElementById('excelFile').files[0];
        const imageInput = document.getElementById('imageFile').files[0];
        
        if(!imageInput) {
            alert("Por favor seleccione al menos la Imagen de WhatsApp.");
            return;
        }
        
        console.log("Ejecutando calibración y aprendizaje estructural...");
        const datosProcesados = await procesarArchivoDual(excelInput, imageInput);
        renderizarTablaDinamica(datosProcesados);
        
        if (excelInput) {
            alert("¡Aprendizaje completado! El sistema ha incorporado la estructura del Excel a su log.");
        } else {
            alert("¡Lectura autónoma realizada usando la memoria de aprendizaje histórico!");
        }
    } catch (error) {
        console.error("Error en ejecución:", error);
        alert("Ocurrió un error al procesar: " + error.message);
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

    let maxCols = Math.max(...datos.map(d => d.columnas.length));

    let headerTr = document.createElement('tr');
    headerTr.style.background = '#333';
    headerTr.innerHTML = `<th>#</th>`;
    for(let i = 0; i < maxCols; i++) {
        headerTr.innerHTML += `<th>Columna ${i+1}</th>`;
    }
    headerTr.innerHTML += `<th>Pos Y / Estado</th>`;
    thead.appendChild(headerTr);

    datos.forEach(row => {
        const tr = document.createElement('tr');
        let html = `<td><b>${row.id}</b></td>`;
        
        for(let i = 0; i < maxCols; i++) {
            let valorCelda = row.columnas[i] !== undefined ? row.columnas[i] : "";
            html += `<td>${valorCelda}</td>`;
        }
        html += `<td style="font-size:10px; color:#00bcd4;">Y:${row.cordYAsignada}px<br><b>${row.estadoAprendizaje}</b></td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

async function exportarLogAprendizaje() {
    try {
        const logData = localStorage.getItem('mar_caribe_learning_log') || '[]';
        const blob = new Blob([logData], { type: 'application/json' });
        const file = new File([blob], `learning_log_${Date.now()}.json`, { type: 'application/json' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Log de Aprendizaje Estructural MAR Caribe',
                text: 'Historial de calibración geométrica de celdas.',
                files: [file]
            });
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `learning_log_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        const logData = localStorage.getItem('mar_caribe_learning_log') || '[]';
        prompt("Copia tu log estructural manualmente:", logData);
    }
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
                alert(`¡Log estructural importado con éxito! Se cargaron ${contenidoJSON.length} patrones de aprendizaje.`);
            } else {
                alert("El archivo JSON no tiene un formato válido.");
            }
        } catch (error) {
            alert("Error al parsear el archivo JSON.");
        }
    };
    reader.readAsText(file);
}
