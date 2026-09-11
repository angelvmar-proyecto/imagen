// --- MAR CARIBE - APP PROMOTORES (Versión Estable + Motores Híbridos Seguros) ---

let canvas, ctx;
let srcCanvas, srcCtx;
let loadedImg = new Image();
let isImageLoaded = false;

let linesH = [];
let linesV = [];
let isLocked = false;
let binThreshold = 128;
let worker = null;

// Zoom y Pan
let scale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('mainCanvas') || document.querySelector('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    srcCanvas = document.createElement('canvas');
    srcCtx = srcCanvas.getContext('2d');

    initEvents();
    resizeCanvasToDisplay();
});

function resizeCanvasToDisplay() {
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 16;
    canvas.height = 300;
    redraw();
}

function initEvents() {
    const fileInput = document.getElementById('imageInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                loadedImg.onload = function() {
                    srcCanvas.width = loadedImg.width;
                    srcCanvas.height = loadedImg.height;
                    srcCtx.drawImage(loadedImg, 0, 0);
                    isImageLoaded = true;
                    
                    // Inicializar retícula base adaptada a la imagen
                    linesH = [0, loadedImg.height * 0.3, loadedImg.height * 0.7, loadedImg.height];
                    linesV = [0, loadedImg.width * 0.5, loadedImg.width];
                    isLocked = false;
                    
                    resetZoom();
                    redraw();
                };
                loadedImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (canvas) {
        canvas.addEventListener('mousedown', startPan);
        canvas.addEventListener('mousemove', doPan);
        canvas.addEventListener('mouseup', endPan);
        canvas.addEventListener('mouseleave', endPan);

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startPan({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                doPan({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
            }
        });
        canvas.addEventListener('touchend', endPan);
    }
}

function resetZoom() {
    if (!isImageLoaded || !canvas) return;
    let hRatio = canvas.width / loadedImg.width;
    let vRatio = canvas.height / loadedImg.height;
    scale = Math.min(hRatio, vRatio);
    offsetX = (canvas.width - loadedImg.width * scale) / 2;
    offsetY = (canvas.height - loadedImg.height * scale) / 2;
}

function zoomIn() { scale *= 1.2; redraw(); }
function zoomOut() { scale /= 1.2; redraw(); }

function startPan(e) {
    if (!isImageLoaded) return;
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
}

function doPan(e) {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    redraw();
}

function endPan() {
    isDragging = false;
}

function redraw() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isImageLoaded) {
        ctx.fillStyle = '#9e9e9e';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Toca para cargar imagen", canvas.width / 2, canvas.height / 2);
        return;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(loadedImg, 0, 0);

    // Dibujar líneas H
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2 / scale;
    linesH.forEach(y => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(loadedImg.width, y);
        ctx.stroke();
    });

    // Dibujar líneas V
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2 / scale;
    linesV.forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, loadedImg.height);
        ctx.stroke();
    });

    ctx.restore();
}

function triggerLoad() {
    const fileInput = document.getElementById('imageInput');
    if (fileInput) fileInput.click();
}

function toggleLock() {
    isLocked = !isLocked;
    const btn = document.getElementById('lockBtn');
    if (btn) {
        btn.innerText = isLocked ? "Desbloquear" : "Bloquear";
        btn.style.background = isLocked ? "#4caf50" : "#d4af37";
    }
}

function clearAll() {
    isImageLoaded = false;
    linesH = [];
    linesV = [];
    isLocked = false;
    redraw();
}

function addHorizontalLine() {
    if (!isImageLoaded) return;
    let mid = loadedImg.height / 2;
    linesH.push(mid);
    linesH.sort((a, b) => a - b);
    redraw();
}

function addVerticalLine() {
    if (!isImageLoaded) return;
    let mid = loadedImg.width / 2;
    linesV.push(mid);
    linesV.sort((a, b) => a - b);
    redraw();
}

function updateThreshold(val) {
    binThreshold = parseInt(val);
    const lbl = document.getElementById('thresholdVal');
    if (lbl) lbl.innerText = binThreshold;
}

// DETECCIÓN DE INTERSECCIONES DE 90 GRADOS (AUTO)
function detectExcelGridCorners90() {
    if (!isImageLoaded) return;
    let w = loadedImg.width;
    let h = loadedImg.height;
    let imgData = srcCtx.getImageData(0, 0, w, h);
    let data = imgData.data;

    let bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let i = (y * w + x) * 4;
            let avg = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11);
            bin[y * w + x] = avg < 160 ? 1 : 0;
        }
    }

    let hLines = [];
    let minHLength = w * 0.3;
    for (let y = 5; y < h - 5; y += 2) {
        let count = 0;
        for (let x = 0; x < w; x++) count += bin[y * w + x];
        if (count >= minHLength) hLines.push(y);
    }

    let vLines = [];
    let minVLength = h * 0.3;
    for (let x = 5; x < w - 5; x += 2) {
        let count = 0;
        for (let y = 0; y < h; y++) count += bin[y * w + x];
        if (count >= minVLength) vLines.push(x);
    }

    let cleanH = [0];
    for (let y of hLines) {
        if (y - cleanH[cleanH.length - 1] > 15) cleanH.push(y);
    }
    cleanH.push(h);

    let cleanV = [0];
    for (let x of vLines) {
        if (x - cleanV[cleanV.length - 1] > 15) cleanV.push(x);
    }
    cleanV.push(w);

    if (cleanH.length > 2) linesH = cleanH;
    if (cleanV.length > 2) linesV = cleanV;
}

