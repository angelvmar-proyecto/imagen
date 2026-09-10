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
            originalImageBitmap = srcCtx.getImageData(0, 0, loadedImg.width, loadedImg.height);

            document.getElementById('placeholderText').style.display = 'none';
            const box = document.getElementById('canvasBox');
            
            canvas.width = box.clientWidth;
            canvas.height = box.clientHeight;

            scale = Math.min(box.clientWidth / loadedImg.width, box.clientHeight / loadedImg.height) * 0.9;
            panX = (box.clientWidth - loadedImg.width * scale) / 2;
            panY = (box.clientHeight - loadedImg.height * scale) / 2;

            linesH = [0, loadedImg.height * 0.3, loadedImg.height * 0.7, loadedImg.height];
            linesV = [0, loadedImg.width * 0.5, loadedImg.width];

            resizeCanvas();
            applyBinarization();
            redraw();
        }
        loadedImg.src = evt.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

function resizeCanvas() {
    const box = document.getElementById('canvasBox');
    canvas.width = box.clientWidth;
    canvas.height = box.clientHeight;
    redraw();
}
window.addEventListener('resize', resizeCanvas);

function applyBinarization() {
    if (!originalImageBitmap) return;
    let imgData = srcCtx.createImageData(originalImageBitmap);
    let data = imgData.data;
    let origData = originalImageBitmap.data;
    for (let i = 0; i < origData.length; i += 4) {
        let avg = (origData[i] * 0.3 + origData[i+1] * 0.59 + origData[i+2] * 0.11);
        let val = avg >= binThreshold ? 255 : 0;
        data[i] = val;
        data[i+1] = val;
        data[i+2] = val;
        data[i+3] = origData[i+3];
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
    linesH.forEach((y, idx) => { 
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(loadedImg.width, y); ctx.stroke(); 
    });
    
    ctx.strokeStyle = '#2196F3';
    linesV.forEach((x, idx) => { 
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, loadedImg.height); ctx.stroke(); 
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
    scale = Math.min(canvas.width / loadedImg.width, canvas.height / loadedImg.height) * 0.9;
    panX = (canvas.width - loadedImg.width * scale) / 2;
    panY = (canvas.height - loadedImg.height * scale) / 2;
    redraw();
});

// Agregar línea justo en el centro de la vista visible actual del usuario
document.getElementById('addLineHBtn').addEventListener('click', () => {
    if (!loadedImg.src || isLocked) return;
    let centerY = (-panY + canvas.height / 2) / scale;
    centerY = Math.max(0, Math.min(loadedImg.height, centerY));
    linesH.push(centerY);
    linesH.sort((a,b)=>a-b);
    redraw();
});

document.getElementById('addLineVBtn').addEventListener('click', () => {
    if (!loadedImg.src || isLocked) return;
    let centerX = (-panX + canvas.width / 2) / scale;
    centerX = Math.max(0, Math.min(loadedImg.width, centerX));
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
            linesH[activeLine] = Math.max(0, Math.min(loadedImg.height, (e.clientY - r.top - panY) / scale));
            linesH.sort((a, b) => a - b);
        } else if (lineAxis === 'V') {
            linesV[activeLine] = Math.max(0, Math.min(loadedImg.width, (e.clientX - r.left - panX) / scale));
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
    linesH = [0, loadedImg.height * 0.3, loadedImg.height * 0.7, loadedImg.height];
    linesV = [0, loadedImg.width * 0.5, loadedImg.width];
    scale = Math.min(box.clientWidth / loadedImg.width, box.clientHeight / loadedImg.height) * 0.9;
    panX = (box.clientWidth - loadedImg.width * scale) / 2;
    panY = (box.clientHeight - loadedImg.height * scale) / 2;
    redraw();
});

async function runEngine(engineName) {
    if (!loadedImg.src) { alert("Cargue imagen primero."); return; }
    const pContainer = document.getElementById('progressContainer');
    const pBar = document.getElementById('progressBar');
    const pText = document.getElementById('progressText');
    if(pContainer) pContainer.style.display = 'block';
    if(pBar) pBar.style.width = '0%';

    let sH = [...linesH].sort((a,b)=>a-b);
    let sV = [...linesV].sort((a,b)=>a-b);
    let totalCells = (sH.length - 1) * (sV.length - 1);
    if (totalCells <= 0) { if(pContainer) pContainer.style.display = 'none'; return; }

    if (engineName === 'tesseract' && !worker) {
        worker = await Tesseract.createWorker('spa+eng');
    }

    document.getElementById('tableBody').innerHTML = "";
    let processed = 0;

    for (let r = 0; r < sH.length - 1; r++) {
        let rowVals = [];
        for (let c = 0; c < sV.length - 1; c++) {
            let bx = sV[c], by = sH[r], bw = sV[c+1] - bx, bh = sH[r+1] - by;
            let cCanvas = document.createElement('canvas');
            cCanvas.width = Math.max(20, bw); cCanvas.height = Math.max(20, bh);
            let cCtx = cCanvas.getContext('2d');
            cCtx.drawImage(srcCanvas, bx, by, bw, bh, 0, 0, cCanvas.width, cCanvas.height);

            let txt = "";
            try {
                let res = await worker.recognize(cCanvas);
                txt = res.data.text.replace(/[\r\n]+/g, " ").trim();
            } catch(e) { txt = ""; }

            rowVals.push(txt);
            processed++;
            let pct = Math.round((processed / totalCells) * 100);
            if(pBar) pBar.style.width = pct + '%';
            if(pText) pText.innerText = `${engineName.toUpperCase()} (${pct}%)`;
        }
        appendRow(rowVals);
    }
    setTimeout(() => { if(pContainer) pContainer.style.display = 'none'; }, 400);
}

document.getElementById('btnTess').addEventListener('click', () => runEngine('tesseract'));
document.getElementById('btnML').addEventListener('click', () => runEngine('mlkit'));
document.getElementById('btnPaddle').addEventListener('click', () => runEngine('paddle'));

function appendRow(values) {
    const tb = document.getElementById('tableBody');
    const tr = document.createElement('tr');
    values.forEach(v => {
        const td = document.createElement('td');
        td.contentEditable = "true";
        td.innerText = v;
        tr.appendChild(td);
    });
    const act = document.createElement('td');
    act.innerHTML = `<button class="btn-danger-sm" onclick="this.closest('tr').remove()">×</button>`;
    tr.appendChild(act);
    tb.appendChild(tr);
}

document.getElementById('addRowBtn').addEventListener('click', () => {
    const tr = document.createElement('tr');
    for(let i=0; i<totalCols; i++) {
        const td = document.createElement('td');
        td.contentEditable = "true";
        tr.appendChild(td);
    }
    const act = document.createElement('td');
    act.innerHTML = `<button class="btn-danger-sm" onclick="this.closest('tr').remove()">×</button>`;
    tr.appendChild(act);
    document.getElementById('tableBody').appendChild(tr);
});

document.getElementById('addColBtn').addEventListener('click', () => {
    totalCols++;
    const hRow = document.getElementById('tableHeaderRow');
    const actTh = hRow.lastElementChild; actTh.remove();
    const th = document.createElement('th');
    th.innerText = `Columna ${totalCols}`;
    hRow.appendChild(th); hRow.appendChild(actTh);

    const rows = document.getElementById('tableBody').rows;
    for(let r of rows) {
        const actTd = r.lastElementChild; actTd.remove();
        const td = document.createElement('td');
        td.contentEditable = "true";
        r.appendChild(td); r.appendChild(actTd);
    }
});

document.getElementById('clearTableBtn').addEventListener('click', () => {
    document.getElementById('tableBody').innerHTML = "";
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    for(let r of document.getElementById('tableBody').rows) {
        r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    }
});

document.getElementById('exportParamsBtn')?.addEventListener('click', () => {
    let config = {
        imageWidth: loadedImg.width,
        imageHeight: loadedImg.height,
        linesH: linesH,
        linesV: linesV
    };
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    let dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "estand_parametros_lineas.json");
    dlAnchorElem.click();
});

document.getElementById('exportBtn').addEventListener('click', () => {
    let out = "=== REPORTE OCR ===\n";
    for(let r of document.getElementById('tableBody').rows) {
        let cols = [];
        for(let i=0; i<r.cells.length-1; i++) cols.push(r.cells[i].innerText);
        out += cols.join(" | ") + "\n";
    }
    const win = window.open();
    win.document.write(`<pre style="background:#000;color:#0f0;padding:10px;">${out}</pre>`);
});
