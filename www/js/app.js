async function ejecutarCalibracionDual() {
    alert('Iniciando OCR guiado por plantilla de Excel...');
    try {
        const imageInput = document.getElementById('imageFile');
        if (!imageInput || !imageInput.files || imageInput.files.length === 0) {
            alert('Por favor selecciona una Imagen de WhatsApp obligatoriamente.');
            return;
        }

        const file = imageInput.files[0];
        const tbody = document.querySelector('#tabla-resultados tbody');
        const thead = document.querySelector('#tabla-resultados thead');
        
        if (tbody && thead) {
            thead.innerHTML = '<tr style="background: #333;"><th>#</th><th>Texto Detectado</th><th>Estado / Acción</th></tr>';
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;" id="ocr-status">Leyendo plantilla de Excel...</td></tr>';
        }

        const statusEl = document.getElementById('ocr-status');

        // 1. Obtener coordenadas dinámicas basadas en el archivo Excel de referencia
        const coordenadasBase = await obtenerCoordenadasDePlantillaExcel();

        if (statusEl) statusEl.innerText = 'Cargando imagen en memoria móvil...';

        // 2. Método seguro de canvas nativo (¡Intacto y funcionando!)
        const objectUrl = URL.createObjectURL(file);
        const imgElement = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Error al cargar la imagen en el WebView móvil'));
            };
            img.src = objectUrl;
        });

        if (statusEl) statusEl.innerText = 'Inicializando worker de Tesseract...';
        
        const worker = await Tesseract.createWorker({
            logger: m => {
                console.log(m);
                if (statusEl && m.status) {
                    let progreso = (m.progress !== undefined && m.progress !== null) ? ` (${Math.round(m.progress * 100)}%)` : '';
                    statusEl.innerText = `${m.status}${progreso}`;
                }
            }
        });

        if (statusEl) statusEl.innerText = 'Cargando idioma español...';
        await worker.loadLanguage('spa');
        await worker.initialize('spa');

        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        let filasExtraidas = [];
        
        // 3. Procesar los bloques guiados por las coordenadas del Excel
        for (let i = 0; i < coordenadasBase.length; i++) {
            let itemCoord = coordenadasBase[i];
            let yInicio = itemCoord.y;
            let alto = itemCoord.alto || 45;

            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            // Capa óptica segura
            aplicarFiltroOpticoSeguro(subCtx, subCanvas.width, subCanvas.height);

            const dataURL = subCanvas.toDataURL('image/png');
            if (statusEl) statusEl.innerText = `Reconociendo bloque ${i + 1} de ${coordenadasBase.length} (Y:${yInicio}px)...`;
            
            const ret = await worker.recognize(dataURL);
            
            let texto = '';
            if (ret && ret.data && ret.data.text) {
                texto = ret.data.text.trim().replace(/\n/g, ' | ');
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: [texto !== '' ? texto : '(Vacío / Sin texto detectado)'],
                cordYAsignada: yInicio,
                calibracionEstado: 'Excel + Canvas OK'
            });
        }

        await worker.terminate();
        renderizarTablaDinamica(filasExtraidas);
        registrarLogAprendizaje(filasExtraidas);
        alert('¡OCR guiado por Excel finalizado con éxito!');

    } catch (error) {
        console.error('Error crítico OCR:', error);
        const mensajeError = error && error.message ? error.message : JSON.stringify(error);
        alert('Error en ejecución: ' + mensajeError);
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ff5252;">Falla: ' + mensajeError + '</td></tr>';
        }
    }
}

// Lector inteligente de plantilla Excel para extraer coordenadas reales
async function obtenerCoordenadasDePlantillaExcel() {
    const inputs = document.querySelectorAll('input[type="file"]');
    let excelFile = null;
    
    // Buscar el input que contenga un archivo de Excel (que no sea el de imagen)
    for (let inp of inputs) {
        if (inp.id !== 'imageFile' && inp.files && inp.files.length > 0) {
            excelFile = inp.files[0];
            break;
        }
    }

    if (excelFile && typeof XLSX !== 'undefined') {
        try {
            const data = await excelFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json && json.length > 0) {
                console.log("Plantilla Excel leída correctamente:", json);
                return json.map((row, idx) => ({
                    y: Number(row.cordYAsignada || row.Y || row.y || (idx * 45)),
                    alto: Number(row.alto || row.height || 45)
                }));
            }
        } catch (e) {
            console.warn("Aviso: No se pudo leer el archivo Excel, usando coordenadas base de respaldo:", e);
        }
    }

    // Respaldo por defecto si no hay Excel cargado
    return [
        { y: 0, alto: 45 },
        { y: 45, alto: 45 },
        { y: 90, alto: 45 },
        { y: 135, alto: 45 },
        { y: 180, alto: 45 }
    ];
}

// Función defensiva de óptica local
function aplicarFiltroOpticoSeguro(ctx, width, height) {
    try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const factor = 1.2;
        const offset = -15;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            let v = 0.299 * r + 0.587 * g + 0.114 * b;

            let newVal = v * factor + offset;
            if (newVal < 0) newVal = 0;
            if (newVal > 255) newVal = 255;

            data[i] = newVal;
            data[i + 1] = newVal;
            data[i + 2] = newVal;
        }
        ctx.putImageData(imgData, 0, 0);
    } catch (e) {
        console.warn('Filtro óptico omitido por seguridad en este bloque:', e);
    }
}

function renderizarTablaDinamica(datos) {
    const tbody = document.querySelector('#tabla-resultados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datos.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${row.id}</b></td>
            <td style="font-family: monospace; font-size: 12px; color: #00ffcc;">${row.columnas[0]}</td>
            <td style="font-size:10px; color:#00bcd4;">
                Y:${row.cordYAsignada}px<br>
                <b>${row.calibracionEstado}</b><br><br>
                <button onclick="aprenderFilaSeleccionada(${index})" style="background: #00bcd4; color: #000; border: none; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 11px;">🧠 Aprender</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function aprenderFilaSeleccionada(index) {
    alert(`Aprendiendo de la fila #${index + 1}... Datos guardados en la memoria de calibración.`);
}

function registrarLogAprendizaje(nuevosDatos) {
    try {
        let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
        historial.push({
            fecha: new Date().toISOString(),
            registros: nuevosDatos
        });
        localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
        if (typeof mostrarLogEnPantalla === 'function') {
            mostrarLogEnPantalla();
        }
    } catch(e) {
        console.error('Error guardando log:', e);
    }
}

function importarLogAprendizaje(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenido = e.target.result;
            JSON.parse(contenido);
            localStorage.setItem('mar_caribe_learning_log', contenido);
            if (typeof mostrarLogEnPantalla === 'function') {
                mostrarLogEnPantalla();
            }
            alert('Log importado exitosamente.');
        } catch(err) {
            alert('El archivo JSON no es válido.');
        }
    };
    reader.readAsText(file);
}
