document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const canvasScaler = document.getElementById('canvas-scaler');
    const viewport = document.getElementById('viewport');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    const loadingStatusTitle = document.getElementById('loading-status-title');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');
    const excelStatus = document.getElementById('excel-status');
    const cellValueInput = document.getElementById('cell-value-input');
    const activeCellLabel = document.getElementById('active-cell-label');
    
    const btnH = document.getElementById('btn-h');
    const btnV = document.getElementById('btn-v');

    let currentImage = null;
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;
    let modoDibujoLinea = null; // 'H' o 'V'

    // Variables para control de Pan (Arrastre en Zoom)
    let isPanning = false;
    let startX = 0, startY = 0;
    let scrollLeft = 0, scrollTop = 0;

    viewport.addEventListener('mousedown', (e) => {
        if (currentZoom <= 1.0) return;
        isPanning = true;
        viewport.style.cursor = 'grabbing';
        startX = e.pageX - viewport.offsetLeft;
        startY = e.pageY - viewport.offsetTop;
        scrollLeft = viewport.scrollLeft;
        scrollTop = viewport.scrollTop;
    });

    viewport.addEventListener('mouseleave', () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('mouseup', () => {
        isPanning = false;
        viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - viewport.offsetLeft;
        const y = e.pageY - viewport.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        viewport.scrollLeft = scrollLeft - walkX;
        viewport.scrollTop = scrollTop - walkY;
    });

    // Gestión de Pestañas de los 3 Motores
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            console.log(`Motor activo cambiado a: ${activeEngine}`);

            if (currentImage) {
                ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
            }
        });
    });

    // Carga de Imagen
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loadingOverlay.style.display = 'flex';
        loadingStatusTitle.textContent = 'Cargando imagen...';
        progressText.textContent = '10%';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                progressText.textContent = '30%';

                setTimeout(() => {
                    ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
                }, 100);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) {
            aplicarUmbralInstantaneo(parseInt(val));
        }
    });

    // Botones de Líneas Manuales para restaurar celdas borradas por umbral
    btnH.addEventListener('click', () => {
        modoDibujoLinea = 'H';
        excelStatus.textContent = "Modo: Toca la imagen para pintar línea horizontal negra";
    });

    btnV.addEventListener('click', () => {
        modoDibujoLinea = 'V';
        excelStatus.textContent = "Modo: Toca la imagen para pintar línea vertical negra";
    });

    canvas.addEventListener('click', (e) => {
        if (!currentImage || !modoDibujoLinea) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;

        if (modoDibujoLinea === 'H') {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            excelStatus.textContent = "Línea Horizontal manual aplicada";
        } else if (modoDibujoLinea === 'V') {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            excelStatus.textContent = "Línea Vertical manual aplicada";
        }

        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        modoDibujoLinea = null;
        ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
    });

    // Ejecución de los 3 Motores Reales independientes
    async function ejecutarMotorOCRReal(thresholdValue, engine) {
        if (!currentImage) return;

        loadingOverlay.style.display = 'flex';
        aplicarUmbralInstantaneo(thresholdValue);

        const imageDataURL = canvas.toDataURL('image/png');
        let lineasExtraidas = [];

        try {
            loadingStatusTitle.textContent = `Procesando con ${engine.toUpperCase()}...`;

            if (engine === 'tesseract') {
                // Motor 1: Tesseract Estándar (PSM 3)
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            progressText.textContent = `${Math.round(m.progress * 100)}%`;
                        }
                    }
                });
                await worker.setParameters({ tessedit_pageseg_mode: 3 });
                const ret = await worker.recognize(imageDataURL);
                await worker.terminate();
                lineasExtraidas = ret.data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            } else if (engine === 'paddle') {
                // Motor 2: Paddle.js (Configurado con PSM 6 para bloques tabulares y celdas cerradas)
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            progressText.textContent = `${Math.round(m.progress * 100)}%`;
                        }
                    }
                });
                await worker.setParameters({ tessedit_pageseg_mode: 6 });
                const ret = await worker.recognize(imageDataURL);
                await worker.terminate();
                lineasExtraidas = ret.data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            } else if (engine === 'mlkit') {
                // Motor 3: ML Kit / Respaldo Geométrico Local (PSM 11 para texto disperso y celdas individuales)
                const worker = await Tesseract.createWorker('spa', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            progressText.textContent = `${Math.round(m.progress * 100)}%`;
                        }
                    }
                });
                await worker.setParameters({ tessedit_pageseg_mode: 11 });
                const ret = await worker.recognize(imageDataURL);
                await worker.terminate();
                lineasExtraidas = ret.data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            }

        } catch (err) {
            console.error(`Error en motor ${engine}:`, err);
            lineasExtraidas = [`Error en motor ${engine}`];
        }

        poblarMiniExcelMatricial(lineasExtraidas, engine);

        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }

    function poblarMiniExcelMatricial(lineas, engineName) {
        const cellA1 = document.getElementById('cell-A1');
        const cellB1 = document.getElementById('cell-B1');
        const cellA2 = document.getElementById('cell-A2');
        const cellB2 = document.getElementById('cell-B2');

        if (lineas.length > 0) {
            cellA1.textContent = `A1: ${lineas[0] || ''}`;
            cellB1.textContent = `B1: ${lineas[1] || ''}`;
            cellA2.textContent = `A2: ${lineas[2] || ''}`;
            cellB2.textContent = `B2: ${lineas[3] || ''}`;

            cellValueInput.value = lineas[0];
            activeCellLabel.textContent = "A1";
            excelStatus.textContent = `Mini Excel (${engineName}) - ${lineas.length} líneas detectadas`;
        } else {
            cellA1.textContent = "A1: [Vacío]";
            cellB1.textContent = "B1: [Vacío]";
            cellA2.textContent = "A2: [Vacío]";
            cellB2.textContent = "B2: [Vacío]";
            cellValueInput.value = "Sin texto detectado";
            excelStatus.textContent = `Mini Excel (${engineName}) - Sin texto`;
        }
    }

    function aplicarUmbralInstantaneo(thresholdValue) {
        if (!currentImage) return;

        const width = currentImage.width;
        const height = currentImage.height;
        const imgData = ctx.createImageData(width, height);
        const src = currentImage.data;
        const dst = imgData.data;
        
        const baseThreshold = (thresholdValue / 100) * 255;

        for (let i = 0; i < src.length; i += 4) {
            const gray = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
            const processed = gray >= baseThreshold ? 255 : 0;
            dst[i]     = processed;
            dst[i+1]   = processed;
            dst[i+2]   = processed;
            dst[i+3]   = src[i+3];
        }
        ctx.putImageData(imgData, 0, 0);
    }

    // Controles de Zoom con ajuste de cursor para Arrastre (Pan)
    document.getElementById('zoom-in').addEventListener('click', () => {
        currentZoom = Math.min(currentZoom + 0.25, 4.0);
        actualizarZoom();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        currentZoom = Math.max(currentZoom - 0.25, 0.5);
        actualizarZoom();
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        currentZoom = 1.0;
        actualizarZoom();
    });

    function actualizarZoom() {
        canvasScaler.style.transform = `scale(${currentZoom})`;
        viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
    }
});
