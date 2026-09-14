document.addEventListener('DOMContentLoaded', () => {
    const btnProcesar = document.getElementById('btnProcesar') || document.querySelector('button');
    if (btnProcesar) {
        btnProcesar.onclick = ejecutarCalibracionDual;
    }
});

async function ejecutarCalibracionDual() {
    alert('¡Botón presionado con éxito! Iniciando OCR local...');
    try {
        const excelInput = document.getElementById('excelFile')?.files[0];
        const imageInput = document.getElementById('imageFile')?.files[0];
        
            alert('Error: Debe seleccionar una Imagen de WhatsApp.'); 
            return; 
        }
        
        const tbody = document.querySelector('#tabla-resultados tbody');
        if(tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ffeb3b;">Cargando Tesseract localmente...</td></tr>';
        }
        
        console.log('Creando worker de Tesseract local...');
        const worker = await Tesseract.createWorker('spa', 1, {
            langPath: 'tessdata',
            gzip: true,
            logger: m => console.log('Tesseract Log:', m)
        });

        const imgElement = await cargarImagenSegura(imageInput);
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);

        let filasExtraidas = [];
        for (let i = 0; i < 5; i++) {
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
                console.error('Error al reconocer segmento:', err); 
            }
            
            filasExtraidas.push({ 
                id: i + 1, 
                columnas: [textoExtraido !== '' ? textoExtraido : 'Vacío'], 
                referencia: 'Registro ' + (i+1), 
                cordYAsignada: yInicio, 
                calibracionEstado: 'OCR Local OK' 
            });
        }
        
        await worker.terminate();
        renderizarTablaDinamica(filasExtraidas);
        alert('¡OCR finalizado y procesado con éxito!');
        
    } catch (error) { 
        console.error('Error crítico en OCR:', error); 
        alert('Error crítico: ' + error.message); 
    }
}

function cargarImagenSegura(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Fallo al decodificar la imagen seleccionada.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Fallo al leer el archivo.'));
        reader.readAsDataURL(file);
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
