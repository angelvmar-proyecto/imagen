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

    // Manejo de pestañas de motores
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            console.log(`Motor activo cambiado a: ${activeEngine}`);
        });
    });

    // Control de carga de imagen con simulación de progreso visible
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
                
                progressText.textContent = '40%';

                // Aplicar pipeline con pausa visual para que la barra avance
                setTimeout(() => {
                    applyPipelineWithProgress(parseInt(umbralSlider.value));
                }, 150);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Control del umbral dinámico
    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) {
            applyAdvancedOpticalPipeline(parseInt(val));
        }
    });

    function applyPipelineWithProgress(thresholdValue) {
        if (!currentImage) return;

        const width = currentImage.width;
        const height = currentImage.height;
        const imgData = ctx.createImageData(width, height);
        const src = currentImage.data;
        const dst = imgData.data;
        
        const baseThreshold = (thresholdValue / 100) * 255;

        progressText.textContent = '70%';

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
        progressText.textContent = '100%';
        
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 200);
    }

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
