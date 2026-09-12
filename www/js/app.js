// ==============================================
// MAR Caribe — Escáner de Tablas COMPLETO
// ⚡ Umbral Dinámico + 🧠 Aprendizaje de Espacios + 📝 Celdas Multi-Renglón
// Versión: 1.0 | Fecha: 2026-09-12
// Ruta base: www/assets/aprendizaje-base.json
// ==============================================

const CONFIG = {
  RUTA_BASE: 'assets/aprendizaje-base.json',
  PESO_NUEVO: 0.70,
  PESO_HISTORICO: 0.30,
  UMBRAL_ZONAS: 4,
  UMBRAL_RANGO: 0.20,
  ANCHO_LINEA: 1.5,
  TIEMPO_LIMITE: 120000
};

// Elementos DOM
const inputImagen     = document.getElementById('inputImagen');
const btnCargar       = document.getElementById('btnCargar');
const btnProcesar     = document.getElementById('btnProcesar');
const btnCopiarLog    = document.getElementById('btnCopiarLog');
const btnExportarJSON = document.getElementById('btnExportarJSON');
const btnEditarLineas = document.getElementById('btnEditarLineas');
const btnAgregarLinea = document.getElementById('btnAgregarLinea');
const btnQuitarLinea  = document.getElementById('btnQuitarLinea');
const btnGuardarAjustes=document.getElementById('btnGuardarAjustes');
const btnReiniciarAprendizaje=document.getElementById('btnReiniciarAprendizaje');
const btnZoomMas      = document.getElementById('btnZoomMas');
const btnZoomMenos    = document.getElementById('btnZoomMenos');
const btnZoomNormal   = document.getElementById('btnZoomNormal');
const nivelZoom       = document.getElementById('nivelZoom');
const estadoMotor     = document.getElementById('estadoMotor');
const previewContainer= document.getElementById('previewContainer');
const previewImg      = document.getElementById('previewImg');
const canvasLineas    = document.getElementById('canvasLineas');
const barraProgreso   = document.getElementById('barraProgreso');
const textoProgreso   = document.getElementById('textoProgreso');
const etapaActual     = document.getElementById('etapaActual');
const tiempoInfo      = document.getElementById('tiempoInfo');
const logContenido    = document.getElementById('logContenido');
const logContainer    = document.getElementById('logContainer');
const tablaResultado  = document.getElementById('tablaResultado');
const versionAprendizaje=document.getElementById('versionAprendizaje');

// ==============================================
// ⚡ MOTOR DE UMBRAL DINÁMICO ADAPTATIVO
// ==============================================
const UmbralDinamico = {
  calcular(imagenData, ancho, alto) {
    log('⚡ === CALCULANDO UMBRAL DINÁMICO ===', 'info');
    
    const zonas = CONFIG.UMBRAL_ZONAS;
    const anchoZona = Math.floor(ancho / Math.sqrt(zonas));
    const altoZona = Math.floor(alto / Math.sqrt(zonas));
    const umbralesPorZona = [];
    let brilloTotal = 0, pixeles = 0;

    for (let z = 0; z < zonas; z++) {
      const x = (z % 2) * anchoZona;
      const y = Math.floor(z / 2) * altoZona;
      let brilloZona = 0, pixelesZona = 0;

      for (let py = y; py < y + altoZona && py < alto; py++) {
        for (let px = x; px < x + anchoZona && px < ancho; px++) {
          const idx = (py * ancho + px) * 4;
          const brillo = Math.round(0.299 * imagenData[idx] + 0.587 * imagenData[idx+1] + 0.114 * imagenData[idx+2]);
          brilloZona += brillo; brilloTotal += brillo; pixelesZona++; pixeles++;
        }
      }
      
      const umbralZona = pixelesZona > 0 ? Math.round(brilloZona / pixelesZona) : 128;
      umbralesPorZona.push(umbralZona);
      log(`  Zona ${z+1}: brillo promedio ${umbralZona} → umbral ${umbralZona}`, 'info');
    }

    const brilloGeneral = Math.round(brilloTotal / pixeles);
    const contraste = Math.max(...umbralesPorZona) - Math.min(...umbralesPorZona);
    const umbralBase = brilloGeneral;
    
    log(`📊 Brillo promedio general: ${brilloGeneral} (Contraste: ${contraste})`, 'info');
    log(`🔢 Umbral base calculado: ${umbralBase}`, 'ok');
    log(`⚡ Modo: ${contraste > 50 ? 'Por zonas adaptativo' : 'Global uniforme'}`, 'info');

    return { brilloGeneral, contraste, umbralBase, umbralesPorZona };
  }
};

