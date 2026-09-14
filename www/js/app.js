async function ejecutarCalibracionDual() {
    alert('Iniciando OCR real...');
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
            thead.innerHTML = '<tr style="background: #333;"><th>#</th><th>Texto Detectado</th><th>Estado</th></tr>';
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;">Procesando imagen con Tesseract...</td></tr>';
        }

        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error al leer bytes de imagen.'));
            reader.readAsDataURL(file);
        });

        const imgElement = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Error al decodificar objeto Image.'));
            img.src = base64Data;
        });

        // Inicialización estricta local
        const worker = await Tesseract.createWorker('spa', {
            langPath: 'tessdata',
            gzip: true,
            logger: m => console.log(m)
        });

        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        let filasExtraidas = [];
        for (let i = 0; i < 5; i++) {
            let yInicio = i * 45;
            let alto = 45;
            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            // SIN TEXTOS FALSOS: Si falla, lanzará el error real para depurarlo
            const dataURL = subCanvas.toDataURL('image/png');
            const ret = await worker.recognize(dataURL);
            
            let texto = '';
            if (ret && ret.data && ret.data.text) {
                texto = ret.data.text.trim().replace(/\n/g, ' | ');
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: [texto !== '' ? texto : '(Vacío / Sin texto detectado)'],
                cordYAsignada: yInicio,
                calibracionEstado: 'Real OCR OK'
            });
        }

        await worker.terminate();
        renderizarTablaDinamica(filasExtraidas);
        registrarLogAprendizaje(filasExtraidas);
        alert('¡OCR finalizado sin datos simulados!');

    } catch (error) {
        console.error('Error crítico OCR:', error);
        alert('Error real de Tesseract: ' + error.message);
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ff5252;">Falla: ' + error.message + '</td></tr>';
        }
    }
}

function renderizarTablaDinamica(datos) {
    const tbody = document.querySelector('#tabla-resultados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    datos.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><b>' + row.id + '</b></td><td style="font-family: monospace; font-size: 12px; color: #00ffcc;">' + row.columnas[0] + '</td><td style="font-size:10px; color:#00bcd4;">Y:' + row.cordYAsignada + 'px<br><b>' + row.calibracionEstado + '</b></td>';
        tbody.appendChild(tr);
    });
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
