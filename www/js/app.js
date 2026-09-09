const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");

let img = new Image();
let imageLoaded = false;

// Estado de Zoom y Paneo
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

// Estado de Líneas de la Tabla (coordenadas relativas 0 a 1)
let hLines = [0.2, 0.4, 0.6, 0.8]; // Filas
let vLines = [0.3, 0.6];           // Columnas
let activeLine = null;
let lineType = null; // 'h' o 'v'

function resizeCanvas() {
    const container = document.getElementById("viewer-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}

window.addEventListener("resize", resizeCanvas);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (imageLoaded) {
        ctx.drawImage(img, 0, 0);
    } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffd700";
        ctx.font = "16px sans-serif";
        ctx.fillText("Toca 'Cargar Imagen WhatsApp'", 50, 100);
    }

    // Dibujar líneas horizontales (Filas)
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2 / scale;
    hLines.forEach((yPos, index) => {
        const y = yPos * (img.height || canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(img.width || canvas.width, y);
        ctx.stroke();
    });

    // Dibujar líneas verticales (Columnas)
    ctx.strokeStyle = "#ff00ff";
    vLines.forEach((xPos, index) => {
        const x = xPos * (img.width || canvas.width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, img.height || canvas.height);
        ctx.stroke();
    });

    ctx.restore();
}

// Manejo de Cargar Imagen
document.getElementById("btnLoadImage").addEventListener("click", () => {
    document.getElementById("imageInput").click();
});

document.getElementById("imageInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            img.onload = () => {
                imageLoaded = true;
                scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                offsetX = (canvas.width - img.width * scale) / 2;
                offsetY = (canvas.height - img.height * scale) / 2;
                draw();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Controles de Líneas
document.getElementById("btnAddHLine").addEventListener("click", () => {
    hLines.push(0.5);
    draw();
});

document.getElementById("btnAddVLine").addEventListener("click", () => {
    vLines.push(0.5);
    draw();
});

document.getElementById("btnClearLines").addEventListener("click", () => {
    hLines = [];
    vLines = [];
    draw();
});

// Gestos de Zoom y Movimiento (Pinch / Paneo / Arrastre de líneas)
canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    offsetX += dx;
    offsetY += dy;
    startX = e.clientX;
    startY = e.clientY;
    draw();
});

canvas.addEventListener("pointerup", () => {
    isDragging = false;
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
        scale *= zoomFactor;
    } else {
        scale /= zoomFactor;
    }
    draw();
}, { passive: false });

document.addEventListener("DOMContentLoaded", () => {
    resizeCanvas();
    
    const yoloSlider = document.getElementById("yoloConf");
    const yoloVal = document.getElementById("yoloConfVal");
    const ocrSlider = document.getElementById("ocrThresh");
    const ocrVal = document.getElementById("ocrThreshVal");
    const btnExportLog = document.getElementById("btnExportLog");

    yoloSlider.addEventListener("input", (e) => {
        yoloVal.textContent = e.target.value;
    });

    ocrSlider.addEventListener("input", (e) => {
        ocrVal.textContent = e.target.value;
    });

    btnExportLog.addEventListener("click", () => {
        const logContent = `--- LOG ESTÁNDAR DE INFERENCIA ---\nFecha: ${new Date().toISOString()}\nYOLOv11 Conf: ${yoloSlider.value}\nPaddleOCR Thresh: ${ocrSlider.value}\nFilas activas: ${hLines.length}\nColumnas activas: ${vLines.length}\nEstado: Operando localmente sin internet.\n`;
        const blob = new Blob([logContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inference_log_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
