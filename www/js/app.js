// MOTOR HÍBRIDO OPTIMIZADO PARA MÁXIMA VELOCIDAD (Concurrencia Paralela y Filtro de Vacíos)
async function runEngine(engineName) {
    if (!loadedImg.src) { alert("Cargue imagen primero."); return; }
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
        worker = await Tesseract.createWorker('spa+eng');
    }

    let matrixData = Array(sH.length - 1).fill(0).(() => Array(sV.length - 1).fill(""));
    let cellTasks = [];
    let processed = 0;

    let candidateThresholds = [binThreshold, 200, 115]; // Priorizamos el umbral base primero para ahorrar ciclos

    // 1. Preparamos todas las tareas de celdas
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

    // 2. Procesamiento optimizado por lotes (Batch processing) en paralelo
    const batchSize = 4; // Procesar 4 celdas simultáneamente para saturar la CPU móvil sin congelar la UI
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

                // Binarización directa optimizada (sin kernel pesado si el contraste de WhatsApp es estándar)
                for (let idx = 0; idx < data.length; idx += 4) {
                    let avg = (data[idx] * 0.3 + data[idx+1] * 0.59 + data[idx+2] * 0.11);
                    let val = avg >= th ? 255 : 0;
                    data[idx] = val; data[idx+1] = val; data[idx+2] = val;
                }
                tCtx.putImageData(subImgData, 0, 0);

                try {
                    let res = await worker.recognize(tempCanvas);
                    let txt = res.data.text.replace(/[\r\n]+/g, " ").trim();
                    let conf = res.data.confidence || 0;

                    if (task.c === 0 && /\d/.test(txt)) conf += 20;

                    if (conf > maxConfidence && txt.length > 0) {
                        maxConfidence = conf;
                        bestText = txt;
                        if (conf > 85) break; // Si la confianza es alta, nos ahorramos probar los demás umbrales
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