// MOTOR HÍBRIDO OPTIMIZADO CON CONCURRENCIA PARALELA
async function runEngine(engineName) {
    if (!isImageLoaded) { alert("Cargue imagen primero."); return; }
    
    const pContainer = document.getElementById('progressContainer');
    const pBar = document.getElementById('progressBar');
    const pText = document.getElementById('progressText');
    if(pContainer) pContainer.style.display = 'block';
    if(pBar) pBar.style.width = '0%';

    const startTime = performance.now();

    if (!isLocked) {
        detectExcelGridCorners90();
    }

    let sH = [...linesH].sort((a,b)=>a-b);
    let sV = [...linesV].sort((a,b)=>a-b);
    let totalCells = (sH.length - 1) * (sV.length - 1);
    if (totalCells <= 0) { if(pContainer) pContainer.style.display = 'none'; return; }

    if (engineName === 'tesseract' && !worker) {
        try {
            worker = await Tesseract.createWorker('spa+eng');
        } catch(e) {}
    }

    let matrixData = Array(sH.length - 1).fill(0).map(() => Array(sV.length - 1).fill(""));
    let cellTasks = [];
    let processed = 0;
    let candidateThresholds = [binThreshold, 200, 115];

    for (let r = 0; r < sH.length - 1; r++) {
        for (let c = 0; c < sV.length - 1; c++) {
            let margin = 3;
            let bx = sV[c] + margin;
            let by = sH[r] + margin;
            let bw = (sV[c+1] - sV[c]) - (margin * 2);
            let bh = (sH[r+1] - sH[r]) - (margin * 2);

            if (bw > 0 && bh > 0) {
                cellTasks.push({ r, c, bx, by, bw, bh });
            }
        }
    }

    const batchSize = 4;
    for (let i = 0; i < cellTasks.length; i += batchSize) {
        let batch = cellTasks.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (task) => {
            let bestText = "";
            let maxConfidence = -1;

            for (let th of candidateThresholds) {
                let tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.max(20, task.bw);
                tempCanvas.height = Math.max(20, task.bh);
                let tCtx = tempCanvas.getContext('2d');
                
                let subImgData = srcCtx.getImageData(task.bx, task.by, task.bw, task.bh);
                let data = subImgData.data;

                for (let idx = 0; idx < data.length; idx += 4) {
                    let avg = (data[idx] * 0.3 + data[idx+1] * 0.59 + data[idx+2] * 0.11);
                    let val = avg >= th ? 255 : 0;
                    data[idx] = val; data[idx+1] = val; data[idx+2] = val;
                }
                tCtx.putImageData(subImgData, 0, 0);

                try {
                    if (window.Tesseract && worker) {
                        let res = await worker.recognize(tempCanvas);
                        let txt = res.data.text.replace(/[\r\n]+/g, " ").trim();
                        let conf = res.data.confidence || 0;
                        if (conf > maxConfidence && txt.length > 0) {
                            maxConfidence = conf;
                            bestText = txt;
                            if (conf > 85) break;
                        }
                    } else {
                        bestText = "Simulado";
                    }
                } catch(e) {}
            }

            matrixData[task.r][task.c] = bestText;
            processed++;
            let pct = Math.round((processed / cellTasks.length) * 100);
            if(pBar) pBar.style.width = pct + '%';
        }));
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    if(pText) pText.innerText = `¡Completado en ${totalTime}s!`;

    buildExcelTable(matrixData);
    redraw();
    setTimeout(() => { if(pContainer) pContainer.style.display = 'none'; }, 800);
}

function buildExcelTable(data) {
    const container = document.getElementById('excelTableContainer') || document.getElementById('excelBody');
    if (!container) return;
    
    // Si es un tbody directamente o un contenedor general
    if (container.tagName === 'TBODY') {
        container.innerHTML = "";
        data.forEach((rowVals, rIdx) => {
            const tr = document.createElement('tr');
            let rowHTML = `<td style="padding:4px; border:1px solid #444; color:#888; background:#202020; font-weight:bold;">${rIdx + 1}</td>`;
            rowVals.forEach((val, cIdx) => {
                rowHTML += `<td contenteditable="true" class="excel-cell" style="padding:6px; border:1px solid #444; text-align:left; color:#fff;">${val}</td>`;
            });
            tr.innerHTML = rowHTML;
            container.appendChild(tr);
        });
    } else {
        let html = '<table border="1" style="width:100%; border-collapse:collapse; color:#fff; font-size:12px;">';
        data.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td style="padding:4px; border:1px solid #444;">${cell || ''}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        container.innerHTML = html;
    }
}

function exportStandardJson() {
    if (!isImageLoaded) { alert("No hay datos de líneas para exportar."); return; }
    let config = { linesH, linesV, width: loadedImg.width, height: loadedImg.height };
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config));
    let dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "grid_standard_config.json");
    dlAnchorElem.click();
}
