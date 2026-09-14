// Asegurar enlace directo al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnProcesar') || document.querySelector('button');
    if (btn) {
        btn.onclick = ejecutarCalibracionDual;
    }
});

async function ejecutarCalibracionDual() {
    alert('Iniciando proceso OCR local...');
    try {
        const imageInput = document.getElementById('imageFile');
            alert('Por favor selecciona una Imagen de WhatsApp obligatoriamente.');
            return;
        }

        const file = imageInput.files[0];
        const tbody = document.querySelector('#tabla-resultados tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;">Cargando motor Tesseract local...</td></tr>';
        }

        // Inicialización estricta de Tesseract con tessdata local
        const worker = await Tesseract.createWorker('spa', 1, {
            langPath: 'tessdata',
            gzip: true,
            logger: m => console.log(m)
        });

        const imgElement = await cargarImagenSegura(file);
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        let resultados = [];
        for (let i = 0; i < 5; i++) {
            let yInicio = i * 50;
            let alto = 50;
            const subCanvas = document.createElement('canvas');
            subCanvas.width = canvas.width;
            subCanvas.height = alto;
            const subCtx = subCanvas.getContext('2d');
            subCtx.drawImage(canvas, 0, yInicio, canvas.width, alto, 0, 0, canvas.width, alto);

            let texto = 'Segmento ' + (i + 1);
            try {
                const dataURL = subCanvas.toDataURL('image/png');
                const ret = await worker.recognize(dataURL);
                if (ret && ret.data && ret.data.text) {
                    texto = ret.data.text.trim().replace(/
/g, ' | ');
                }
            } catch (err) {
                console.error('Error en segmento ' + i, err);
            }

            resultados.push({
                id: i + 1,
                columnas: [texto !== '' ? texto : 'Vacío'],
                cordYAsignada: yInicio,
                calibracionEstado: 'Local OK'
            });
        }

        await worker.terminate();
        renderizarTablaDinamica(resultados);
        alert('¡Procesamiento OCR completado con éxito!');

    } catch (error) {
        console.error('Error en ejecución:', error);
        alert('Error en OCR: ' + error.message);
    }
}

function cargarImagenSegura(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsDataURL(file);
    });
}

function renderizarTablaDinamica(datos) {
    const thead = document.querySelector('#tabla-resultados thead');
    const tbody = document.querySelector('#tabla-resultados tbody');
    thead.innerHTML = ''; 
    tbody.innerHTML = '';

    let headerTr = document.createElement('tr');
    headerTr.style.background = '#333';
    headerTr.innerHTML = '<th>#</th><th>Texto Extraído Local</th><th>Estado</th>';
    thead.appendChild(headerTr);

    datos.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><b>' + row.id + '</b></td><td style="font-family: monospace; font-size: 12px; color: #00ffcc;">' + row.columnas[0] + '</td><td style="font-size:10px; color:#00bcd4;">Y:' + row.cordYAsignada + 'px<br><b>' + row.calibracionEstado + '</b></td>';
        tbody.appendChild(tr);
    });
}
