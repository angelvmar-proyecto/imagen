// ==============================================
// MAR Caribe — Escáner de Tablas + APRENDIZAJE INTEGRADO AL CÓDIGO
// Versión: 1.0 | Fecha: 2026-09-12
// Configuración: 10 filas × 21 columnas | Sin encabezados
// Ruta base: www/assets/aprendizaje-base.json
// ==============================================

const CONFIG = {
  FILAS: 10,
  COLUMNAS: 21,
  RUTA_BASE: 'assets/aprendizaje-base.json',
  PESO_NUEVO: 0.70,
  PESO_HISTORICO: 0.30,
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
// 🧠 MOTOR DE APRENDIZAJE — CARGA DESDE ARCHIVO BASE
// ==============================================
const Aprendizaje = {
  base: null,       // Datos cargados desde aprendizaje-base.json (integrado al código)
  sesion: null,     // Ajustes hechos en esta sesión (localStorage temporal)
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
      log(`⚖️  Promedio móvil: ${this.base.promedio_movil.peso_nuevo*100}% nuevo / ${this.base.promedio_movil.peso_historico*100}% histórico`, 'info');
      
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
      } catch {
        this.sesion = null;
      }
    }
  },

  generarLineas() {
    const totalH = CONFIG.FILAS + 1;
    const totalV = CONFIG.COLUMNAS + 1;
    let lineasH, lineasV;

    // Usar sesión local si existe, si no usar base del código
    const fuente = this.sesion || this.base;

    if (fuente && fuente.lineas_internas) {
      const H = fuente.lineas_internas.H;
      const V = fuente.lineas_internas.V;
      
      if (H.length === CONFIG.FILAS - 1 && V.length === CONFIG.COLUMNAS - 1) {
        log(`🧠 Usando posiciones de ${this.sesion ? 'SESIÓN LOCAL' : 'BASE DEL CÓDIGO'}`, 'info');
        lineasH = [0.0, ...H, 1.0];
        lineasV = [0.0, ...V, 1.0];
        log(`📍 H: ${lineasH.map(p => p.toFixed(4)).join(' | ')}`, 'info');
        log(`📍 V: ${lineasV.map(p => p.toFixed(4)).join(' | ')}`, 'info');
        return { lineasH, lineasV };
      }
    }

    // División uniforme si no hay datos
    log('🧠 Generando división uniforme por defecto', 'info');
    lineasH = [0.0];
    for (let i = 1; i <= CONFIG.FILAS; i++) lineasH.push(i / CONFIG.FILAS);
    lineasH.push(1.0);
    lineasV = [0.0];
    for (let i = 1; i <= CONFIG.COLUMNAS; i++) lineasV.push(i / CONFIG.COLUMNAS);
    lineasV.push(1.0);
    return { lineasH, lineasV };
  },

  // GUARDAR: calcular promedio y guardar en sesión local + mostrar JSON para exportar
  guardar(lineasHCompletas, lineasVCompletas) {
    const nuevasH = lineasHCompletas.slice(1, -1);
    const nuevasV = lineasVCompletas.slice(1, -1);
    const base = this.base;

    log('💾 === GUARDANDO AJUSTES ===', 'info');
    log(`✏️ Nuevas posiciones H: [${nuevasH.map(p => p.toFixed(4)).join(', ')}]`, 'info');
    log(`✏️ Nuevas posiciones V: [${nuevasV.map(p => p.toFixed(4)).join(', ')}]`, 'info');

    // Aplicar promedio móvil
    let finalesH, finalesV;
    if (base && base.lineas_internas.H.length === nuevasH.length) {
      log(`⚖️  Aplicando promedio: ${CONFIG.PESO_NUEVO*100}% nuevo + ${CONFIG.PESO_HISTORICO*100}% base`, 'info');
      finalesH = nuevasH.map((n, i) => 
        CONFIG.PESO_NUEVO * n + CONFIG.PESO_HISTORICO * base.lineas_internas.H[i]);
      finalesV = nuevasV.map((n, i) => 
        CONFIG.PESO_NUEVO * n + CONFIG.PESO_HISTORICO * base.lineas_internas.V[i]);
      log(`📊 Resultado H: [${finalesH.map(p => p.toFixed(4)).join(', ')}]`, 'ok');
      log(`📊 Resultado V: [${finalesV.map(p => p.toFixed(4)).join(', ')}]`, 'ok');
    } else {
      log('⚠️ Sin base compatible — usando posiciones directas', 'warn');
      finalesH = nuevasH;
      finalesV = nuevasV;
    }

    // Guardar sesión local
    this.sesion = {
      version_sesion: (this.sesion?.version_sesion || 0) + 1,
      fecha: new Date().toISOString(),
      lineas_internas: { H: finalesH, V: finalesV }
    };
    localStorage.setItem('mar-caribe-sesion', JSON.stringify(this.sesion));

    log(`✅ Sesión guardada — Versión: ${this.sesion.version_sesion}`, 'ok');
    return { finalesH, finalesV };
  },

  // 📤 EXPORTAR JSON LISTO PARA PEGAR EN EL PROYECTO
  exportarJSON() {
    if (!this.base) { log('❌ No hay base para exportar', 'error'); return; }
    
    const datos = this.sesion || this.base;
    const versionNueva = this.base.version_aprendizaje + 1;
    
    const jsonCompleto = {
      version_aprendizaje: versionNueva,
      fecha_actualizacion: new Date().toISOString().split('T')[0],
      descripcion: this.base.descripcion,
      configuracion: this.base.configuracion,
      lineas_internas: datos.lineas_internas,
      promedio_movil: this.base.promedio_movil
    };

    const textoJSON = JSON.stringify(jsonCompleto, null, 2);
    log('📤 === JSON PARA ACTUALIZAR EL PROYECTO ===', 'ok');
    log('COPIA Y PEGA ESTO EN: www/assets/aprendizaje-base.json', 'info');
    log('```', 'info');
    log(textoJSON, 'info');
    log('```', 'info');
    log(`✅ Versión nueva: ${versionNueva} — ¡Toda nueva versión la traerá integrada!`, 'ok');
    
    navigator.clipboard?.writeText(textoJSON).then(() => {
      log('📋 JSON copiado al portapapeles ✅', 'ok');
    }).catch(() => {});
  },

  reiniciarLocal() {
    localStorage.removeItem('mar-caribe-sesion');
    this.sesion = null;
    log('🗑️ Sesión local reiniciada — se usa base del código', 'warn');
  }
};