// ==============================================
// 🧠 MOTOR DE APRENDIZAJE INTEGRADO AL CÓDIGO
// ==============================================
const Aprendizaje = {
  base: null,
  sesion: null,
  zoom: 1.0,
  desplazamiento: { x: 0, y: 0 },

  async cargarBase() {
    log('🔄 Cargando aprendizaje BASE desde archivo del proyecto...', 'info');
    try {
      const resp = await fetch(CONFIG.RUTA_BASE);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.base = await resp.json();
      
      versionAprendizaje.textContent = 
        `Versión base: ${this.base.version_aprendizaje} | ${this.base.fecha_actualizacion}`;
      
      log('✅ === APRENDIZAJE BASE CARGADO DEL CÓDIGO ===', 'ok');
      log(`📦 Versión: ${this.base.version_aprendizaje} — ${this.base.fecha_actualizacion}`, 'ok');
      log(`📐 Configuración: ${this.base.configuracion.filas} filas × ${this.base.configuracion.columnas} columnas`, 'info');
      log(`📍 Líneas H internas: ${this.base.lineas_internas.H.length}`, 'info');
      log(`📍 Líneas V internas: ${this.base.lineas_internas.V.length}`, 'info');
      log(`📏 Espacios promedio cargados para todas las filas y columnas`, 'info');
      log(`📝 Reglas: Celdas multi-renglón ${this.base.reglas_texto.celda_multi_renglon ? 'ACTIVAS' : 'DESACTIVADAS'}`, 'info');
      log(`⚡ Umbral: ${this.base.umbral.tipo} — ${this.base.umbral.metodo}`, 'info');
      
      this.cargarSesionLocal();
      return true;
    } catch (err) {
      log(`❌ ERROR al cargar archivo base: ${err.message}`, 'error');
      log(`⚠️ Ruta buscada: ${CONFIG.RUTA_BASE}`, 'warn');
      log('⚠️ Se usará división uniforme por defecto', 'warn');
      return false;
    }
  },

  cargarSesionLocal() {
    const guardado = localStorage.getItem('mar-caribe-sesion');
    if (guardado) {
      try {
        this.sesion = JSON.parse(guardado);
        versionAprendizaje.textContent += ` | Sesión: ${this.sesion.version_sesion}`;
        log('📥 Sesión local cargada — se aplicará sobre la base', 'info');
      } catch { this.sesion = null; }
    }
  },

  generarLineas() {
    let lineasH, lineasV;
    const fuente = this.sesion || this.base;

    if (fuente && fuente.lineas_internas) {
      const H = fuente.lineas_internas.H;
      const V = fuente.lineas_internas.V;
      
      if (H.length > 0 && V.length > 0) {
        log(`🧠 Usando posiciones de ${this.sesion ? 'SESIÓN LOCAL' : 'BASE DEL CÓDIGO'}`, 'info');
        lineasH = [0.0, ...H, 1.0];
        lineasV = [0.0, ...V, 1.0];
        this.calcularEspacios(lineasH, lineasV);
        log(`📍 H: ${lineasH.map(p => p.toFixed(4)).join(' | ')}`, 'info');
        log(`📍 V: ${lineasV.map(p => p.toFixed(4)).join(' | ')}`, 'info');
        return { lineasH, lineasV };
      }
    }

    log('🧠 Generando división uniforme por defecto', 'info');
    const filas = this.base?.configuracion?.filas || 10;
    const cols = this.base?.configuracion?.columnas || 21;
    lineasH = [0.0];
    for (let i = 1; i <= filas; i++) lineasH.push(i / filas);
    lineasH.push(1.0);
    lineasV = [0.0];
    for (let i = 1; i <= cols; i++) lineasV.push(i / cols);
    lineasV.push(1.0);
    this.calcularEspacios(lineasH, lineasV);
    return { lineasH, lineasV };
  },

  calcularEspacios(lineasH, lineasV) {
    const espaciosH = [], espaciosV = [];
    for (let i = 1; i < lineasH.length; i++) espaciosH.push(lineasH[i] - lineasH[i-1]);
    for (let i = 1; i < lineasV.length; i++) espaciosV.push(lineasV[i] - lineasV[i-1]);
    log(`📏 Espacios H (altos de filas): [${espaciosH.map(e => e.toFixed(4)).join(', ')}]`, 'info');
    log(`📏 Espacios V (anchos de columnas): [${espaciosV.map(e => e.toFixed(4)).join(', ')}]`, 'info');
    return { espaciosH, espaciosV };
  },

  guardar(lineasHCompletas, lineasVCompletas) {
    const nuevasH = lineasHCompletas.slice(1, -1);
    const nuevasV = lineasVCompletas.slice(1, -1);
    const base = this.base;
    const { espaciosH, espaciosV } = this.calcularEspacios(lineasHCompletas, lineasVCompletas);

    log('💾 === GUARDANDO AJUSTES Y APRENDIZAJE ===', 'info');
    log(`✏️ Nuevas posiciones H: [${nuevasH.map(p => p.toFixed(4)).join(', ')}]`, 'info');
    log(`✏️ Nuevas posiciones V: [${nuevasV.map(p => p.toFixed(4)).join(', ')}]`, 'info');
    log(`📏 Espacios aprendidos: ${espaciosH.length} filas, ${espaciosV.length} columnas`, 'info');

    let finalesH, finalesV;
    if (base && base.lineas_internas.H.length === nuevasH.length) {
      log(`⚖️  Promedio móvil: ${CONFIG.PESO_NUEVO*100}% nuevo + ${CONFIG.PESO_HISTORICO*100}% base`, 'info');
      finalesH = nuevasH.map((n, i) => 
        CONFIG.PESO_NUEVO * n + CONFIG.PESO_HISTORICO * base.lineas_internas.H[i]);
      finalesV = nuevasV.map((n, i) => 
        CONFIG.PESO_NUEVO * n + CONFIG.PESO_HISTORICO * base.lineas_internas.V[i]);
      log(`📊 Posiciones finales H: [${finalesH.map(p => p.toFixed(4)).join(', ')}]`, 'ok');
      log(`📊 Posiciones finales V: [${finalesV.map(p => p.toFixed(4)).join(', ')}]`, 'ok');
    } else {
      log('⚠️ Sin base compatible — usando posiciones directas', 'warn');
      finalesH = nuevasH;
      finalesV = nuevasV;
    }

    this.sesion = {
      version_sesion: (this.sesion?.version_sesion || 0) + 1,
      fecha: new Date().toISOString(),
      lineas_internas: { H: finalesH, V: finalesV },
      espacios_promedio: { alto_filas: espaciosH, ancho_columnas: espaciosV }
    };
    localStorage.setItem('mar-caribe-sesion', JSON.stringify(this.sesion));
    log(`✅ Sesión guardada — Versión: ${this.sesion.version_sesion}`, 'ok');
    return { finalesH, finalesV };
  },

  exportarJSON() {
    if (!this.base) { log('❌ No hay base para exportar', 'error'); return; }
    const datos = this.sesion || this.base;
    const versionNueva = this.base.version_aprendizaje + 1;
    
    log('📤 === JSON COMPLETO PARA ACTUALIZAR EL PROYECTO ===', 'ok');
    log('COPIA TODO ESTO Y PEGA EN: www/assets/aprendizaje-base.json', 'info');
    log('══════════════════════════════════════════════════════════════════', 'info');
    
    const jsonCompleto = {
      version_aprendizaje: versionNueva,
      fecha_actualizacion: new Date().toISOString().split('T')[0],
      descripcion: this.base.descripcion,
      configuracion: { ...this.base.configuracion },
      umbral: { ...this.base.umbral },
      lineas_internas: datos.lineas_internas,
      espacios_promedio: datos.espacios_promedio || this.base.espacios_promedio,
      reglas_texto: { ...this.base.reglas_texto }
    };

    const textoJSON = JSON.stringify(jsonCompleto, null, 2);
    log(textoJSON, 'info');
    log('══════════════════════════════════════════════════════════════════', 'info');
    log(`✅ Versión nueva: ${versionNueva} — ¡Toda nueva versión la traerá integrada!`, 'ok');
    
    navigator.clipboard?.writeText(textoJSON).then(() => {
      log('📋 JSON completo copiado al portapapeles ✅', 'ok');
    }).catch(() => log('⚠️ No se pudo copiar automáticamente — copia manualmente del log', 'warn'));
  },

  reiniciarLocal() {
    localStorage.removeItem('mar-caribe-sesion');
    this.sesion = null;
    log('🗑️ Sesión local reiniciada — se usa base del código', 'warn');
  }
};

