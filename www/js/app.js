document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const canvasScaler = document.getElementById('canvas-scaler');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    const loadingStatusTitle = document.getElementById('loading-status-title');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');
    const excelStatus = document.getElementById('excel-status');
    const cellValueInput = document.getElementById('cell-value-input');
    const activeCellLabel = document.getElementById('active-cell-label');

    let currentImage = null;
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;

    // Gestión de Pestañas de Motores
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            console.log(`Motor OCR seleccionado: ${activeEngine}`);

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

    // Ejecutor OCR 100% Real (Sin simulaciones de prueba)
    async function ejecutarMotorOCRReal(thresholdValue, engine) {
        if (!currentImage) return;

        loadingOverlay.style.display = 'flex';
        aplicarUmbralInstantaneo(thresholdValue);

        const imageDataURL = canvas.toDataURL('image/png');
        let lineasExtraidas = [];

        try {
            loadingStatusTitle.textContent = `Inicializando ${engine === 'table' ? 'Tesseract Tabla' : 'Tesseract'}...`;
            
            // Configuramos PSM (Page Segmentation Mode) dependiendo del motor elegido
            // PSM 3 = Automático (Tesseract normal), PSM 6 = Bloque uniforme de texto / Tabla (Tesseract Tabla)
            const psmMode = engine === 'table' ? 6 : 3;

            const worker = await Tesseract.createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const percent = Math.round(m.progress * 100);
                        progressText.textContent = `${percent}%`;
                    } else if (m.status) {
                        loadingStatusTitle.textContent = m.status;
                    }
                }
            });

            await worker.setParameters({
                tessedit_pageseg_mode: psmMode,
            });

            const ret = await worker.recognize(imageDataURL);
            await worker.terminate();

            const textoCrudo = ret.data.text.trim();
            console.log("Texto OCR real obtenido:", textoCrudo);
            
            lineasExtraidas = textoCrudo.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        } catch (err) {
            console.error("Error crítico en Tesseract OCR:", err);
            loadingStatusTitle.textContent = 'Error de lectura OCR';
            lineasExtraidas = ["Error al procesar la imagen con Tesseract"];
        }

        // Volcar datos distribuidos en la cuadrícula del Mini Excel de forma real
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
            cellValueInput.value = "No se detectó texto legible";
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

    // Controles de Zoom
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
    }
});
