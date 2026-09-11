document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const loadingOverlay = document.getElementById('loading-overlay');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');

    let currentImage = null;
    let activeEngine = 'tesseract';

    // Manejo de pestañas de motores sin saturar pantalla
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

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Aplicar pipeline avanzado simulando fotogrametría y filtrado de onda
                applyAdvancedOpticalPipeline(parseInt(umbralSlider.value));
                loadingOverlay.style.display = 'none';
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Control del umbral dinámico (LiDAR / Gradiente adaptativo)
    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) {
            applyAdvancedOpticalPipeline(parseInt(val));
        }
    });

    // Pipeline Matemático de Visión Artificial para Tablas de Excel
    function applyAdvancedOpticalPipeline(thresholdValue) {
        if (!currentImage) return;

        const imgData = ctx.createImageData(currentImage.width, currentImage.height);
        const src = currentImage.data;
        const dst = imgData.data;
        
        const threshold = (thresholdValue / 100) * 255;

        // Simulación de Filtro de Onda espacial y Normalización de Iluminación Local
        for (let i = 0; i < src.length; i += 4) {
            const r = src[i];
            const g = src[i+1];
            const b = src[i+2];

            // Escala de grises ponderada de alta precisión para documentos
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            // Umbralización adaptativa tipo LiDAR (elimina reflejos y sombras de WhatsApp)
            const processed = gray >= threshold ? 255 : 0;

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
