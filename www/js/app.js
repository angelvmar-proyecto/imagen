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
    
    // Selectores flexibles para los botones de la barra superior
    const btnH = document.getElementById('btn-h') || document.querySelector('[data-action="line-h"]') || document.querySelectorAll('.toolbar-btn')[2];
    const btnV = document.getElementById('btn-v') || document.querySelector('[data-action="line-v"]') || document.querySelectorAll('.toolbar-btn')[3];
    const btnResetL = document.getElementById('reset-l') || document.querySelectorAll('.toolbar-btn')[1];
    const btnBloquear = document.getElementById('bloquear') || document.querySelectorAll('.toolbar-btn')[0];
    
    const btnExportar = document.getElementById('btn-exportar');
    const btnSearch = document.getElementById('btn-search');
    const btnVaciar = document.getElementById('btn-vaciar') || document.getElementById('btn-clear');

    let currentImage = null;
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;
    let modoDibujoLinea = null; // 'H' o 'V'
    let ultimoCsvGenerado = "";
    let logDepuracion = [];
    let isProcessingOCR = false;

    let isPanning = false;
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    // Control de Panning / Desplazamiento táctil y de mouse en el viewport
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

    // Conmutación de motores OCR
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (isProcessingOCR) {
                registrarLog(`Cambio de motor bloqueado: Proceso OCR en curso.`);
                return;
            }
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            registrarLog(`Motor seleccionado: ${activeEngine.toUpperCase()}`);
            excelStatus.textContent = `Motor activo: ${activeEngine.toUpperCase()}`;
            if (currentImage) ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
        });
    });

    // Carga de imagen y renderizado inmediato en el canvas para evitar pantalla en negro
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        loadingOverlay.style.display = 'flex';
        loadingStatusTitle.textContent = 'Cargando imagen...';
        progressText.textContent = '100%';
        registrarLog(`Carga de imagen: ${file.name} (${file.size} bytes)`);

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Ajustar dimensiones del canvas físico a la imagen real
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Guardar respaldo de imagen original procesada con umbral
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                aplicarUmbralInstantaneo(parseInt(umbralSlider.value));
                
                registrarLog(`Imagen pintada en canvas correctamente: ${img.width}x${img.height}px`);
                setTimeout(() => { loadingOverlay.style.display = 'none'; }, 200);
                excelStatus.textContent = "Imagen lista. Elige motor o dibuja líneas.";
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

    // Activación de herramientas de líneas manuales
    if (btnH) {
        btnH.addEventListener('click', () => { 
            modoDibujoLinea = 'H'; 
            excelStatus.textContent = "Modo activo: Toca el cuadro de imagen para trazar línea horizontal"; 
            registrarLog("Activado modo de línea horizontal manual.");
        });
    }
    if (btnV) {
        btnV.addEventListener('click', () => { 
            modoDibujoLinea = 'V'; 
            excelStatus.textContent = "Modo activo: Toca el cuadro de imagen para trazar línea vertical"; 
            registrarLog("Activado modo de línea vertical manual.");
        });
    }

    // Mapeo preciso de coordenadas de clic en la pantalla visible (considerando Zoom y Scroll del Viewport)
    canvas.addEventListener('click', (e) => {
        if (!currentImage) {
            alert("Primero debes cargar una imagen.");
            return;
        }
        if (!modoDibujoLinea) {
            excelStatus.textContent = "Selecciona L.H. o L.V. antes de tocar la imagen.";
            return;
        }

        const rect = canvas.getBoundingClientRect();
        // Coordenadas relativas exactas al canvas escalado y desplazado
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Dibujar línea negra permanente sobre el canvas
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.beginPath();
        if (modoDibujoLinea === 'H') { 
            ctx.moveTo(0, y); 
            ctx.lineTo(canvas.width, y); 
        } else { 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x, canvas.height); 
        }
        ctx.stroke();

        registrarLog(`Línea manual [${modoDibujoLinea}] trazada en coordenadas X:${Math.round(x)}, Y:${Math.round(y)}`);
        
        // Actualizar datos de imagen con la línea incorporada
        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tipoLinea = modoDibujoLinea;
        modoDibujoLinea = null;
        
        excelStatus.textContent = `Línea ${tipoLinea} aplicada. Procesando con ${activeEngine}...`;
        ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
    });

    async function ejecutarMotorOCRReal(thresholdValue, engine) {
        if (!currentImage || isProcessingOCR) return;
        isProcessingOCR = true;
        
        loadingOverlay.style.display = 'flex';
        progressText.textContent = '0%';
        aplicarUmbralInstantaneo(thresholdValue);
        const imageDataURL = canvas.toDataURL('image/png');
        let simbolosDetectados = [];

        try {
            loadingStatusTitle.textContent = `Procesando con ${engine.toUpperCase()}...`;
            registrarLog(`Iniciando OCR [Motor: ${engine}] - Umbral: ${thresholdValue}`);

            let progresoSimulado = 5;
            const intervaloProgreso = setInterval(() => {
                if (progresoSimulado < 90) {
                    progresoSimulado += 10;
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
            registrarLog(`[${engine.toUpperCase()}] Finalizado. Líneas detectadas: ${simbolosDetectados.length}`);

        } catch (err) {
            registrarLog(`ERROR en motor ${engine}: ${err.message}`);
        } finally {
            isProcessingOCR = false;
        }

        procesarMatrizYConstruirExcel(simbolosDetectados, engine);
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
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
        registrarLog(`Estructura (${engineName}): ${filasAgrupadas.length} filas.`);
        excelStatus.textContent = `Mini Excel (${engineName}) - ${filasAgrupadas.length} filas`;
        
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

    // Controles de Zoom
    document.getElementById('zoom-in').addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.25, 4.0); actualizarZoom(); });
    document.getElementById('zoom-out').addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.25, 0.5); actualizarZoom(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { currentZoom = 1.0; actualizarZoom(); });

    function actualizarZoom() {
        canvasScaler.style.transform = `scale(${currentZoom})`;
        viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default';
        registrarLog(`Zoom ajustado a: ${currentZoom}x`);
    }

    // Botón de Vaciar / Limpiar datos
    if (btnVaciar) {
        btnVaciar.addEventListener('click', () => {
            currentImage = null;
            excelTbody.innerHTML = '';
            ultimoCsvGenerado = "";
            cellValueInput.value = "";
            excelStatus.textContent = "Estado: Vacío";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            registrarLog("Limpieza general ejecutada.");
            alert("¡Datos vaciados correctamente!");
        });
    }

    // Modal de Logs y CSV
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
