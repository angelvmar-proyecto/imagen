const canvas = document.getElementById('workspaceCanvas');
const ctx = canvas.getContext('2d');
const srcCanvas = document.getElementById('sourceCanvas');
const srcCtx = srcCanvas.getContext('2d');

let loadedImg = new Image();
let originalImageBitmap = null;
let scale = 1, panX = 0, panY = 0;
let isLocked = false;
let linesH = [], linesV = [];
let activeLine = null, lineAxis = null;
let totalCols = 1;
let worker = null;
let binThreshold = 128;
let selectedCell = null;

let isDragging = false;
let startX = 0, startY = 0;

async function initTesseract() {
    try { worker = await Tesseract.createWorker('spa+eng'); } catch(e) {}
}
initTesseract();

document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        loadedImg.onload = function() {
            srcCanvas.width = loadedImg.width;
            srcCanvas.height = loadedImg.height;
            srcCtx.drawImage(loadedImg, 0, 0);
            
            autoDeskewAndCrop();
            originalImageBitmap = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

            document.getElementById('placeholderText').style.display = 'none';
            const box = document.getElementById('canvasBox');
            
            canvas.width = box.clientWidth;
            canvas.height = box.clientHeight;

            scale = Math.min(box.clientWidth / srcCanvas.width, box.clientHeight / srcCanvas.height) * 0.9;
            panX = (box.clientWidth - srcCanvas.width * scale) / 2;
            panY = (box.clientHeight - srcCanvas.height * scale) / 2;

            linesH = [0, srcCanvas.height * 0.3, srcCanvas.height * 0.7, srcCanvas.height];
            linesV = [0, srcCanvas.width * 0.5, srcCanvas.width];

            resizeCanvas();
            applyBinarization();
            redraw();
        }
        loadedImg.src = evt.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

function autoDeskewAndCrop() {
    let w = srcCanvas.width;
    let h = srcCanvas.height;
    let imgData = srcCtx.getImageData(0, 0, w, h);
    let data = imgData.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let threshold = 110;

    for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
            let i = (y * w + x) * 4;
            let brightness = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11);
            if (brightness > threshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    minX = Math.max(0, minX - 15);
    minY = Math.max(0, minY - 15);
    maxX = Math.min(w, maxX + 15);
    maxY = Math.min(h, maxY + 15);

    let cropW = maxX - minX;
    let cropH = maxY - minY;

    if (cropW > 150 && cropH > 150) {
        let tempC = document.createElement('canvas');
        tempC.width = cropW;
        tempC.height = cropH;
        let tempCtx = tempC.getContext('2d');
        tempCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

        srcCanvas.width = cropW;
        srcCanvas.height = cropH;
        srcCtx.drawImage(tempC, 0, 0);
        loadedImg.width = cropW;
        loadedImg.height = cropH;
    }
}

function resizeCanvas() {
    const box = document.getElementById('canvasBox');
    canvas.width = box.clientWidth;
    canvas.height = box.clientHeight;
    redraw();
}
window.addEventListener('resize', resizeCanvas);

function applyBinarization(customThreshold = binThreshold) {
    if (!originalImageBitmap) return;
    let imgData = srcCtx.createImageData(originalImageBitmap);
    let data = imgData.data;
    let origData = originalImageBitmap.data;
    let w_w = srcCanvas.width;
    let h_h = srcCanvas.height;

    for (let i = 0; i < origData.length; i++) data[i] = origData[i];

    let srcPix = new Uint8ClampedArray(data);
    let kernel = [ 0, -1,  0, -1,  5, -1,  0, -1,  0 ];

    for (let y = 1; y < h_h - 1; y++) {
        for (let x = 1; x < w_w - 1; x++) {
            let idx = (y * w_w + x) * 4;
            let rSum = 0, gSum = 0, bSum = 0, kIdx = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    let pIdx = ((y + ky) * w_w + (x + kx)) * 4;
                    let weight = kernel[kIdx++];
                    rSum += srcPix[pIdx] * weight;
                    gSum += srcPix[pIdx+1] * weight;
                    bSum += srcPix[pIdx+2] * weight;
                }
            }
            data[idx] = Math.min(255, Math.max(0, rSum));
            data[idx+1] = Math.min(255, Math.max(0, gSum));
            data[idx+2] = Math.min(255, Math.max(0, bSum));
        }
    }

    for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11);
        let val = avg >= customThreshold ? 255 : 0;
        data[i] = val; data[i+1] = val; data[i+2] = val; data[i+3] = origData[i+3];
    }
    srcCtx.putImageData(imgData, 0, 0);
}

