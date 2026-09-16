async function ejecutarCalibracionDual() {
    const statusEl = document.getElementById('ocr-status-global');
    if (statusEl) statusEl.innerText = 'Iniciando escaneo y lectura de archivos...';

    try {
        const inputs = document.querySelectorAll('input[type="file"]');
        let imageFile = null;
        let excelFile = null;

        for (let inp of inputs) {
            if (inp.files && inp.files.length > 0) {
                let f = inp.files[0];
                let name = f.name.toLowerCase();
                if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.includes('image')) {
                    imageFile = f;
                } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.json')) {
                    excelFile = f;
                }
            }
        }

        if (!imageFile) {
            const imgInputEl = document.getElementById('imageFile');
            if (imgInputEl && imgInputEl.files && imgInputEl.files.length > 0) {
                imageFile = imgInputEl.files[0];
            }
        }

        if (!imageFile) {
            alert('Por favor selecciona obligatoriamente una Imagen de WhatsApp.');
            if (statusEl) statusEl.innerText = 'Falta seleccionar la imagen.';
            return;
        }

        // 1. Obtener estructura y columnas reales directamente del Excel
        const plantillaData = await obtenerEstructuraPlantillaExcel(excelFile);
        const coordenadasBase = plantillaData.coordenadas;
        const nombresColumnas = plantillaData.columnas;

        // Renderizar cabecera dinámica basada 100% en el Excel (todas las columnas reales)
        renderizarCabeceraDinamica(nombresColumnas);

        if (statusEl) statusEl.innerText = 'Cargando imagen en memoria móvil...';
        const objectUrl = URL.createObjectURL(imageFile);
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
        
        for (let i = 0; i < coordenadasBase.length; i++) {
            let itemCoord = coordenadasBase[i];
            let yInicio = itemCoord.y;
            let alto = itemCoord.alto || 45;

            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            aplicarFiltroOpticoSeguro(subCtx, subCanvas.width, subCanvas.height);

            const dataURL = subCanvas.toDataURL('image/png');
            if (statusEl) statusEl.innerText = `Reconociendo bloque ${i + 1} de ${coordenadasBase.length}...`;
            
            const ret = await worker.recognize(dataURL);
            
            let textoCrudo = '';
            if (ret && ret.data && ret.data.text) {
                textoCrudo = ret.data.text.trim().replace(/\s+/g, ' ');
            }

            // Distribuir el texto reconocido entre el total de columnas detectadas en el Excel
            let tokens = textoCrudo.split('|').map(t => t.trim()).filter(t => t.length > 0);
            if (tokens.length < nombresColumnas.length) {
                let palabras = textoCrudo.split(' ');
                let chunkSz = Math.max(1, Math.floor(palabras.length / nombresColumnas.length));
                tokens = [];
                for (let c = 0; c < nombresColumnas.length; c++) {
                    let slice = palabras.slice(c * chunkSz, (c + 1) * chunkSz).join(' ');
                    tokens.push(slice !== '' ? slice : '(Vacío)');
                }
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: tokens,
                cordYAsignada: yInicio,
                calibracionEstado: 'OK'
            });
        }

        await worker.terminate();
        renderizarCuerpoTablaDinamica(filasExtraidas);
        registrarLogAprendizaje(filasExtraidas);
        
        if (statusEl) statusEl.innerText = '¡Extracción y mapeo completados con éxito!';
        alert('¡Extracción adaptada a todas las columnas finalizada!');

    } catch (error) {
        console.error('Error crítico OCR:', error);
        const mensajeError = error && error.message ? error.message : JSON.stringify(error);
        alert('Error en ejecución: ' + mensajeError);
        if (statusEl) statusEl.innerText = 'Error: ' + mensajeError;
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#ff5252;">Falla: ' + mensajeError + '</td></tr>';
        }
    }
}

// Leer estructura completa y nombres de columnas del Excel de manera dinámica
async function obtenerEstructuraPlantillaExcel(excelFile) {
    let columnasDefecto = Array.from({length: 21}, (_, i) => `Col ${i + 1}`);
    let coordenadasDefecto = [
        { y: 0, alto: 45 },
        { y: 45, alto: 45 },
        { y: 90, alto: 45 },
        { y: 135, alto: 45 },
        { y: 180, alto: 45 }
    ];

    if (excelFile && typeof XLSX !== 'undefined') {
        try {
            const data = await excelFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json && json.length > 0) {
                const keys = Object.keys(json[0]).filter(k => {
                    let lk = k.toLowerCase();
                    return lk !== 'y' && lk !== 'cordyasignada' && lk !== 'alto' && lk !== 'height';
                });
                
                if (keys.length > 0) {
                    columnasDefecto = keys;
                }

                const coords = json.map((row, idx) => ({
                    y: Number(row.cordYAsignada || row.Y || row.y || (idx * 45)),
                    alto: Number(row.alto || row.height || 45)
                }));

                return {
                    columnas: columnasDefecto,
                    coordenadas: coords.length > 0 ? coords : coordenadasDefecto
                };
            }
        } catch (e) {
            console.warn("Aviso: No se pudo parsear las columnas del Excel, usando estructura estándar:", e);
        }
    }

    return {
        columnas: columnasDefecto,
        coordenadas: coordenadasDefecto
    };
}

function renderizarCabeceraDinamica(columnas) {
    const thead = document.querySelector('#tabla-resultados thead');
    if (!thead) return;
    
    let html = '<tr style="background: #222;"><th>#</th>';
    columnas.forEach(col => {
        html += `<th style="font-size: 10px; padding: 6px; white-space: nowrap;">${col}</th>`;
    });
    html += '<th>Estado</th></tr>';
    thead.innerHTML = html;
}

function renderizarCuerpoTablaDinamica(datos) {
    const tbody = document.querySelector('#tabla-resultados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datos.forEach((row) => {
        const tr = document.createElement('tr');
        let html = `<td><b>${row.id}</b></td>`;
        
        row.columnas.forEach(val => {
            html += `<td style="font-family: monospace; font-size: 11px; color: #00ffcc; white-space: nowrap;">${val}</td>`;
        });

        html += `<td style="font-size:9px; color:#aaa;">Y:${row.cordYAsignada}px</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

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
        console.warn('Filtro óptico omitido:', e);
    }
}

function exportarLogAprendizajeJSON() {
    try {
        const historial = localStorage.getItem('mar_caribe_learning_log');
        if (!historial || JSON.parse(historial).length === 0) {
            alert('Aún no hay registros de aprendizaje guardados.');
            return;
        }

        const blob = new Blob([historial], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mar_caribe_learning_log_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        alert('¡Log de aprendizaje exportado con éxito!');
    } catch (e) {
        console.error('Error al exportar log:', e);
        alert('No se pudo exportar el archivo JSON.');
    }
}

function registrarLogAprendizaje(nuevosDatos) {
    try {
        let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
        historial.push({
            fecha: new Date().toISOString(),
            registros: nuevosDatos
        });
        localStorage.setItem('mar_caribe_learning_log', JSON.stringify(historial));
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
            alert('Log importado exitosamente.');
        } catch(err) {
            alert('El archivo JSON no es válido.');
        }
    };
    reader.readAsText(file);
}