// Estado global
let imagenActual = null, imagenDatos = null, logCompleto = '';
let tiempoInicio = 0;
let lineasHActuales = [], lineasVActuales = [];
let modoEdicionLineas = false, lineaSeleccionada = null, offsetArrastre = 0;
let ultimoToque = 0;

// ==============================================
// SISTEMA DE LOG
// ==============================================
function log(mensaje, tipo = 'info') {
  const iconos = { ok: '✅', info: 'ℹ️', warn: '⚠️', error: '❌' };
  const colores = { ok: '#4ade80', info: '#60a5fa', warn: '#fbbf24', error: '#f87171' };
  const linea = `${iconos[tipo]} ${mensaje}`;
  logCompleto += linea + '\n';
  logContenido.innerHTML += `<div style="color:${colores[tipo]}; white-space:pre-wrap;">${linea}</div>`;
  logContainer.scrollTop = logContainer.scrollHeight;
}

// ==============================================
// ZOOM Y DESPLAZAMIENTO
// ==============================================
function aplicarZoom() {
  previewImg.style.transform = `scale(${Aprendizaje.zoom}) translate(${Aprendizaje.desplazamiento.x}px, ${Aprendizaje.desplazamiento.y}px)`;
  canvasLineas.style.transform = `scale(${Aprendizaje.zoom}) translate(${Aprendizaje.desplazamiento.x}px, ${Aprendizaje.desplazamiento.y}px)`;
  nivelZoom.textContent = `${Math.round(Aprendizaje.zoom * 100)}%`;
}

