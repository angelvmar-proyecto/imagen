async function ejecutarCalibracionDual() {
    alert('Iniciando OCR multiconcepto guiado por plantilla...');
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
            return;
        }

        const tbody = document.querySelector('#tabla-resultados tbody');
        const thead = document.querySelector('#tabla-resultados thead');
        
        if (tbody && thead) {
            thead.innerHTML = '<tr style="background: #333;"><th>#</th><th>Columna 1</th><th>Columna 2</th><th>Columna 3</th><th>Estado</th></tr>';
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ffeb3b;" id="ocr-status">Procesando y segmentando columnas...</td></tr>';
        }

        const statusEl = document.getElementById('ocr-status');

        const coordenadasBase = await obtenerCoordenadasDePlantillaExcelDirecto(excelFile);

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

            // Segmentar inteligentemente el texto en 3 columnas basadas en espacios amplios o separadores
            let partes = textoCrudo.split('|');
            if (partes.length < 3) {
                // Si no hay tuberías, dividimos el texto por espacios largos o palabras clave aproximadas
                let palabras = textoCrudo.split(' ');
                let tercio = Math.ceil(palabras.length / 3);
                partes = [
                    palabras.slice(0, tercio).join(' ') || '(Vacío)',
                    palabras.slice(tercio, tercio * 2).join(' ') || '(Vacío)',
                    palabras.slice(tercio * 2).join(' ') || '(Vacío)'
                ];
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: [
                    partes[0] ? partes[0].trim() : '(Vacío)',
                    partes[1] ? partes[1].trim() : '(Vacío)',
                    partes[2] ? partes[2].trim() : '(Vacío)'
                ],
                cordYAsignada: yInicio,
                calibracionEstado: 'OK'
            });
        }

        await worker.terminate();
        renderizarTablaDinamica(filasExtraidas);
        registrarLogAprendizaje(filasExtraidas);
        alert('¡Extracción por columnas finalizada con éxito!');

    } catch (error) {
        console.error('Error crítico OCR:', error);
        const mensajeError = error && error.message ? error.message : JSON.stringify(error);
        alert('Error en ejecución: ' + mensajeError);
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff5252;">Falla: ' + mensajeError + '</td></tr>';
        }
    }
}

async function obtenerCoordenadasDePlantillaExcelDirecto(excelFile) {
    if (excelFile && typeof XLSX !== 'undefined') {
        try {
            const data = await excelFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json && json.length > 0) {
                return json.map((row, idx) => ({
                    y: Number(row.cordYAsignada || row.Y || row.y || (idx * 45)),
                    alto: Number(row.alto || row.height || 45)
                }));
            }
        } catch (e) {
            console.warn("Aviso: No se pudo leer el archivo Excel, usando respaldo:", e);
        }
    }

    return [
        { y: 0, alto: 45 },
        { y: 45, alto: 45 },
        { y: 90, alto: 45 },
        { y: 135, alto: 45 },
        { y: 180, alto: 45 }
    ];
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

function renderizarTablaDinamica(datos) {
    const tbody = document.querySelector('#tabla-resultados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datos.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${row.id}</b></td>
            <td style="font-family: monospace; font-size: 11px; color: #00ffcc;">${row.columnas[0]}</td>
            <td style="font-family: monospace; font-size: 11px; color: #ffeb3b;">${row.columnas[1]}</td>
            <td style="font-family: monospace; font-size: 11px; color: #00bcd4;">${row.columnas[2]}</td>
            <td style="font-size:10px; color:#aaa;">Y:${row.cordYAsignada}px</td>
        `;
        tbody.appendChild(tr);
    });
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
        alert('No se pudo exportar el archivo.');
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