document.getElementById('binThresholdSlider').addEventListener('input', (e) => {
    binThreshold = parseInt(e.target.value);
    document.getElementById('binThresholdVal').innerText = binThreshold;
    if (loadedImg.src) {
        applyBinarization();
        redraw();
    }
});

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!loadedImg.src) return;
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);
    ctx.drawImage(srcCanvas, 0, 0);

    ctx.lineWidth = Math.max(1, 2 / scale);
    ctx.strokeStyle = '#D4AF37';
    linesH.forEach((y) => { 
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(srcCanvas.width, y); ctx.stroke(); 
    });
    
    ctx.strokeStyle = '#2196F3';
    linesV.forEach((x) => { 
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, srcCanvas.height); ctx.stroke(); 
    });
    ctx.restore();
}

function changeZoom(factor) {
    if (!loadedImg.src) return;
    let oldScale = scale;
    scale *= factor;
    scale = Math.max(0.05, Math.min(30, scale));
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;
    panX = cx - (cx - panX) * (scale / oldScale);
    panY = cy - (cy - panY) * (scale / oldScale);
    redraw();
}

document.getElementById('zoomInBtn').addEventListener('click', () => changeZoom(1.25));
document.getElementById('zoomOutBtn').addEventListener('click', () => changeZoom(0.8));
document.getElementById('zoomResetBtn').addEventListener('click', () => {
    if (!loadedImg.src) return;
    scale = Math.min(canvas.width / srcCanvas.width, canvas.height / srcCanvas.height) * 0.9;
    panX = (canvas.width - srcCanvas.width * scale) / 2;
    panY = (canvas.height - srcCanvas.height * scale) / 2;
    redraw();
});

document.getElementById('addLineHBtn').addEventListener('click', () => {
    if (!loadedImg.src || isLocked) return;
    let centerY = (-panY + canvas.height / 2) / scale;
    centerY = Math.max(0, Math.min(srcCanvas.height, centerY));
    linesH.push(centerY);
    linesH.sort((a,b)=>a-b);
    redraw();
});

document.getElementById('addLineVBtn').addEventListener('click', () => {
    if (!loadedImg.src || isLocked) return;
    let centerX = (-panX + canvas.width / 2) / scale;
    centerX = Math.max(0, Math.min(srcCanvas.width, centerX));
    linesV.push(centerX);
    linesV.sort((a,b)=>a-b);
    redraw();
});

const box = document.getElementById('canvasBox');

box.addEventListener('pointerdown', (e) => {
    if (!loadedImg.src) return;
    const r = box.getBoundingClientRect();
    let mx = (e.clientX - r.left - panX) / scale;
    let my = (e.clientY - r.top - panY) / scale;

    if (!isLocked) {
        activeLine = null;
        lineAxis = null;
        for (let i = 0; i < linesH.length; i++) {
            if (Math.abs(my - linesH[i]) < 30 / scale) { activeLine = i; lineAxis = 'H'; break; }
        }
        if (activeLine === null) {
            for (let i = 0; i < linesV.length; i++) {
                if (Math.abs(mx - linesV[i]) < 30 / scale) { activeLine = i; lineAxis = 'V'; break; }
            }
        }
    }

    if (activeLine === null) {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    }
});

box.addEventListener('pointermove', (e) => {
    if (!loadedImg.src) return;
    const r = box.getBoundingClientRect();

    if (!isLocked && activeLine !== null) {
        if (lineAxis === 'H') {
            linesH[activeLine] = Math.max(0, Math.min(srcCanvas.height, (e.clientY - r.top - panY) / scale));
            linesH.sort((a, b) => a - b);
        } else if (lineAxis === 'V') {
            linesV[activeLine] = Math.max(0, Math.min(srcCanvas.width, (e.clientX - r.left - panX) / scale));
            linesV.sort((a, b) => a - b);
        }
        redraw();
    } else if (isDragging) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        redraw();
    }
});

window.addEventListener('pointerup', () => {
    activeLine = null;
    isDragging = false;
});

box.addEventListener('wheel', (e) => {
    if (!loadedImg.src) return;
    e.preventDefault();
    let oldScale = scale;
    if (e.deltaY < 0) { scale *= 1.15; } else { scale /= 1.15; }
    scale = Math.max(0.05, Math.min(30, scale));
    let cx = box.clientWidth / 2;
    let cy = box.clientHeight / 2;
    panX = cx - (cx - panX) * (scale / oldScale);
    panY = cy - (cy - panY) * (scale / oldScale);
    redraw();
}, { passive: false });