// Estado
let imagenActual = null, imagenDatos = null, logCompleto = '';
let tiempoInicioGlobal = 0;
let coordenadasCeldas = [], lineasHActuales = [], lineasVActuales = [];
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

// Zoom con dos dedos y arrastre
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

previewContainer.addEventListener('touchend', () => {
  toquesIniciales = null;
});

// ==============================================
// CARGA DE IMAGEN
// ==============================================
btnCargar.addEventListener('click', () => inputImagen.click());
inputImagen.addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  logContenido.innerHTML = ''; logCompleto = ''; tablaResultado.innerHTML = '';
  tiempoInicioGlobal = Date.now();

  log('=== MAR Caribe — Escáner de Tablas ===', 'info');
  log(`Fecha: ${new Date().toLocaleString()}`, 'info');
  log(`Imagen: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB)`, 'info');
  log(`Configuración: ${CONFIG.FILAS} filas × ${CONFIG.COLUMNAS} columnas`, 'info');

  const cargada = await Aprendizaje.cargarBase();

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

  // Ajustar canvas al tamaño real de la imagen
  await new Promise(r => previewImg.onload = r);
  canvasLineas.width = previewImg.clientWidth;
  canvasLineas.height = previewImg.clientHeight;

  log(`Imagen cargada: ${img.width}×${img.height} píxeles`, 'ok');

  // Generar y dibujar líneas
  const { lineasH, lineasV } = Aprendizaje.generarLineas();
  lineasHActuales = lineasH;
  lineasVActuales = lineasV;
  dibujarLineas();

  log(`📐 Líneas generadas — H: ${lineasH.length} | V: ${lineasV.length}`, 'ok');
  btnProcesar.disabled = false;
});

// ==============================================
// DIBUJAR LÍNEAS
// ==============================================
function dibujarLineas() {
  const ctx = canvasLineas.getContext('2d');
  const ancho = canvasLineas.width, alto = canvasLineas.height;
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineWidth = 2;

  ctx.strokeStyle = '#3b82f6';
  lineasHActuales.forEach((pos, i) => {
    const y = pos * alto;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ancho, y); ctx.stroke();
    ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`F${i}`, 5, y + 15);
  });

  ctx.strokeStyle = '#ef4444';
  lineasVActuales.forEach((pos, i) => {
    const x = pos * ancho;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, alto); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`C${i}`, x + 5, 15);
  });
}

