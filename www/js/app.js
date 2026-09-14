document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    
    let currentImage = new Image();
    let rows = [];
    let cols = [];
    let isEditing = false;

    function log(message, type = 'info') {
        const consoleEl = document.getElementById('log-console');
        const time = new Date().toTimeString().split(' ')[0];
        const span = document.createElement('div');
        span.className = `log-${type}`;
        span.textContent = `[${time}] ${message}`;
        consoleEl.appendChild(span);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    document.getElementById('btn-cargar').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            currentImage.onload = function() {
                canvas.width = currentImage.width;
                canvas.height = currentImage.height;
                ctx.drawImage(currentImage, 0, 0);
                log(`Imagen cargada: ${file.name} (${file.size} bytes) - Dimensiones: ${currentImage.width}x${currentImage.height}px`, 'success');
                detectLines();
            }
            currentImage.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    function detectLines() {
        if (!currentImage.width) return;
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const threshold = parseInt(document.getElementById('range-umbral').value);
        const densityMin = parseInt(document.getElementById('range-densidad').value) / 100;

        rows = [];
        cols = [];

        for (let y = 0; y < canvas.height; y += 4) {
            let darkPixels = 0;
            let rowWidth = canvas.width;
            for (let x = 0; x < rowWidth; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                if (avg < threshold) darkPixels++;
            }
            if ((darkPixels / (rowWidth / 2)) >= densityMin) {
                rows.push(y);
            }
        }

        for (let x = 0; x < canvas.width; x += 4) {
            let darkPixels = 0;
            let colHeight = canvas.height;
            for (let y = 0; y < colHeight; y += 2) {
                const idx = (y * canvas.width + x) * 4;
                const avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                if (avg < threshold) darkPixels++;
            }
            if ((darkPixels / (colHeight / 2)) >= densityMin) {
                cols.push(x);
            }
        }

        log(`Detección completada: ${rows.length} filas y ${cols.length} columnas detectadas.`, 'success');
        redrawCanvas();
    }

    function redrawCanvas() {
        if (!currentImage.width) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0);

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        rows.forEach(y => {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        });

        ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
        ctx.lineWidth = 2;
        cols.forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        });
    }

    document.getElementById('btn-editar').addEventListener('click', () => {
        isEditing = !isEditing;
        log(isEditing ? "Modo edición activado." : "Modo edición desactivado.", "warn");
        document.getElementById('btn-editar').style.background = isEditing ? '#0d47a1' : '#2c2c2c';
    });

    canvas.addEventListener('click', (e) => {
        if (!isEditing) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (Math.abs(x - canvas.width / 2) > Math.abs(y - canvas.height / 2)) {
            rows.push(Math.round(y));
            rows.sort((a,b) => a - b);
            log(`Fila agregada en Y: ${Math.round(y)}`);
        } else {
            cols.push(Math.round(x));
            cols.sort((a,b) => a - b);
            log(`Columna agregada en X: ${Math.round(x)}`);
        }
        redrawCanvas();
    });

    document.getElementById('btn-ocr').addEventListener('click', async () => {
        if (!currentImage.width) {
            log("Error: Cargue una imagen antes de ejecutar el OCR.", "error");
            return;
        }

        log("Iniciando motor OCR Tesseract.js (Modo 100% Local)...", "info");

        try {
            const worker = await Tesseract.createWorker('spa+eng', 3, {
                workerPath: 'js/tesseract/tesseract.min.js',
                corePath: 'js/tesseract/tesseract-core.wasm.js',
                langPath: 'js/tesseract/',
                langExt: '.gzip',
                logger: m => {
                    if (m.status === 'recognizing text') {
                        log(`Progreso OCR: ${Math.round(m.progress * 100)}%`, 'info');
                    }
                }
            });

            const ret = await worker.recognize(canvas);
            log(`OCR Finalizado. Caracteres: ${ret.data.text.length}`, 'success');
            console.log("Texto extraído:", ret.data.text);
            await worker.terminate();
        } catch (err) {
            log(`Error en motor OCR: ${err.message}`, 'error');
            console.error(err);
        }
    });

    document.getElementById('btn-guardar').addEventListener('click', () => {
        const config = {
            rows,
            cols,
            brillo: document.getElementById('range-brillo').value,
            contraste: document.getElementById('range-contraste').value,
            umbral: document.getElementById('range-umbral').value,
            densidad: document.getElementById('range-densidad').value
        };
        localStorage.setItem('mar_caribe_config', JSON.stringify(config));
        log("Configuración guardada en localStorage.", "success");
    });

    document.getElementById('btn-log').addEventListener('click', () => {
        const consoleEl = document.getElementById('log-console');
        navigator.clipboard.writeText(consoleEl.innerText).then(() => {
            log("Logs copiados al portapapeles.", "success");
        });
    });

    document.getElementById('btn-nuevo').addEventListener('click', () => {
        rows = [];
        cols = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        currentImage = new Image();
        log("Aplicación reiniciada.", "warn");
    });

    ['brillo', 'contraste', 'umbral', 'densidad'].forEach(id => {
        const range = document.getElementById(`range-${id}`);
        const span = document.getElementById(`val-${id}`);
        range.addEventListener('input', () => {
            span.textContent = range.value;
            if(id === 'umbral' || id === 'densidad') {
                detectLines();
            }
        });
    });
});
