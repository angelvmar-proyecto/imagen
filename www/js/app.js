document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const canvas = document.getElementById('processing-canvas');
    const ctx = canvas.getContext('2d');
    const canvasScaler = document.getElementById('canvas-scaler');
    const viewport = document.getElementById('viewport');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    const loadingStatusTitle = document.getElementById('loading-status-title');
    const umbralSlider = document.getElementById('umbral-slider');
    const umbralVal = document.getElementById('umbral-val');
    const engineTabs = document.querySelectorAll('.engine-tab');
    const excelStatus = document.getElementById('excel-status');
    const cellValueInput = document.getElementById('cell-value-input');
    const activeCellLabel = document.getElementById('active-cell-label');
    const excelTbody = document.getElementById('excel-tbody');
    const btnH = document.getElementById('btn-h');
    const btnV = document.getElementById('btn-v');
    const btnExportar = document.getElementById('btn-exportar');
    const btnSearch = document.getElementById('btn-search');

    let currentImage = null;
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;
    let modoDibujoLinea = null;
    let ultimoCsvGenerado = "";
    let logDepuracion = [];

    let isPanning = false;
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    viewport.addEventListener('mousedown', (e) => {
        if (currentZoom <= 1.0) return;
        isPanning = true;
        viewport.style.cursor = 'grabbing';
        startX = e.pageX - viewport.offsetLeft;
        startY = e.pageY - viewport.offsetTop;
        scrollLeft = viewport.scrollLeft;
        scrollTop = viewport.scrollTop;
    });

    viewport.addEventListener('mouseleave', () => { isPanning = false; viewport.style.cursor = 'grab'; });
    viewport.addEventListener('mouseup', () => { isPanning = false; viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default'; });
    viewport.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        viewport.scrollLeft = scrollLeft - (e.pageX - viewport.offsetLeft - startX);
        viewport.scrollTop = scrollTop - (e.pageY - viewport.offsetTop - startY);
    });

    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            registrarLog(`Conmutando a motor: ${activeEngine.toUpperCase()}`);
            if (currentImage) ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
        });
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        loadingOverlay.style.display = 'flex';
        loadingStatusTitle.textContent = 'Cargando imagen base...';
        progressText.textContent = '10%';
        registrarLog(`Carga de imagen: ${file.name} (${file.size} bytes)`);

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                registrarLog(`Imagen cargada en canvas: ${img.width}x${img.height}px`);
                progressText.textContent = '30%';
                setTimeout(() => ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine), 100);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage) aplicarUmbralInstantaneo(parseInt(val));
    });

    btnH.addEventListener('click', () => { modoDibujoLinea = 'H'; excelStatus.textContent = "Toca el lienzo para línea horizontal negra"; });
    btnV.addEventListener('click', () => { modoDibujoLinea = 'V'; excelStatus.textContent = "Toca el lienzo para línea vertical negra"; });

    canvas.addEventListener('click', (e) => {
        if (!currentImage || !modoDibujoLinea) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (modoDibujoLinea === 'H') { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        else { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        ctx.stroke();

        registrarLog(`Línea manual aplicada [${modoDibujoLinea}] en X:${Math.round(x)}, Y:${Math.round(y)}`);
        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        modoDibujoLinea = null;
        ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
    });

    async function ejecutarMotorOCRReal(thresholdValue, engine) {
        if (!currentImage) return;
        loadingOverlay.style.display = 'flex';
        progressText.textContent = '0%';
        aplicarUmbralInstantaneo(thresholdValue);
        const imageDataURL = canvas.toDataURL('image/png');
        let simbolosDetectados = [];

        try {
            loadingStatusTitle.textContent = `Procesando con ${engine.toUpperCase()}...`;
            registrarLog(`Iniciando pipeline OCR [Motor: ${engine}] - Umbral: ${thresholdValue}`);

            // Simulación de progreso inicial para motores alternativos si el worker es rápido
            let progresoSimulado = 10;
            const intervaloProgreso = setInterval(() => {
                if (progresoSimulado < 85) {
                    progresoSimulado += 15;
                    progressText.textContent = `${progresoSimulado}%`;
                }
            }, 200);

            let psmConfig = engine === 'paddle' ? 6 : (engine === 'mlkit' ? 11 : 3);

            const worker = await Tesseract.createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text' && m.progress) {
                        clearInterval(intervaloProgreso);
                        progressText.textContent = `${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            await worker.setParameters({ tessedit_pageseg_mode: psmConfig });
            const ret = await worker.recognize(imageDataURL);
            await worker.terminate();

            clearInterval(intervaloProgreso);
            progressText.textContent = '100%';

            simbolosDetectados = ret.data.lines || [];
            registrarLog(`[${engine.toUpperCase()}] OCR Finalizado. Líneas detectadas: ${simbolosDetectados.length}`);

        } catch (err) {
            registrarLog(`ERROR CRITICO en motor ${engine}: ${err.message}`);
        }

        procesarMatrizYConstruirExcel(simbolosDetectados, engine);
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 350);
    }

    function procesarMatrizYConstruirExcel(lines, engineName) {
        let filasAgrupadas = [];
        let toleranciaY = 22; 
        let lineasOrdenadas = [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0);

        let filaActual = [];
        let ultimoY = -1;

        lineasOrdenadas.forEach(item => {
            let yCentro = (item.bbox.y0 + item.bbox.y1) / 2;
            let textoLimpio = item.text.trim().replace(/\s+/g, ' ');
            if (!textoLimpio) return;

            if (ultimoY === -1 || Math.abs(yCentro - ultimoY) <= toleranciaY) {
                filaActual.push({ text: textoLimpio, x0: item.bbox.x0 });
                ultimoY = (ultimoY + yCentro) / 2;
            } else {
                if (filaActual.length > 0) {
                    filaActual.sort((a, b) => a.x0 - b.x0);
                    filasAgrupadas.push(filaActual.map(el => el.text));
                }
                filaActual = [{ text: textoLimpio, x0: item.bbox.x0 }];
                ultimoY = yCentro;
            }
        });
        if (filaActual.length > 0) {
            filaActual.sort((a, b) => a.x0 - b.x0);
            filasAgrupadas.push(filaActual.map(el => el.text));
        }

        let csvRows = [];
        excelTbody.innerHTML = '';

        filasAgrupadas.slice(0, 150).forEach((filaArr, rowIndex) => {
            let tr = document.createElement('tr');
            let celdasLimpias = [];
            let bufferCelda = "";

            filaArr.forEach(fragmento => {
                if (fragmento.length < 15 && /^\d+[\s\)]*$/.test(fragmento)) {
                    if (bufferCelda) { celdasLimpias.push(bufferCelda.trim()); bufferCelda = ""; }
                    celdasLimpias.push(fragmento);
                } else {
                    bufferCelda += (bufferCelda ? " " : "") + fragmento;
                }
            });
            if (bufferCelda) celdasLimpias.push(bufferCelda.trim());
            if (celdasLimpias.length === 0) celdasLimpias = filaArr;

            csvRows.push(`"Fila ${rowIndex + 1}","${celdasLimpias.join('","')}"`);

            let td = document.createElement('td');
            td.style.border = "1px solid #444";
            td.style.padding = "6px";
            td.innerHTML = `<strong>R${rowIndex + 1}:</strong> ` + celdasLimpias.map(c => `<span>[${c}]</span>`).join(' | ');
            tr.appendChild(td);
            excelTbody.appendChild(tr);
        });

        ultimoCsvGenerado = csvRows.join("\n");
        registrarLog(`Estructura generada (${engineName}): ${filasAgrupadas.length} filas procesadas.`);
        excelStatus.textContent = `Mini Excel (${engineName}) - ${filasAgrupadas.length} filas mapeadas`;
        
        if (filasAgrupadas.length > 0 && filasAgrupadas[0].length > 0) {
            cellValueInput.value = filasAgrupadas[0][0];
            activeCellLabel.textContent = "A1";
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
            dst[i] = dst[i+1] = dst[i+2] = processed;
            dst[i+3] = src[i+3];
        }
        ctx.putImageData(imgData, 0, 0);
    }

    function registrarLog(mensaje) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
        const logEntry = `[${timestamp}] ${mensaje}`;
        logDepuracion.push(logEntry);
        console.log(logEntry);
    }

    document.getElementById('zoom-in').addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.25, 4.0); actualizarZoom(); });
    document.getElementById('zoom-out').addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.25, 0.5); actualizarZoom(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { currentZoom = 1.0; actualizarZoom(); });

    function actualizarZoom() {
        canvasScaler.style.transform = `scale(${currentZoom})`;
        viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
    }

    // Botón de Vaciar / Limpiar datos si existe en la interfaz
    const btnVaciar = document.getElementById('btn-vaciar') || document.getElementById('btn-clear');
    if (btnVaciar) {
        btnVaciar.addEventListener('click', () => {
            currentImage = null;
            excelTbody.innerHTML = '';
            ultimoCsvGenerado = "";
            cellValueInput.value = "";
            excelStatus.textContent = "Estado: Vacío";
            registrarLog("Limpieza de canvas y registros ejecutada.");
            alert("¡Datos vaciados correctamente!");
        });
    }

    btnSearch.addEventListener('click', () => {
        const contenidoVentana = "=== LOG DE DEPURACION ===\n" + logDepuracion.join("\n") + "\n\n=== CSV GENERADO ===\n" + ultimoCsvGenerado;
        
        let modal = document.getElementById('csv-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'csv-modal';
            modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;padding:15px;box-sizing:border-box;";
            modal.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h3 style="color:#f39c12;margin:0;font-size:16px;">📋 Log y CSV Generado</h3>
                    <button id="btn-cerrar-modal" style="background:#e74c3c;color:white;border:none;padding:5px 12px;border-radius:4px;font-weight:bold;">X Cerrar</button>
                </div>
                <textarea id="csv-textarea" style="flex:1;background:#111;color:#0ff;padding:10px;border:1px solid #444;font-family:monospace;font-size:12px;resize:none;border-radius:6px;"></textarea>
                <button id="btn-copiar-clipboard" style="background:#27ae60;color:white;border:none;padding:12px;border-radius:6px;margin-top:10px;font-weight:bold;font-size:14px;">📋 Copiar al Portapapeles</button>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-cerrar-modal').addEventListener('click', () => { modal.style.display = 'none'; });
            document.getElementById('btn-copiar-clipboard').addEventListener('click', () => {
                const ta = document.getElementById('csv-textarea');
                ta.select();
                navigator.clipboard.writeText(ta.value).then(() => {
                    alert("¡Copiado al portapapeles con éxito!");
                }).catch(() => {
                    alert("Selecciona el texto manualmente para copiarlo.");
                });
            });
        }
        
        document.getElementById('csv-textarea').value = contenidoVentana;
        modal.style.display = 'flex';
    });

    btnExportar.addEventListener('click', () => {
        btnSearch.click();
    });
});