// ==============================================
// EDITAR LÍNEAS — Arrastrar, Agregar, Quitar
// ==============================================
btnEditarLineas.addEventListener('click', () => {
  modoEdicionLineas = !modoEdicionLineas;
  canvasLineas.style.pointerEvents = modoEdicionLineas ? 'auto' : 'none';
  log(modoEdicionLineas ? '✏️ MODO EDICIÓN ACTIVO — Arrastra las líneas' : '👁️ Modo vista', modoEdicionLineas ? 'ok' : 'info');
  btnEditarLineas.style.background = modoEdicionLineas ? '#ef4444' : '';
});

canvasLineas.addEventListener('mousedown', iniciarArrastre);
canvasLineas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  iniciarArrastre({ clientX: t.clientX, clientY: t.clientY });
});

function iniciarArrastre(e) {
  if (!modoEdicionLineas) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / Aprendizaje.zoom;
  const y = (e.clientY - rect.top) / Aprendizaje.zoom;
  const umbral = 12;

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

canvasLineas.addEventListener('mousemove', moverLinea);
canvasLineas.addEventListener('touchmove', (e) => {
  if (!lineaSeleccionada) return;
  const t = e.touches[0];
  moverLinea({ clientX: t.clientX, clientY: t.clientY });
  e.preventDefault();
});

function moverLinea(e) {
  if (!lineaSeleccionada) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / Aprendizaje.zoom;
  const y = (e.clientY - rect.top) / Aprendizaje.zoom;

  if (lineaSeleccionada.tipo === 'H') {
    let nueva = (y - offsetArrastre) / canvasLineas.height;
    nueva = Math.max(0.01, Math.min(0.99, nueva));
    lineasHActuales[lineaSeleccionada.indice] = nueva;
  } else {
    let nueva = (x - offsetArrastre) / canvasLineas.width;
    nueva = Math.max(0.01, Math.min(0.99, nueva));
    lineasVActuales[lineaSeleccionada.indice] = nueva;
  }
  dibujarLineas();
}

canvasLineas.addEventListener('mouseup', () => { lineaSeleccionada = null; });
canvasLineas.addEventListener('touchend', () => { lineaSeleccionada = null; });

// Agregar y quitar líneas con toque
btnAgregarLinea.addEventListener('click', () => {
  if (!modoEdicionLineas) { log('⚠️ Activa primero "Editar Líneas"', 'warn'); return; }
  const mitadH = 0.5, mitadV = 0.5;
  lineasHActuales.push(mitadH);
  lineasHActuales.sort((a, b) => a - b);
  lineasVActuales.push(mitadV);
  lineasVActuales.sort((a, b) => a - b);
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

// Doble toque para agregar/quitar
canvasLineas.addEventListener('click', (e) => {
  if (!modoEdicionLineas) return;
  const ahora = Date.now();
  const diferencia = ahora - ultimoToque;
  ultimoToque = ahora;
  if (diferencia < 300 && diferencia > 0) {
    const rect = canvasLineas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Aprendizaje.zoom / canvasLineas.width;
    const y = (e.clientY - rect.top) / Aprendizaje.zoom / canvasLineas.height;
    log(`📍 Doble toque en: X=${x.toFixed(4)}, Y=${y.toFixed(4)} — línea agregada`, 'info');
    lineasHActuales.push(y); lineasHActuales.sort((a,b)=>a-b);
    lineasVActuales.push(x); lineasVActuales.sort((a,b)=>a-b);
    dibujarLineas();
  }
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
// PROCESAR TABLA
// ==============================================
btnProcesar.addEventListener('click', async () => {
  log('▶️ Procesamiento iniciado', 'info');
  log(`Filas: ${lineasHActuales.length-1} | Columnas: ${lineasVActuales.length-1}`, 'info');
  log('⚠️ OCR simulado — conectar PaddleOCR según necesidad', 'warn');
  btnProcesar.disabled = false;
});

// ==============================================
// COPIAR LOG
// ==============================================
btnCopiarLog.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logCompleto);
    log('📋 Log copiado al portapapeles ✅', 'ok');
  } catch { log('❌ No se pudo copiar', 'error'); }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  estadoMotor.className = 'estado-motor estado-listo';
  estadoMotor.textContent = '✅ Listo';
  log('✅ Sistema inicializado — Aprendizaje integrado al código', 'ok');
});

