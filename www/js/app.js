document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');

    let currentImage = null;
    let activeEngine = 'tesseract';

    // Manejo correcto del estado activo de los botones de motores
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            console.log(`Motor activo cambiado a: ${activeEngine}`);
        });
    });

    // Control seguro de carga de imagen de WhatsApp
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loadingOverlay.style.display = 'flex';
        progressText.textContent = '0%';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Procesar con barra de porcentaje fluida
                applyPipelineWithProgress(parseInt(umbralSlider.value));
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Control del umbral dinámico en tiempo real
    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) {
            applyAdvancedOpticalPipeline(parseInt(val));
        }
    });

    // Pipeline por bloques con reporte de porcentaje para evitar congelar la UI móvil
    function applyPipelineWithProgress(thresholdValue) {
        if (!currentImage) return;

        const width = currentImage.width;
        const height = currentImage.height;
        const imgData = ctx.createImageData(width, height);
        const src = currentImage.data;
        const dst = imgData.data;
        
        const baseThreshold = (thresholdValue / 100) * 255;

        // TGC (Ultrasonido) - Cálculo de brillo por zonas
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

        // Procesamiento por lotes en trozos (chunks) para animar el porcentaje de carga
        let currentY = 0;
        const batchSize = Math.max(1, Math.floor(height / 10)); // 10 por ciento por lote

        function processChunk() {
            const endY = Math.min(height, currentY + batchSize);

            for (let y = currentY; y < endY; y++) {
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

            currentY = endY;
            const percent = Math.round((currentY / height) * 100);
            progressText.textContent = `${percent}%`;

            if (currentY < height) {
                requestAnimationFrame(processChunk);
            } else {
                ctx.putImageData(imgData, 0, 0);
                loadingOverlay.style.display = 'none';
            }
        }

        requestAnimationFrame(processChunk);
    }

    // Pipeline instantáneo para cuando mueves el slider de umbral
    function applyAdvancedOpticalPipeline(thresholdValue) {
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

    // Botones de zoom interactivos
    document.getElementById('zoom-in').addEventListener('click', () => {
        canvas.style.transform = 'scale(1.2)';
        canvas.style.transition = 'transform 0.2s ease';
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        canvas.style.transform = 'scale(0.8)';
        canvas.style.transition = 'transform 0.2s ease';
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        canvas.style.transform = 'scale(1)';
    });
});