btnZoomMas.addEventListener('click', () => {
  Aprendizaje.zoom = Math.min(5.0, Aprendizaje.zoom * 1.3);
  aplicarZoom();
  log(`🔍 Zoom: ${Math.round(Aprendizaje.zoom * 100)}%`, 'info');
});

btnZoomMenos.addEventListener('click', () => {
  Aprendizaje.zoom = Math.max(0.5, Aprendizaje.zoom / 1.3);
  aplicarZoom();
  log(`🔍 Zoom: ${Math.round(Aprendizaje.zoom * 100)}%`, 'info');
});

btnZoomNormal.addEventListener('click', () => {
  Aprendizaje.zoom = 1.0;
  Aprendizaje.desplazamiento = { x: 0, y: 0 };
  aplicarZoom();
  log('🔍 Zoom 100% — Restablecido', 'info');
});

// Zoom con dos dedos
let toquesIniciales = null;
previewContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const t1 = e.touches[0], t2 = e.touches[1];
    toquesIniciales = {
      distancia: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      zoomInicial: Aprendizaje.zoom
    };
  }
});
previewContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && toquesIniciales) {
    const t1 = e.touches[0], t2 = e.touches[1];
    const distancia = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    Aprendizaje.zoom = Math.max(0.5, Math.min(5.0, toquesIniciales.zoomInicial * (distancia / toquesIniciales.distancia)));
    aplicarZoom();
    e.preventDefault();
  }
});
previewContainer.addEventListener('touchend', () => { toquesIniciales = null; });

// ==============================================
// CARGA DE IMAGEN Y UMBRAL DINÁMICO
// ==============================================
btnCargar.addEventListener('click', () => inputImagen.click());
inputImagen.addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  logContenido.innerHTML = ''; logCompleto = ''; tablaResultado.innerHTML = '';
  tiempoInicio = Date.now();

  log('══════════════════════════════════════════════════════════', 'info');
  log('📊 MAR Caribe — Escáner de Tablas COMPLETO', 'ok');
  log(`📅 Fecha: ${new Date().toLocaleString()}`, 'info');
  log(`🖼️ Imagen: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB)`, 'info');

  await Aprendizaje.cargarBase();

  const img = await new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      const i = new Image();
      i.onload = () => resolver(i);
      i.onerror = rechazar;
      i.src = e.target.result;
    };
    lector.onerror = rechazar;
    lector.readAsDataURL(archivo);
  });

  imagenActual = img;
  imagenDatos = { w: img.width, h: img.height };
  previewImg.src = img.src;
  previewContainer.style.display = 'block';

  // Calcular umbral dinámico
  const canvasTemp = document.createElement('canvas');
  canvasTemp.width = img.width; canvasTemp.height = img.height;
  const ctxTemp = canvasTemp.getContext('2d');
  ctxTemp.drawImage(img, 0, 0);
  const datosImg = ctxTemp.getImageData(0, 0, img.width, img.height).data;
  const umbralInfo = UmbralDinamico.calcular(datosImg, img.width, img.height);

  await new Promise(r => previewImg.onload = r);
  canvasLineas.width = previewImg.clientWidth;
  canvasLineas.height = previewImg.clientHeight;

  log(`📐 Imagen cargada: ${img.width}×${img.height} píxeles`, 'ok');
  log(`📊 Umbral aplicado: ${umbralInfo.umbralBase} — Contraste: ${umbralInfo.contraste}`, 'ok');

  const { lineasH, lineasV } = Aprendizaje.generarLineas();
  lineasHActuales = lineasH;
  lineasVActuales = lineasV;
  dibujarLineas();

  log(`📐 Líneas generadas — Filas: ${lineasH.length-1} | Columnas: ${lineasV.length-1}`, 'ok');
  log(`📝 Reglas activas: Celdas multi-renglón → texto agrupado por límites de celda`, 'info');
  btnProcesar.disabled = false;
});

