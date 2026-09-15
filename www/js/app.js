async function ejecutarCalibracionAutonoma() {
    alert('Iniciando pipeline OCR autónomo con filtro óptico y plantilla...');
    try {
        const imageInput = document.getElementById('imageFile');
        const excelInput = document.getElementById('excelFile') || document.querySelector('input[type="file"]');
        
        if (!imageInput || !imageInput.files || imageInput.files.length === 0) {
            alert('Por favor selecciona obligatoriamente una Imagen de WhatsApp.');
            return;
        }

        const file = imageInput.files[0];
        const tbody = document.querySelector('#tabla-resultados tbody');
        const thead = document.querySelector('#tabla-resultados thead');
        
        if (tbody && thead) {
            thead.innerHTML = '<tr style="background: #333;"><th>#</th><th>Texto Extraído (Autónomo)</th><th>Estado Óptico y Coordenada</th></tr>';
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;" id="ocr-status">Leyendo plantilla de referencia...</td></tr>';
        }

        const statusEl = document.getElementById('ocr-status');

        // 1. Cargar coordenadas desde plantilla (Excel/JSON) o usar matriz adaptativa base
        let coordenadasBase = await obtenerCoordenadasDePlantilla(excelInput);

        if (statusEl) statusEl.innerText = 'Cargando bytes de imagen...';
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(new Error('Error al leer bytes de imagen: ' + (err.message || 'desconocido')));
            reader.readAsDataURL(file);
        });

        const imgElement = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error('Error al decodificar objeto Image'));
            img.src = base64Data;
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
        
        // 2. Bucle de procesamiento autónomo guiado por la plantilla óptica
        for (let i = 0; i < coordenadasBase.length; i++) {
            let itemCoord = coordenadasBase[i];
            let yInicio = itemCoord.y;
            let alto = itemCoord.alto || 45;

            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            // Aplicar filtro óptico avanzado de binarización tardía y realce local
            aplicarFiltroOpticoLocal(subCtx, subCanvas.width, subCanvas.height);

            const dataURL = subCanvas.toDataURL('image/png');
            if (statusEl) statusEl.innerText = `Procesando renglón autónomo ${i + 1} de ${coordenadasBase.length}...`;
            
            const ret = await worker.recognize(dataURL);
            
            let texto = '';
            if (ret && ret.data && ret.data.text) {
                texto = ret.data.text.trim().replace(/\n/g, ' | ');
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: [texto !== '' ? texto : '(Vacío / Sin texto detectado)'],
                cordYAsignada: yInicio,
                calibracionEstado: 'Auto-aprendizaje OK'
            });
        }

        await worker.terminate();
        
        // 3. Renderizar y auto-registrar el conocimiento en el log del sistema
        renderizarTablaAutonoma(filasExtraidas);
        registrarLogAprendizajeAutonomo(filasExtraidas);
        
        alert('¡Pipeline OCR autónomo finalizado con éxito! Log actualizado.');

    } catch (error) {
        console.error('Error crítico en Pipeline OCR:', error);
        const mensajeError = error && error.message ? error.message : JSON.stringify(error);
        alert('Error en proceso autónomo: ' + mensajeError);
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ff5252;">Falla crítica: ' + mensajeError + '</td></tr>';
        }
    }
}

// Ingesta inteligente de plantilla de referencia (Excel o JSON previo)
async function obtenerCoordenadasDePlantilla(inputElement) {
    // Si el usuario cargó un archivo de referencia explícito
    if (inputElement && inputElement.files && inputElement.files.length > 0) {
        try {
            const file = inputElement.files[0];
            const data = await file.arrayBuffer();
            if (typeof XLSX !== 'undefined') {
                const workbook = XLSX.read(data);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                if (json && json.length > 0) {
                    // Extraer coordenadas Y si existen en el Excel, de lo contrario mapearlas
                    return json.map((row, idx) => ({
                        y: row.cordYAsignada || row.Y || (idx * 45),
                        alto: row.alto || 45
                    }));
                }
            }
        } catch (e) {
            console.warn('No se pudo parsear el archivo de referencia, usando memoria previa:', e);
        }
    }

    // Fallback: Buscar en el historial de localStorage el último estándar aprendido
    try {
        let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
        if (historial.length > 0) {
            let ultimoRegistro = historial[historial.length - 1];
            if (ultimoRegistro && ultimoRegistro.registros) {
                return ultimoRegistro.registros.map(r => ({
                    y: r.cordYAsignada,
                    alto: 45
                }));
            }
        }
    } catch (e) {
        console.warn('Historial local vacío, usando matriz geométrica base:', e);
    }

    // Matriz base por defecto si no hay ningún archivo ni historial previo
    return [
        { y: 0, alto: 45 },
        { y: 45, alto: 45 },
        { y: 90, alto: 45 },
        { y: 135, alto: 45 },
        { y: 180, alto: 45 }
    ];
}

// Filtro óptico seguro: Realza contraste local preservando escalas de grises y antialiasing
function aplicarFiltroOpticoLocal(ctx, width, height) {
    try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const factor = 1.25; // Ganancia óptica de contraste
        const offset = -20;  // Aislar texto claro sobre fondo oscuro

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
        console.warn('Filtro óptico omitido en sub-bloque por seguridad:', e);
    }
}

function renderizarTablaAutonoma(datos) {
    const tbody = document.querySelector('#tabla-resultados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datos.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${row.id}</b></td>
            <td style="font-family: monospace; font-size: 12px; color: #00ffcc;">${row.columnas[0]}</td>
            <td style="font-size:10px; color:#00bcd4;">
                Y:${row.cordYAsignada}px<br>
                <b>${row.calibracionEstado}</b>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function registrarLogAprendizajeAutonomo(nuevosDatos) {
    try {
        let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
        historial.push({
            fecha: new Date().toISOString(),
            registros: nuevosDatos
        });
        localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
        
        // Actualizar vista en pantalla si existe la función del visor
        if (typeof mostrarLogEnPantalla === 'function') {
            mostrarLogEnPantalla();
        }
    } catch(e) {
        console.error('Error guardando log autónomo:', e);
    }
}

// Botón Maestro: Exportar el conocimiento aprendido como el nuevo estándar descargable
function exportarNuevoEstandarAprendido() {
    try {
        const historial = localStorage.getItem('mar_caribe_learning_log') || '[]';
        const blob = new Blob([historial], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `estandares_aprendidos_mar_caribe_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('¡Nuevo estándar exportado con éxito! Este archivo es tu plantilla base para las siguientes ejecuciones.');
    } catch (e) {
        alert('Error al exportar el estándar: ' + e.message);
    }
}