document.getElementById('lockBtn').addEventListener('click', () => {
    isLocked = !isLocked;
    const btn = document.getElementById('lockBtn');
    btn.innerText = isLocked ? "🔓 Desbloquear" : "🔒 Bloquear";
    btn.style.borderColor = isLocked ? "#4CAF50" : "#444";
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (isLocked || !loadedImg.src) return;
    linesH = [0, srcCanvas.height * 0.3, srcCanvas.height * 0.7, srcCanvas.height];
    linesV = [0, srcCanvas.width * 0.5, srcCanvas.width];
    scale = Math.min(box.clientWidth / srcCanvas.width, box.clientHeight / srcCanvas.height) * 0.9;
    panX = (box.clientWidth - srcCanvas.width * scale) / 2;
    panY = (box.clientHeight - srcCanvas.height * scale) / 2;
    redraw();
});

// Motores de Lectura (Todos restaurados y unificando saltos de línea en un solo renglón)
async function runEngine(engineName) {
    if (!loadedImg.src) { alert("Cargue imagen primero."); return; }
    const pContainer = document.getElementById('progressContainer');
    const pBar = document.getElementById('progressBar');
    const pText = document.getElementById('progressText');
    if(pContainer) pContainer.style.display = 'block';
    if(pBar) pBar.style.width = '0%';

    if (!isLocked) {
        detectExcelGridCorners90();
    }

    let sH = [...linesH].sort((a,b)=>a-b);
    let sV = [...linesV].sort((a,b)=>a-b);
    let totalCells = (sH.length - 1) * (sV.length - 1);
    if (totalCells <= 0) { if(pContainer) pContainer.style.display = 'none'; return; }

    if (engineName === 'tesseract' && !worker) {
        worker = await Tesseract.createWorker('spa+eng');
    }

    document.getElementById('excelBody').innerHTML = "";
    let processed = 0;
    let matrixData = [];

    for (let r = 0; r < sH.length - 1; r++) {
        let rowVals = [];
        for (let c = 0; c < sV.length - 1; c++) {
            let margin = 3;
            let bx = sV[c] + margin;
            let by = sH[r] + margin;
            let bw = (sV[c+1] - sV[c]) - (margin * 2);
            let bh = (sH[r+1] - sH[r]) - (margin * 2);

            let cellText = "";

            if (bw > 0 && bh > 0) {
                let tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.max(25, bw);
                tempCanvas.height = Math.max(25, bh);
                let tCtx = tempCanvas.getContext('2d');
                
                tCtx.drawImage(srcCanvas, bx, by, bw, bh, 0, 0, tempCanvas.width, tempCanvas.height);

                try {
                    if (engineName === 'tesseract' || engineName === 'paddle') {
                        let res = await worker.recognize(tempCanvas);
                        // Limpieza crucial: Reemplaza saltos de línea por un espacio para unificar en un solo renglón
                        cellText = res.data.text.replace(/[\r\n]+/g, " ").trim();
                    } else if (engineName === 'mlkit') {
                        // Motor local optimizado sin claves de API (Fallback inteligente multilínea en un renglón)
                        let res = await worker.recognize(tempCanvas);
                        cellText = res.data.text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
                    }
                } catch(e) {}
            }

            rowVals.push(cellText);
            processed++;
            let pct = Math.round((processed / totalCells) * 100);
            if(pBar) pBar.style.width = pct + '%';
            if(pText) pText.innerText = `${engineName.toUpperCase()} (${pct}%)`;
        }
        matrixData.push(rowVals);
    }
    
    buildExcelTable(matrixData);
    redraw();
    setTimeout(() => { if(pContainer) pContainer.style.display = 'none'; }, 400);
}