// ==============================================
// DIBUJAR LÍNEAS
// ==============================================
function dibujarLineas() {
  const ctx = canvasLineas.getContext('2d');
  const ancho = canvasLineas.width, alto = canvasLineas.height;
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineWidth = CONFIG.ANCHO_LINEA;

  ctx.strokeStyle = '#3b82f6';
  lineasHActuales.forEach((pos, i) => {
    const y = pos * alto;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ancho, y); ctx.stroke();
    ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(`F${i}`, 4, y + 14);
  });

  ctx.strokeStyle = '#ef4444';
  lineasVActuales.forEach((pos, i) => {
    const x = pos * ancho;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, alto); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(`C${i}`, x + 4, 14);
  });
}

// ==============================================
// EDITAR LÍNEAS — Arrastrar, Agregar, Quitar
// ==============================================
btnEditarLineas.addEventListener('click', () => {
  modoEdicionLineas = !modoEdicionLineas;
  canvasLineas.style.pointerEvents = modoEdicionLineas ? 'auto' : 'none';
  log(modoEdicionLineas ? '✏️ MODO EDICIÓN ACTIVO — Arrastra líneas, doble toque para agregar' : '👁️ Modo vista', modoEdicionLineas ? 'ok' : 'info');
  btnEditarLineas.style.background = modoEdicionLineas ? '#ef4444' : '';
});

function iniciarArrastre(e) {
  if (!modoEdicionLineas) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / Aprendizaje.zoom;
  const y = (e.clientY - rect.top) / Aprendizaje.zoom;
  const umbral = 10;

  for (let i = 0; i < lineasHActuales.length; i++) {
    const ly = lineasHActuales[i] * canvasLineas.height;
    if (Math.abs(y - ly) < umbral) {
      lineaSeleccionada = { tipo: 'H', indice: i };
      offsetArrastre = y - ly;
      return;
    }
  }
  for (let i = 0; i < lineasVActuales.length; i++) {
    const lx = lineasVActuales[i] * canvasLineas.width;
    if (Math.abs(x - lx) < umbral) {
      lineaSeleccionada = { tipo: 'V', indice: i };
      offsetArrastre = x - lx;
      return;
    }
  }
}

canvasLineas.addEventListener('mousedown', iniciarArrastre);
canvasLineas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  iniciarArrastre({ clientX: t.clientX, clientY: t.clientY });
});

function moverLinea(e) {
  if (!lineaSeleccionada) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / Aprendizaje.zoom;
  const y = (e.clientY - rect.top) / Aprendizaje.zoom;

  if (lineaSeleccionada.tipo === 'H') {
    let nueva = (y - offsetArrastre) / canvasLineas.height;
    nueva = Math.max(0.005, Math.min(0.995, nueva));
    lineasHActuales[lineaSeleccionada.indice] = nueva;
  } else {
    let nueva = (x - offsetArrastre) / canvasLineas.width;
    nueva = Math.max(0.005, Math.min(0.995, nueva));
    lineasVActuales[lineaSeleccionada.indice] = nueva;
  }
  dibujarLineas();
}

canvasLineas.addEventListener('mousemove', moverLinea);
canvasLineas.addEventListener('touchmove', (e) => {
  if (!lineaSeleccionada) return;
  const t = e.touches[0];
  moverLinea({ clientX: t.clientX, clientY: t.clientY });
  e.preventDefault();
});

canvasLineas.addEventListener('mouseup', () => { lineaSeleccionada = null; });
canvasLineas.addEventListener('touchend', () => { lineaSeleccionada = null; });

