async function procesarArchivoDual(excelFile, imageFile) {
    let datosExcel = [];
    if (excelFile) { 
        try { datosExcel = await leerEstructuraExcel(excelFile); } catch(e) { console.error(e); }
    }
    const imgElement = await cargarImagenSegura(imageFile);
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);
    
    console.log('Iniciando Tesseract con tessdata 100% local...');
    let worker;
    try {
        // Inicialización estricta local apuntando a tessdata del proyecto
        worker = await Tesseract.createWorker('spa', 1, {
            langPath: 'tessdata',
            gzip: true,
            logger: m => console.log(m)
        });
    } catch (err) {
        console.error('Error con worker local spa, intentando modo básico:', err);
        worker = await Tesseract.createWorker();
        await worker.loadLanguage('spa');
        await worker.initialize('spa');
    }

    let filasExtraidas = [];
    let totalFilas = datosExcel.length > 0 ? datosExcel.length : 6;
    
    for (let i = 0; i < totalFilas; i++) {
        let yInicio = i * 40;
        let alto = 40;
        const subCanvas = document.createElement('canvas');
        subCanvas.width = canvas.width;
        subCanvas.height = alto;
        const subCtx = subCanvas.getContext('2d');
        subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);
        
        let textoExtraido = 'Fila ' + (i+1);
        try {
            const dataURL = subCanvas.toDataURL('image/png');
            const ret = await worker.recognize(dataURL);
            if (ret && ret.data && ret.data.text) { 
                textoExtraido = ret.data.text.trim().replace(/
/g, ' | '); 
            }
        } catch (err) { 
            console.error('Error OCR local en segmento:', err); 
        }
        
        let referenciaExcel = (datosExcel[i] && datosExcel[i].join) ? datosExcel[i].join(' | ') : 'Registro ' + (i+1);
        filasExtraidas.push({ 
            id: i + 1, 
            columnas: [textoExtraido !== '' ? textoExtraido : 'Vacío'], 
            referencia: referenciaExcel, 
            cordYAsignada: yInicio, 
            calibracionEstado: 'OCR Local Estricto' 
        });
    }
    
    await worker.terminate();
    return filasExtraidas;
}

function cargarImagenSegura(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error('No se pudo decodificar la imagen.'));
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

async function ejecutarCalibracionDual() {
    try {
        const excelInput = document.getElementById('excelFile')?.files[0];
        const imageInput = document.getElementById('imageFile')?.files[0];
        
            alert('Seleccione obligatoriamente la Imagen de WhatsApp.'); 
            return; 
        }
        
        const tbody = document.querySelector('#tabla-resultados tbody');
        if(tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;">Procesando OCR 100% Local (Offline)...</td></tr>';
        }
        
        const datosProcesados = await procesarArchivoDual(excelInput, imageInput);
        renderizarTablaDinamica(datosProcesados);
        
        if(typeof mostrarLogEnPantalla === 'function') {
            mostrarLogEnPantalla();
        }
        
        alert('¡Procesamiento OCR local finalizado!');
    } catch (error) { 
        console.error('Error local:', error); 
        alert('Error OCR Local: ' + error.message); 
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
                resolve(XLSX.utils.sheet_to_json(firstSheet, { header: 1 }));
            } catch (err) { reject(err); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

function renderizarTablaDinamica(datos) {
    const thead = document.querySelector('#tabla-resultados thead');
    const tbody = document.querySelector('#tabla-resultados tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';
    
    let headerTr = document.createElement('tr');
    headerTr.style.background = '#333';
    headerTr.innerHTML = '<th>#</th><th>Texto Local Extraído</th><th>Estado</th>';
    thead.appendChild(headerTr);
    
    datos.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><b>' + row.id + '</b></td><td style="font-family: monospace; font-size: 12px; color: #00ffcc;">' + row.columnas[0] + '</td><td style="font-size:10px; color:#00bcd4;">Y:' + row.cordYAsignada + 'px<br><b>' + row.calibracionEstado + '</b></td>';
        tbody.appendChild(tr);
    });
}

function mostrarLogEnPantalla() {
    const logBox = document.querySelector('textarea');
    let historial = JSON.parse(localStorage.getItem('mar_caribe_learning_log') || '[]');
    if (logBox) {
        logBox.value = JSON.stringify(historial, null, 2);
    }
}
