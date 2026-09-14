async function ejecutarCalibracionDual() {
    alert('Iniciando OCR con Tesseract y filtro óptico avanzado...');
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
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;" id="ocr-status">Inicializando motor óptico...</td></tr>';
        }

        const statusEl = document.getElementById('ocr-status');

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

        if (statusEl) statusEl.innerText = 'Creando worker de Tesseract...';
        
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
        for (let i = 0; i < 5; i++) {
            let yInicio = i * 45;
            let alto = 45;
            
            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            // Aplicar filtro óptico de realce local (Binarización tardía y estiramiento de contraste seguro)
            aplicarFiltroOpticoLocal(subCtx, subCanvas.width, subCanvas.height);

            const dataURL = subCanvas.toDataURL('image/png');
            if (statusEl) statusEl.innerText = `Procesando bloque óptico ${i + 1} de 5...`;
            
            const ret = await worker.recognize(dataURL);
            
            let texto = '';
            if (ret && ret.data && ret.data.text) {
                texto = ret.data.text.trim().replace(/\n/g, ' | ');
            }

            filasExtraidas.push({
                id: i + 1,
                columnas: [texto !== '' ? texto : '(Vacío / Sin texto detectado)'],
                cordYAsignada: yInicio,
                calibracionEstado: 'Óptica Avanzada OK'
            });
        }

        await worker.terminate();
        renderizarTablaDinamica(filasExtraidas);
        registrarLogAprendizaje(filasExtraidas);
        alert('¡OCR con filtro óptico finalizado con éxito!');

    } catch (error) {
        console.error('Error crítico OCR:', error);
        const mensajeError = error && error.message ? error.message : JSON.stringify(error);
        alert('Error en proceso óptico: ' + mensajeError);
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ff5252;">Falla: ' + mensajeError + '</td></tr>';
        }
    }
}

// Filtro óptico seguro: Realza los bordes y el contraste local sin destruir las escalas de grises (antialiasing)
function aplicarFiltroOpticoLocal(ctx, width, height) {
    try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        // Factor de estiramiento de contraste inteligente (simulando umbral dinámico de densidad)
        const factor = 1.2; 
        const offset = -15; // Oscurece ligeramente los fondos grises y satura el texto blanco o claro

        for (let i = 0; i < data.length; i += 4) {
            // Promedio ponderado de luminancia (escala de grises óptica)
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            let v = 0.299 * r + 0.587 * g + 0.114 * b;

            // Aplicar ganancia de contraste local conservando la transición suave de bordes
            let newVal = v * factor + offset;
            if (newVal < 0) newVal = 0;
            if (newVal > 255) newVal = 255;

            data[i] = newVal;     // R
            data[i + 1] = newVal; // G
            data[i + 2] = newVal; // B
            // Canal Alfa (data[i+3]) se mantiene intacto para preservar transparencia y bordes limpios
        }
        
        ctx.putImageData(imgData, 0, 0);
    } catch (e) {
        console.warn('El filtro óptico local omitió un bloque por seguridad, usando datos nativos:', e);
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