function detectExcelGridCorners90() {
    let w = srcCanvas.width;
    let h = srcCanvas.height;
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

document.getElementById('btnTess').addEventListener('click', () => runEngine('tesseract'));
document.getElementById('btnPaddle').addEventListener('click', () => runEngine('paddle'));
document.getElementById('btnMLKit').addEventListener('click', () => runEngine('mlkit'));

function getColumnLetter(colIndex) {
    let letter = '';
    let num = colIndex;
    while (num >= 0) {
        letter = String.fromCharCode((num % 26) + 65) + letter;
        num = Math.floor(num / 26) - 1;
    }
    return letter;
}

function buildExcelTable(dataMatrix) {
    const headerRow = document.getElementById('excelHeaderRow');
    const tbody = document.getElementById('excelBody');
    tbody.innerHTML = "";
    
    totalCols = dataMatrix.length > 0 ? dataMatrix[0].length : 1;

    let headerHTML = `<th class="th-num">#</th>`;
    for (let c = 0; c < totalCols; c++) {
        headerHTML += `<th class="th-col text-gold">${getColumnLetter(c)}</th>`;
    }
    headerHTML += `<th class="th-action">Acción</th>`;
    headerRow.innerHTML = headerHTML;

    dataMatrix.forEach((rowVals, rIdx) => {
        const tr = document.createElement('tr');
        let rowHTML = `<td class="td-num">${rIdx + 1}</td>`;
        
        rowVals.forEach((val, cIdx) => {
            rowHTML += `<td contenteditable="true" class="excel-cell" data-row="${rIdx}" data-col="${cIdx}">${val}</td>`;
        });
        
        rowHTML += `<td class="td-action"><button class="btn-danger-sm" onclick="this.closest('tr').remove(); updateExcelStatus();">×</button></td>`;
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });

    attachCellListeners();
    updateExcelStatus();
}

function attachCellListeners() {
    const cells = document.querySelectorAll('.excel-cell');
    const formulaBar = document.getElementById('formulaBar');
    const selectedLabel = document.getElementById('selectedCellLabel');

    cells.forEach(cell => {
        cell.addEventListener('focus', () => {
            selectedCell = cell;
            let r = parseInt(cell.getAttribute('data-row')) + 1;
            let c = parseInt(cell.getAttribute('data-col'));
            selectedLabel.innerText = `${getColumnLetter(c)}${r}`;
            formulaBar.value = cell.innerText;
        });

        cell.addEventListener('input', () => {
            if (selectedCell === cell) {
                formulaBar.value = cell.innerText;
            }
        });
    });

    formulaBar.oninput = function() {
        if (selectedCell) {
            selectedCell.innerText = formulaBar.value.replace(/[\r\n]+/g, " ");
        }
    };
}

function updateExcelStatus() {
    const rows = document.getElementById('excelBody').rows.length;
    document.getElementById('statusInfo').innerText = `Mini Excel - ${rows} filas, ${totalCols} columnas`;
}

document.getElementById('addRowBtn').addEventListener('click', () => {
    const tbody = document.getElementById('excelBody');
    const rIdx = tbody.rows.length;
    const tr = document.createElement('tr');
    let rowHTML = `<td class="td-num">${rIdx + 1}</td>`;
    
    for(let i=0; i<totalCols; i++) {
        rowHTML += `<td contenteditable="true" class="excel-cell" data-row="${rIdx}" data-col="${i}"></td>`;
    }
    rowHTML += `<td class="td-action"><button class="btn-danger-sm" onclick="this.closest('tr').remove(); updateExcelStatus();">×</button></td>`;
    tr.innerHTML = rowHTML;
    tbody.appendChild(tr);
    attachCellListeners();
    updateExcelStatus();
});

document.getElementById('addColBtn').addEventListener('click', () => {
    totalCols++;
    const hRow = document.getElementById('excelHeaderRow');
    const actTh = hRow.lastElementChild; actTh.remove();
    const th = document.createElement('th');
    th.className = "th-col text-gold";
    th.innerText = getColumnLetter(totalCols - 1);
    hRow.appendChild(th); hRow.appendChild(actTh);

    const rows = document.getElementById('excelBody').rows;
    for(let rIdx = 0; rIdx < rows.length; rIdx++) {
        let r = rows[rIdx];
        const actTd = r.lastElementChild; actTd.remove();
        const td = document.createElement('td');
        td.className = "excel-cell";
        td.contentEditable = "true";
        td.setAttribute('data-row', rIdx);
        td.setAttribute('data-col', totalCols - 1);
        r.appendChild(td); r.appendChild(actTd);
    }
    attachCellListeners();
    updateExcelStatus();
});

document.getElementById('clearTableBtn').addEventListener('click', () => {
    document.getElementById('excelBody').innerHTML = "";
    totalCols = 1;
    buildExcelTable([[""]]);
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    for(let r of document.getElementById('excelBody').rows) {
        r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    }
});

document.getElementById('exportBtn').addEventListener('click', () => {
    let out = "=== REPORTE MINI EXCEL UNIFICADO ===\n";
    const rows = document.getElementById('excelBody').rows;
    for(let r of rows) {
        if(r.style.display === 'none') continue;
        let cols = [];
        for(let i=1; i<r.cells.length-1; i++) cols.push(r.cells[i].innerText);
        out += cols.join(" | ") + "\n";
    }
    const win = window.open();
    win.document.write(`<pre style="background:#000;color:#0f0;padding:15px;font-size:14px;">${out}</pre>`);
});
