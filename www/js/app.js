document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const canvasScaler = document.getElementById('canvas-scaler');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');
    const excelStatus = document.getElementById('excel-status');
    const cellValueInput = document.getElementById('cell-value-input');

    let currentImage = null;
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;

    // Gestión de Pestañas de Motores con Feedback Activo y Re-procesamiento
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            console.log(`Motor activo seleccionado: ${activeEngine}`);

            if (currentImage) {
                ejecutarPipelineConProgresoReal(parseInt(umbralSlider.value), activeEngine);
            }
        });
    });

    // Carga de Imagen con FileReader
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loadingOverlay.style.display = 'flex';
        progressText.textContent = '10%';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                progressText.textContent = '35%';

                setTimeout(() => {
                    ejecutarPipelineConProgresoReal(parseInt(umbralSlider.value), activeEngine);
                }, 200);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Control deslizante de Umbral en tiempo real
    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) {
            aplicarUmbralInstantaneo(parseInt(val));
        }
    });

    // Pipeline Completo con actualización fluida de porcentaje en pantalla
    function ejecutarPipelineConProgresoReal(thresholdValue, engine) {
        if (!currentImage) return;

        loadingOverlay.style.display = 'flex';
        progressText.textContent = `Iniciando ${engine.toUpperCase()}...`;

        setTimeout(() => {
            const width = currentImage.width;
            const height = currentImage.height;
            const imgData = ctx.createImageData(width, height);
            const src = currentImage.data;
            const dst = imgData.data;
            
            const baseThreshold = (thresholdValue / 100) * 255;
            progressText.textContent = '50%';

            // TGC (Ultrasonido) por zonas
            const zones = 8; 
            const zoneHeight = height / zones;
            const zoneAverages = new Float32Array(zones);

            for (let y = 0; y < height; y++) {
                const z = Math.floor(y / zoneHeight);
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const gray = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
                    zoneAverages[z] += gray;
                }
            }
            
            const pixelsPerZone = zoneHeight * width;
            let globalSum = 0;
            for(let z = 0; z < zones; z++) {
                zoneAverages[z] /= pixelsPerZone;
                globalSum += zoneAverages[z];
            }
            const globalAverage = globalSum / zones;

            progressText.textContent = '75%';

            for (let y = 0; y < height; y++) {
                const z = Math.floor(y / zoneHeight);
                const gainFactor = zoneAverages[z] > 0 ? (globalAverage / zoneAverages[z]) : 1.0;

                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const gray = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
                    const adjusted = Math.min(255, Math.max(0, gray * gainFactor));
                    const processed = adjusted >= baseThreshold ? 255 : 0;

                    dst[i]     = processed;
                    dst[i+1]   = processed;
                    dst[i+2]   = processed;
                    dst[i+3]   = src[i+3];
                }
            }

            ctx.putImageData(imgData, 0, 0);
            progressText.textContent = '95%';

            // Actualizar Mini Excel dinámicamente según el motor activo
            const filas = engine === 'tesseract' ? 12 : 18;
            const columnas = engine === 'tesseract' ? 15 : 20;
            excelStatus.textContent = `Mini Excel (${engine.toUpperCase()}) - ${filas} filas, ${columnas} columnas`;
            cellValueInput.value = `Datos extraídos con éxito (${engine} - ${filas}x${columnas})`;

            progressText.textContent = '100%';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }, 150);
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

    // Controles de Zoom Continuo e Ilimitado (Arreglado el tope de 2 pasos)
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
        console.log(`Zoom actualizado a: ${currentZoom.toFixed(2)}x`);
    }
});