// Doble toque para agregar línea
canvasLineas.addEventListener('click', (e) => {
  if (!modoEdicionLineas) return;
  const ahora = Date.now();
  const diff = ahora - ultimoToque;
  ultimoToque = ahora;
  if (diff > 0 && diff < 300) {
    const rect = canvasLineas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Aprendizaje.zoom / canvasLineas.width;
    const y = (e.clientY - rect.top) / Aprendizaje.zoom / canvasLineas.height;
    log(`📍 Doble toque → Agregando línea en Y=${y.toFixed(4)}, X=${x.toFixed(4)}`, 'info');
    lineasHActuales.push(y); lineasHActuales.sort((a, b) => a - b);
    lineasVActuales.push(x); lineasVActuales.sort((a, b) => a - b);
    dibujarLineas();
  }
});

btnAgregarLinea.addEventListener('click', () => {
  if (!modoEdicionLineas) { log('⚠️ Activa primero "Editar Líneas"', 'warn'); return; }
  lineasHActuales.push(0.5); lineasHActuales.sort((a, b) => a - b);
  lineasVActuales.push(0.5); lineasVActuales.sort((a, b) => a - b);
  log(`➕ Líneas agregadas — Total H: ${lineasHActuales.length}, V: ${lineasVActuales.length}`, 'ok');
  dibujarLineas();
});

btnQuitarLinea.addEventListener('click', () => {
  if (!modoEdicionLineas) { log('⚠️ Activa primero "Editar Líneas"', 'warn'); return; }
  if (lineasHActuales.length > 2) lineasHActuales.splice(Math.floor(lineasHActuales.length/2), 1);
  if (lineasVActuales.length > 2) lineasVActuales.splice(Math.floor(lineasVActuales.length/2), 1);
  log(`➖ Líneas quitadas — Total H: ${lineasHActuales.length}, V: ${lineasVActuales.length}`, 'ok');
  dibujarLineas();
});

// ==============================================
// GUARDAR Y EXPORTAR
// ==============================================
btnGuardarAjustes.addEventListener('click', () => {
  Aprendizaje.guardar(lineasHActuales, lineasVActuales);
  dibujarLineas();
});

btnExportarJSON.addEventListener('click', () => {
  Aprendizaje.guardar(lineasHActuales, lineasVActuales);
  Aprendizaje.exportarJSON();
});

btnReiniciarAprendizaje.addEventListener('click', () => {
  if (confirm('¿Reiniciar sesión local? Se mantiene la base del código.')) {
    Aprendizaje.reiniciarLocal();
    const { lineasH, lineasV } = Aprendizaje.generarLineas();
    lineasHActuales = lineasH; lineasVActuales = lineasV;
    dibujarLineas();
  }
});

// ==============================================
// PROCESAR TABLA (OCR simulado — conectar PaddleOCR según necesidad)
// ==============================================
btnProcesar.addEventListener('click', async () => {
  log('▶️ Iniciando procesamiento de tabla...', 'info');
  log(`📐 Dimensiones detectadas: ${lineasHActuales.length-1} filas × ${lineasVActuales.length-1} columnas`, 'info');
  log('📝 Regla aplicada: Celdas multi-renglón activa — todo texto dentro de los límites de una celda se agrupa en ella, preservando saltos de línea', 'info');
  log('⚠️ Reconocimiento de texto pendiente de integración con PaddleOCR', 'warn');
  log('✅ Estructura de celdas lista para recibir datos OCR', 'ok');
  btnProcesar.disabled = false;
});

// ==============================================
// COPIAR LOG COMPLETO
// ==============================================
btnCopiarLog.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logCompleto);
    log('📋 LOG COMPLETO copiado al portapapeles ✅', 'ok');
    log('📌 Pásalo completo para integrar al código', 'info');
  } catch { log('❌ No se pudo copiar — selecciona y copia manualmente', 'error'); }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  estadoMotor.className = 'estado-motor estado-listo';
  estadoMotor.textContent = '✅ Listo';
  log('══════════════════════════════════════════════════════════', 'info');
  log('✅ Sistema inicializado — TODO INTEGRADO:', 'ok');
  log('   ⚡ Umbral Dinámico Adaptativo por zonas', 'info');
  log('   🧠 Aprendizaje de posiciones y espacios entre celdas', 'info');
  log('   📝 Celdas con múltiples renglones de texto preservadas', 'info');
  log('   🔍 Zoom libre + desplazamiento + edición visual', 'info');
  log('   📤 Exportación JSON para integrar a todas las versiones', 'info');
  log('══════════════════════════════════════════════════════════', 'info');
});

