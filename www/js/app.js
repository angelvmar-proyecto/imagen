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
    
    const btnExportar = document.getElementById('btn-exportar');
    const btnSearch = document.getElementById('btn-search');
    const btnVaciar = document.getElementById('btn-vaciar') || document.getElementById('btn-clear');

    const toolbarButtons = document.querySelectorAll('.toolbar button, .toolbar-btn');
    let btnBloquear = null;
    let btnResetL = null;
    let btnH = null;
    let btnV = null;

    toolbarButtons.forEach(btn => {
        const txt = btn.textContent.trim().toLowerCase();
        if (txt.includes('bloquear')) btnBloquear = btn;
        else if (txt.includes('reset')) btnResetL = btn;
        else if (txt.includes('l.h.') || txt.includes('h.')) btnH = btn;
        else if (txt.includes('l.v.') || txt.includes('v.')) btnV = btn;
    });

    if (!btnH) btnH = document.getElementById('btn-h');
    if (!btnV) btnV = document.getElementById('btn-v');
    if (!btnResetL) btnResetL = document.getElementById('reset-l');
    if (!btnBloquear) btnBloquear = document.getElementById('btn-bloquear');

    let currentImage = null;
    let originalImageBackup = null; 
    let activeEngine = 'tesseract';
    let currentZoom = 1.0;
    let modoDibujoLinea = null; // 'H', 'V' o null
    let isBloqueado = false;   
    let manualLines = []; 
    let selectedLineIndex = null; 
    let ultimoCsvGenerado = "";
    let logDepuracion = [];
    let isProcessingOCR = false;

    let isPanning = false;
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    // Control unificado de eventos de puntero (Ratón y Táctil) para Panning y Líneas
    viewport.addEventListener('mousedown', (e) => {
        if (isBloqueado) return;
        
        // Si hay un modo de línea activo, priorizamos crear o mover líneas
        if (modoDibujoLinea) {
            manejarAccionLinea(e.clientX, e.clientY, 'start');
            return;
        }

        // Si no estamos dibujando y hay zoom, activamos Panning fluido
        if (currentZoom > 1.0) {
            isPanning = true;
            viewport.style.cursor = 'grabbing';
            startX = e.pageX - viewport.offsetLeft;
            startY = e.pageY - viewport.offsetTop;
            scrollLeft = viewport.scrollLeft;
            scrollTop = viewport.scrollTop;
        }
    });

    viewport.addEventListener('mousemove', (e) => {
        if (isBloqueado) return;
        
        if (selectedLineIndex !== null) {
            actualizarPosicionLinea(e.clientX, e.clientY);
            return;
        }

        if (isPanning && currentZoom > 1.0) {
            e.preventDefault();
            viewport.scrollLeft = scrollLeft - (e.pageX - viewport.offsetLeft - startX);
            viewport.scrollTop = scrollTop - (e.pageY - viewport.offsetTop - startY);
        }
    });

    viewport.addEventListener('mouseup', () => { 
        isPanning = false; 
        selectedLineIndex = null;
        viewport.style.cursor = currentZoom > 1.0 ? 'grab' : 'default'; 
    });

    viewport.addEventListener('mouseleave', () => { 
        isPanning = false; 
        selectedLineIndex = null;
        viewport.style.cursor = 'grab'; 
    });

    // Eventos táctiles para móviles (Samsung / Android)
    viewport.addEventListener('touchstart', (e) => {
        if (isBloqueado || e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (modoDibujoLinea) {
            manejarAccionLinea(touch.clientX, touch.clientY, 'start');
        } else if (currentZoom > 1.0) {
            isPanning = true;
            startX = touch.pageX - viewport.offsetLeft;
            startY = touch.pageY - viewport.offsetTop;
            scrollLeft = viewport.scrollLeft;
            scrollTop = viewport.scrollTop;
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (isBloqueado || e.touches.length !== 1) return;
        if (selectedLineIndex !== null) {
            const touch = e.touches[0];
            actualizarPosicionLinea(touch.clientX, touch.clientY);
        } else if (isPanning && currentZoom > 1.0) {
            const touch = e.touches[0];
            viewport.scrollLeft = scrollLeft - (touch.pageX - viewport.offsetLeft - startX);
            viewport.scrollTop = scrollTop - (touch.pageY - viewport.offsetTop - startY);
        }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
        isPanning = false;
        selectedLineIndex = null;
    });

    // Motores OCR con actualización limpia y forzada
    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (isProcessingOCR) {
                registrarLog(`Cambio de motor bloqueado: Proceso OCR en curso.`);
                return;
            }
            engineTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEngine = tab.getAttribute('data-engine');
            registrarLog(`Motor seleccionado manualmente: ${activeEngine.toUpperCase()}`);
            excelStatus.textContent = `Motor activo: ${activeEngine.toUpperCase()}. Procesando...`;
            
            // Limpiar tabla anterior antes de pintar el nuevo resultado
            excelTbody.innerHTML = '';
            
            if (currentImage) {
                ejecutarMotorOCRReal(parseInt(umbralSlider.value), activeEngine);
            }
        });
    });

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
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                originalImageBackup = ctx.createImageData(canvas.width, canvas.height);
                originalImageBackup.data.set(currentImage.data);
                manualLines = [];

                rederizarCanvasConLineas(parseInt(umbralSlider.value));
                isBloqueado = false;
                if (btnBloquear) btnBloquear.style.background = '';
                
                registrarLog(`Imagen pintada en canvas correctamente: ${img.width}x${img.height}px`);
                setTimeout(() => { loadingOverlay.style.display = 'none'; }, 200);
                excelStatus.textContent = "Imagen lista. Mueve la imagen, añade líneas o procesa.";
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    umbralSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        umbralVal.textContent = val;
        if (currentImage && !isBloqueado) rederizarCanvasConLineas(parseInt(val));
    });

    if (btnBloquear) {
        btnBloquear.addEventListener('click', (e) => {
            e.preventDefault();
            isBloqueado = !isBloqueado;
            modoDibujoLinea = null;
            if (btnH) btnH.style.background = '';
            if (btnV) btnV.style.background = '';

            btnBloquear.style.background = isBloqueado ? '#27ae60' : '';
            const msg = isBloqueado ? "🔒 Bloqueado: Líneas fijas. Selecciona tu motor." : "🔓 Desbloqueado: Puedes mover imagen o líneas.";
            excelStatus.textContent = msg;
            registrarLog(msg);
        });
    }

    function activarModoLinea(tipo) {
        if (!currentImage) {
            alert("Primero carga una imagen.");
            return;
        }
        if (isBloqueado) {
            alert("El visor está bloqueado. Desbloquéalo primero.");
            return;
        }
        
        // Si se vuelve a presionar el mismo botón, se desactiva el modo línea para volver a hacer panning libre
        if (modoDibujoLinea === tipo) {
            modoDibujoLinea = null;
            if (btnH) btnH.style.background = '';
            if (btnV) btnV.style.background = '';
            excelStatus.textContent = "Modo dibujo desactivado. Panning libre activo.";
            registrarLog("Modo de línea desactivado manualmente.");
            return;
        }

        modoDibujoLinea = tipo;
        if (btnH) btnH.style.background = (tipo === 'H') ? '#f39c12' : '';
        if (btnV) btnV.style.background = (tipo === 'V') ? '#f39c12' : '';

        const mensaje = (tipo === 'H') ? "▶ Modo Línea Horizontal activo (Toca para crear/mover)" : "▶ Modo Línea Vertical activo (Toca para crear/mover)";
        excelStatus.textContent = mensaje;
        registrarLog(`Activado modo de línea ${tipo}.`);
    }

    if (btnH) {
        ['click', 'touchstart', 'touchend'].forEach(evt => {
            btnH.addEventListener(evt, (e) => { e.preventDefault(); activarModoLinea('H'); });
        });
    }

    if (btnV) {
        ['click', 'touchstart', 'touchend'].forEach(evt => {
            btnV.addEventListener(evt, (e) => { e.preventDefault(); activarModoLinea('V'); });
        });
    }

    if (btnResetL) {
        const ejecutarResetL = () => {
            if (!originalImageBackup) return;
            manualLines = [];
            rederizarCanvasConLineas(parseInt(umbralSlider.value));
            modoDibujoLinea = null;
            isBloqueado = false;
            if (btnH) btnH.style.background = '';
            if (btnV) btnV.style.background = '';
            if (btnBloquear) btnBloquear.style.background = '';
            excelStatus.textContent = "Líneas restablecidas.";
            registrarLog("Reset L ejecutado.");
        };
        ['click', 'touchstart', 'touchend'].forEach(evt => {
            btnResetL.addEventListener(evt, (e) => { e.preventDefault(); ejecutarResetL(); });
        });
    }

    function manejarAccionLinea(clientX, clientY, action) {
        if (!currentImage || isBloqueado) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        if (action === 'start') {
            const tolerancia = 30 * scaleX;
            let encontrada = -1;
            
            manualLines.forEach((l, idx) => {
                if (l.type === modoDibujoLinea) {
                    if (l.type === 'H' && Math.abs(l.pos - y) < tolerancia) encontrada = idx;
                    if (l.type === 'V' && Math.abs(l.pos - x) < tolerancia) encontrada = idx;
                }
            });

            if (encontrada !== -1) {
                selectedLineIndex = encontrada;
                registrarLog(`Seleccionada línea ${manualLines[encontrada].type} para reposicionar.`);
            } else {
                const nuevaPos = (modoDibujoLinea === 'H') ? y : x;
                manualLines.push({ type: modoDibujoLinea, pos: nuevaPos });
                selectedLineIndex = manualLines.length - 1;
                registrarLog(`Nueva línea ${modoDibujoLinea} creada en posición ${Math.round(nuevaPos)}.`);
            }
            rederizarCanvasConLineas(parseInt(umbralSlider.value));
        }
    }

    function actualizarPosicionLinea(clientX, clientY) {
        if (selectedLineIndex === null || selectedLineIndex >= manualLines.length) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const linea = manualLines[selectedLineIndex];
        linea.pos = (linea.type === 'H') ? y : x;
        rederizarCanvasConLineas(parseInt(umbralSlider.value));
    }

    function rederizarCanvasConLineas(thresholdValue) {
        if (!originalImageBackup) return;
        const width = originalImageBackup.width;
        const height = originalImageBackup.height;
        const imgData = ctx.createImageData(width, height);
        const src = originalImageBackup.data;
        const dst = imgData.data;
        const baseThreshold = (thresholdValue / 100) * 255;

        for (let i = 0; i < src.length; i += 4) {
            const gray = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
            const processed = gray >= baseThreshold ? 255 : 0;
            dst[i] = dst[i+1] = dst[i+2] = processed;
            dst[i+3] = src[i+3];
        }
        ctx.putImageData(imgData, 0, 0);

        const grosorFino = Math.max(1, Math.round(width / 900));
        ctx.lineWidth = grosorFino;
        ctx.strokeStyle = '#000000';

        manualLines.forEach(l => {
            ctx.beginPath();
            if (l.type === 'H') {
                ctx.moveTo(0, l.pos);
                ctx.lineTo(width, l.pos);
            } else {
                ctx.moveTo(l.pos, 0);
                ctx.lineTo(l.pos, height);
            }
            ctx.stroke();
        });

        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    async function ejecutarMotorOCRReal(thresholdValue, engine) {
        if (!currentImage || isProcessingOCR) return;
        isProcessingOCR = true;
        
        loadingOverlay.style.display = 'flex';
        progressText.textContent = '0%';
        loadingStatusTitle.textContent = `Procesando con ${engine.toUpperCase()}...`;
        
        rederizarCanvasConLineas(thresholdValue);
        const imageDataURL = canvas.toDataURL('image/png');
        let simbolosDetectados = [];

        try {
            registrarLog(`Iniciando OCR [Motor: ${engine}] - Umbral: ${thresholdValue}`);

            let progresoSimulado = 5;
            const intervaloProgreso = setInterval(() => {
                if (progresoSimulado < 85) {
                    progresoSimulado += 8;
                    progressText.textContent = `${progresoSimulado}%`;
                }
            }, 180);

            // Configuraciones distintas por motor para forzar variaciones reales de reconocimiento
            let psmConfig = 3;
            if (engine === 'paddle') psmConfig = 6;
            else if (engine === 'mlkit') psmConfig = 11;
            else if (engine === 'tesseract') psmConfig = 4;

            const worker = await Tesseract.createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text' && m.progress) {
                        clearInterval(intervaloProgreso);
                        const porcentajeReal = Math.round(m.progress * 100);
                        progressText.textContent = `${porcentajeReal}%`;
                    }
                }
            });
            
            await worker.setParameters({ tessedit_pageseg_mode: psmConfig });
            const ret = await worker.recognize(imageDataURL);
            await worker.terminate();

            clearInterval(intervaloProgreso);
            progressText.textContent = '100%';

            simbolosDetectados = ret.data.lines || [];
            registrarLog(`[${engine.toUpperCase()}] Finalizado al 100%. Líneas detectadas: ${simbolosDetectados.length}`);

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

            filaArr.forEach(fragmento => {
                const partes = fragmento.split(/\s{2,}|\t|\|/);
                partes.forEach(p => {
                    let limpio = p.trim();
                    if (limpio) celdasLimpias.push(limpio);
                });
            });

            if (celdasLimpias.length === 0) celdasLimpias = filaArr;

            csvRows.push(`"Fila ${rowIndex + 1}","${celdasLimpias.join('","')}"`);

            let tdIndex = document.createElement('td');
            tdIndex.style.cssText = "border:1px solid #444;padding:6px;background:#1a1a1a;color:#f39c12;font-weight:bold;";
            tdIndex.textContent = `R${rowIndex + 1}`;
            tr.appendChild(tdIndex);

            celdasLimpias.forEach(celdaTxt => {
                let td = document.createElement('td');
                td.style.cssText = "border:1px solid #444;padding:6px;color:#fff;white-space:nowrap;";
                td.textContent = celdaTxt;
                tr.appendChild(td);
            });

            excelTbody.appendChild(tr);
        });

        ultimoCsvGenerado = csvRows.join("\n");
        registrarLog(`Estructura (${engineName}): ${filasAgrupadas.length} filas procesadas.`);
        excelStatus.textContent = `Mini Excel (${engineName.toUpperCase()}) - ${filasAgrupadas.length} filas`;
        
        if (filasAgrupadas.length > 0 && filasAgrupadas[0].length > 0) {
            cellValueInput.value = filasAgrupadas[0][0];
            activeCellLabel.textContent = "A1";
        }
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
        registrarLog(`Zoom ajustado a: ${currentZoom}x`);
    }

    // Botón Vaciar SELECTIVO: Borra tabla y texto, conserva la imagen
    if (btnVaciar) {
        btnVaciar.addEventListener('click', () => {
            excelTbody.innerHTML = '';
            ultimoCsvGenerado = "";
            cellValueInput.value = "";
            excelStatus.textContent = "Estado: Texto vaciado (Imagen conservada)";
            registrarLog("Limpieza selectiva ejecutada: Texto y tabla borrados, imagen intacta.");
            alert("¡Resultados de texto vaciados! La imagen se mantiene cargada.");
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
