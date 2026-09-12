// ==============================================
// MAR Caribe — Escáner de Tablas
// Versión: 1.3 | Fecha: 2026-09-12
// Cambio: Área imagen mínima 33vh / 1/3 pantalla + botones compactos
// ==============================================

const CONFIG = {
  RUTA_BASE: 'assets/aprendizaje-base.json',
  PESO_NUEVO: 0.70,
  PESO_HISTORICO: 0.30,
  UMBRAL_ZONAS: 4,
  ANCHO_LINEA: 2.2,
  AREA_TOCAR_LINEA: 35, // 🔴 ÁREA MUY GRANDE para agarrar líneas
  TIEMPO_LIMITE: 120000
};

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
const contenedorImagen= document.getElementById('contenedorImagen');
const previewImg      = document.getElementById('previewImg');
const canvasLineas    = document.getElementById('canvasLineas');
const barraProgreso   = document.getElementById('barraProgreso');
const textoProgreso   = document.getElementById('textoProgreso');
const tiempoInfo      = document.getElementById('tiempoInfo');
const logContenido    = document.getElementById('logContenido');
const logContainer    = document.getElementById('logContainer');
const tablaResultado  = document.getElementById('tablaResultado');
const versionAprendizaje=document.getElementById('versionAprendizaje');
const numLineasH      = document.getElementById('numLineasH');
const numLineasV      = document.getElementById('numLineasV');

let imagenActual = null, imagenDatos = null, logCompleto = '';
let tiempoInicio = 0;
let lineasHActuales = [], lineasVActuales = [];
let modoEdicionLineas = false, lineaSeleccionada = null, offsetArrastre = 0;
let ultimoToque = 0;
let escalaZoom = 1.0;
let desplazamiento = { x: 0, y: 0 };

function log(mensaje, tipo = 'info') {
  const iconos = { ok: '✅', info: 'ℹ️', warn: '⚠️', error: '❌' };
  const colores = { ok: '#4ade80', info: '#60a5fa', warn: '#fbbf24', error: '#f87171' };
  const linea = `${iconos[tipo]} ${mensaje}`;
  logCompleto += linea + '\n';
  logContenido.innerHTML += `<div style="color:${colores[tipo]}; white-space:pre-wrap; margin:1px 0;">${linea}</div>`;
  logContainer.scrollTop = logContainer.scrollHeight;
}

const UmbralDinamico = {
  calcular(imagenData, ancho, alto) {
    const zonas = CONFIG.UMBRAL_ZONAS;
    const raiz = Math.sqrt(zonas);
    const anchoZona = Math.floor(ancho / raiz);
    const altoZona = Math.floor(alto / raiz);
    let brilloTotal = 0, pixeles = 0;

    for (let z = 0; z < zonas; z++) {
      const x = (z % 2) * anchoZona;
      const y = Math.floor(z / 2) * altoZona;
      let brilloZona = 0, pixelesZona = 0;
      for (let py = y; py < y + altoZona && py < alto; py++) {
        for (let px = x; px < x + anchoZona && px < ancho; px++) {
          const idx = (py * ancho + px) * 4;
          brilloZona += Math.round(0.299 * imagenData[idx] + 0.587 * imagenData[idx+1] + 0.114 * imagenData[idx+2]);
          brilloTotal += brilloZona; pixelesZona++; pixeles++;
        }
      }
    }
    const brilloProm = Math.round(brilloTotal / pixeles);
    log(`⚡ Umbral calculado: ${brilloProm}`, 'info');
    return brilloProm;
  }
};

const Aprendizaje = {
  base: null, sesion: null,

  async cargarBase() {
    log('🔄 Cargando configuración base...', 'info');
    try {
      const resp = await fetch(CONFIG.RUTA_BASE);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.base = await resp.json();
      versionAprendizaje.textContent = `Versión base: ${this.base.version_aprendizaje} | ${this.base.fecha_actualizacion}`;
      log(`✅ Base cargada: ${this.base.configuracion.filas} filas × ${this.base.configuracion.columnas} columnas`, 'ok');
      this.cargarSesionLocal();
      return true;
    } catch (err) {
      log(`⚠️ Sin archivo base — usando valores por defecto: ${err.message}`, 'warn');
      this.base = {
        version_aprendizaje: 1,
        fecha_actualizacion: new Date().toISOString().split('T')[0],
        configuracion: { filas: 10, columnas: 21 },
        lineas_internas: { H: [], V: [] },
        umbral: { tipo: 'dinamico', metodo: 'por_zonas' }
      };
      versionAprendizaje.textContent = 'Versión base: 1 (por defecto)';
      return false;
    }
  },

  cargarSesionLocal() {
    const g = localStorage.getItem('mar-caribe-sesion');
    if (g) try { this.sesion = JSON.parse(g); log('📥 Sesión local cargada', 'info'); } catch {}
  },

  generarLineas() {
    const fuente = this.sesion || this.base;
    let H = [], V = [];

    if (fuente?.lineas_internas?.H?.length > 0) {
      H = [0.0, ...fuente.lineas_internas.H, 1.0];
      V = [0.0, ...fuente.lineas_internas.V, 1.0];
      log(`🧠 Usando posiciones guardadas: ${H.length-2} H, ${V.length-2} V`, 'info');
    } else {
      const filas = this.base.configuracion.filas || 10;
      const cols = this.base.configuracion.columnas || 21;
      for (let i = 1; i < filas; i++) H.push(i / filas);
      for (let i = 1; i < cols; i++) V.push(i / cols);
      H = [0.0, ...H, 1.0]; V = [0.0, ...V, 1.0];
      log(`📐 División uniforme: ${filas} filas × ${cols} columnas`, 'info');
    }
    return { lineasH: H, lineasV: V };
  },

  guardar(H, V) {
    const internasH = H.slice(1, -1);
    const internasV = V.slice(1, -1);
    this.sesion = {
      version_sesion: (this.sesion?.version_sesion || 0) + 1,
      fecha: new Date().toISOString(),
      lineas_internas: { H: internasH, V: internasV }
    };
    localStorage.setItem('mar-caribe-sesion', JSON.stringify(this.sesion));
    log(`💾 Guardado: ${internasH.length} líneas H, ${internasV.length} líneas V — Versión sesión: ${this.sesion.version_sesion}`, 'ok');
  },

  exportarJSON() {
    const datos = this.sesion?.lineas_internas || this.base.lineas_internas;
    const json = JSON.stringify({
      ...this.base,
      version_aprendizaje: this.base.version_aprendizaje + 1,
      fecha_actualizacion: new Date().toISOString().split('T')[0],
      lineas_internas: datos
    }, null, 2);
    log('📤 === JSON PARA assets/aprendizaje-base.json ===', 'ok');
    log(json, 'info');
    navigator.clipboard?.writeText(json).then(() => log('📋 Copiado al portapapeles', 'ok'));
  },

  reiniciar() {
    localStorage.removeItem('mar-caribe-sesion');
    this.sesion = null;
    log('🗑️ Sesión reiniciada — volviendo a base', 'warn');
  }
};

function aplicarZoom() {
  previewImg.style.transform = `scale(${escalaZoom}) translate(${desplazamiento.x}px, ${desplazamiento.y}px)`;
  canvasLineas.style.transform = `scale(${escalaZoom}) translate(${desplazamiento.x}px, ${desplazamiento.y}px)`;
  nivelZoom.textContent = `${Math.round(escalaZoom * 100)}%`;
}

btnZoomMas.addEventListener('click', () => { escalaZoom = Math.min(5, escalaZoom * 1.3); aplicarZoom(); });
btnZoomMenos.addEventListener('click', () => { escalaZoom = Math.max(0.5, escalaZoom / 1.3); aplicarZoom(); });
btnZoomNormal.addEventListener('click', () => { escalaZoom = 1.0; desplazamiento = {x:0,y:0}; aplicarZoom(); });

let toquesAnteriores = null;
contenedorImagen.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const t1 = e.touches[0], t2 = e.touches[1];
    toquesAnteriores = { d: Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY), z: escalaZoom };
  }
});
contenedorImagen.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && toquesAnteriores) {
    const t1 = e.touches[0], t2 = e.touches[1];
    const d = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
    escalaZoom = Math.max(0.5, Math.min(5, toquesAnteriores.z * (d / toquesAnteriores.d)));
    aplicarZoom();
    e.preventDefault();
  }
});
contenedorImagen.addEventListener('touchend', () => toquesAnteriores = null);

btnCargar.addEventListener('click', () => inputImagen.click());
inputImagen.addEventListener('change', async e => {
  const arch = e.target.files[0];
  if (!arch) return;

  logContenido.innerHTML = ''; logCompleto = ''; tablaResultado.innerHTML = '';
  tiempoInicio = Date.now();
  btnProcesar.disabled = true;

  log('═════════════════════════════════════════', 'info');
  log('📊 MAR Caribe — Escáner de Tablas', 'ok');
  log(`📅 ${new Date().toLocaleString()}`, 'info');
  log(`🖼️ ${arch.name} (${(arch.size/1024).toFixed(0)} KB)`, 'info');

  await Aprendizaje.cargarBase();

  const img = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => { const i = new Image(); i.onload = ()=>res(i); i.onerror=rej; i.src=e.target.result; };
    r.onerror = rej; r.readAsDataURL(arch);
  });

  imagenActual = img;
  imagenDatos = { w: img.width, h: img.height };
  previewImg.src = img.src;
  contenedorImagen.style.display = 'block';

  await new Promise(r => previewImg.onload = r);

  canvasLineas.width = previewImg.clientWidth;
  canvasLineas.height = previewImg.clientHeight;
  log(`📐 Imagen visible: ${previewImg.clientWidth}×${previewImg.clientHeight} px — Original: ${img.width}×${img.height} px`, 'info');

  const { lineasH, lineasV } = Aprendizaje.generarLineas();
  lineasHActuales = lineasH;
  lineasVActuales = lineasV;
  actualizarContadorLineas();
  dibujarLineas();

  btnProcesar.disabled = false;
  estadoMotor.textContent = '✅ Listo';
  estadoMotor.className = 'estado-motor estado-listo';

  log(`✅ Imagen cargada — Líneas: H=${lineasH.length}, V=${lineasV.length}`, 'ok');
  log('💡 CONSEJO: Haz ZOOM primero → las líneas se separan y se mueven más fácil', 'info');
});

function actualizarContadorLineas() {
  numLineasH.textContent = lineasHActuales.length - 2;
  numLineasV.textContent = lineasVActuales.length - 2;
}

function dibujarLineas() {
  const ctx = canvasLineas.getContext('2d');
  const ancho = canvasLineas.width;
  const alto = canvasLineas.height;
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineWidth = CONFIG.ANCHO_LINEA;

  ctx.strokeStyle = '#3b82f6';
  lineasHActuales.forEach(pos => {
    const y = pos * alto;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ancho, y); ctx.stroke();
  });

  ctx.strokeStyle = '#ef4444';
  lineasVActuales.forEach(pos => {
    const x = pos * ancho;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, alto); ctx.stroke();
  });
}

btnEditarLineas.addEventListener('click', () => {
  modoEdicionLineas = !modoEdicionLineas;
  canvasLineas.style.pointerEvents = modoEdicionLineas ? 'auto' : 'none';
  btnEditarLineas.style.background = modoEdicionLineas ? '#ef4444' : '';
  log(modoEdicionLineas ? '✏️ MODO EDICIÓN ACTIVO' : '👁️ Modo vista', modoEdicionLineas ? 'ok' : 'info');
});

function coordsReales(clientX, clientY) {
  const rect = canvasLineas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - desplazamiento.x) / escalaZoom,
    y: (clientY - rect.top - desplazamiento.y) / escalaZoom
  };
}

function buscarLineaCerca(x, y) {
  const ancho = canvasLineas.width;
  const alto = canvasLineas.height;
  const umbral = CONFIG.AREA_TOCAR_LINEA;

  for (let i = 0; i < lineasHActuales.length; i++) {
    const ly = lineasHActuales[i] * alto;
    if (Math.abs(y - ly) < umbral) {
      return { tipo: 'H', indice: i, distancia: Math.abs(y - ly) };
    }
  }

  for (let i = 0; i < lineasVActuales.length; i++) {
    const lx = lineasVActuales[i] * ancho;
    if (Math.abs(x - lx) < umbral) {
      return { tipo: 'V', indice: i, distancia: Math.abs(x - lx) };
    }
  }
  return null;
}

function iniciarArrastre(e) {
  if (!modoEdicionLineas) return;
  const { x, y } = coordsReales(e.clientX, e.clientY);
  lineaSeleccionada = buscarLineaCerca(x, y);
  if (lineaSeleccionada) {
    log(`🖐️ Agarraste línea ${lineaSeleccionada.tipo === 'H' ? 'HORIZONTAL' : 'VERTICAL'} #${lineaSeleccionada.indice}`, 'info');
    offsetArrastre = lineaSeleccionada.tipo === 'H'
      ? y - lineasHActuales[lineaSeleccionada.indice] * alto
      : x - lineasVActuales[lineaSeleccionada.indice] * ancho;
  }
}

function moverLinea(e) {
  if (!lineaSeleccionada) return;
  const { x, y } = coordsReales(e.clientX, e.clientY);
  const ancho = canvasLineas.width;
  const alto = canvasLineas.height;

  if (lineaSeleccionada.tipo === 'H') {
    let nueva = (y - offsetArrastre) / alto;
    nueva = Math.max(0.005, Math.min(0.995, nueva));
    lineasHActuales[lineaSeleccionada.indice] = nueva;
  } else {
    let nueva = (x - offsetArrastre) / ancho;
    nueva = Math.max(0.005, Math.min(0.995, nueva));
    lineasVActuales[lineaSeleccionada.indice] = nueva;
  }
  dibujarLineas();
}

function terminarArrastre() {
  if (lineaSeleccionada) {
    log(`✅ Línea ${lineaSeleccionada.tipo}[${lineaSeleccionada.indice}] movida`, 'ok');
    lineaSeleccionada = null;
  }
}

canvasLineas.addEventListener('mousedown', iniciarArrastre);
canvasLineas.addEventListener('mousemove', moverLinea);
canvasLineas.addEventListener('mouseup', terminarArrastre);
canvasLineas.addEventListener('mouseleave', terminarArrastre);

canvasLineas.addEventListener('touchstart', e => {
  if (!modoEdicionLineas) return;
  const t = e.touches[0];
  iniciarArrastre({ clientX: t.clientX, clientY: t.clientY });
});
canvasLineas.addEventListener('touchmove', e => {
  if (!lineaSeleccionada) return;
  const t = e.touches[0];
  moverLinea({ clientX: t.clientX, clientY: t.clientY });
  e.preventDefault();
});
canvasLineas.addEventListener('touchend', terminarArrastre);

canvasLineas.addEventListener('touchend', e => {
  if (!modoEdicionLineas) return;
  const ahora = Date.now();
  if (ahora - ultimoToque < 300) {
    const { x, y } = coordsReales(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const py = y / canvasLineas.height;
    const px = x / canvasLineas.width;
    lineasHActuales.push(Math.max(0.01, Math.min(0.99, py)));
    lineasHActuales.sort((a, b) => a - b);
    lineasVActuales.push(Math.max(0.01, Math.min(0.99, px)));
    lineasVActuales.sort((a, b) => a - b);
    actualizarContadorLineas();
    dibujarLineas();
    log(`➕ Línea agregada en Y=${py.toFixed(4)}, X=${px.toFixed(4)}`, 'ok');
  }
  ultimoToque = ahora;
});

btnAgregarLinea.addEventListener('click', () => {
  if (!modoEdicionLineas) { log('⚠️ Activa "Editar" primero', 'warn'); return; }
  lineasHActuales.push(0.5 + (Math.random() - 0.5) * 0.1);
  lineasHActuales.sort((a, b) => a - b);
  lineasVActuales.push(0.5 + (Math.random() - 0.5) * 0.1);
  lineasVActuales.sort((a, b) => a - b);
  actualizarContadorLineas();
  dibujarLineas();
  log(`➕ Líneas agregadas — H: ${lineasHActuales.length}, V: ${lineasVActuales.length}`, 'ok');
});

btnQuitarLinea.addEventListener('click', () => {
  if (!modoEdicionLineas) { log('⚠️ Activa "Editar" primero', 'warn'); return; }
  if (lineasHActuales.length > 2) lineasHActuales.splice(Math.floor(lineasHActuales.length/2), 1);
  if (lineasVActuales.length > 2) lineasVActuales.splice(Math.floor(lineasVActuales.length/2), 1);
  actualizarContadorLineas();
  dibujarLineas();
  log(`➖ Líneas quitadas — H: ${lineasHActuales.length}, V: ${lineasVActuales.length}`, 'ok');
});

btnGuardarAjustes.addEventListener('click', () => {
  Aprendizaje.guardar(lineasHActuales, lineasVActuales);
  dibujarLineas();
});

btnExportarJSON.addEventListener('click', () => {
  Aprendizaje.guardar(lineasHActuales, lineasVActuales);
  Aprendizaje.exportarJSON();
});

btnReiniciarAprendizaje.addEventListener('click', () => {
  if (confirm('¿Reiniciar? Se recupera la configuración base.')) {
    Aprendizaje.reiniciar();
    const { lineasH, lineasV } = Aprendizaje.generarLineas();
    lineasHActuales = lineasH; lineasVActuales = lineasV;
    actualizarContadorLineas();
    dibujarLineas();
  }
});

btnProcesar.addEventListener('click', async () => {
  if (!imagenActual) { log('❌ No hay imagen cargada', 'error'); return; }

  log('▶️ === INICIANDO PROCESAMIENTO DE TABLA ===', 'ok');
  tiempoInicio = Date.now();
  btnProcesar.disabled = true;
  barraProgreso.style.width = '10%'; textoProgreso.textContent = '10%';

  log('⚡ Paso 1: Calculando umbral dinámico...', 'info');
  const canvasTemp = document.createElement('canvas');
  canvasTemp.width = imagenDatos.w;
  canvasTemp.height = imagenDatos.h;
  const ctxTemp = canvasTemp.getContext('2d');
  ctxTemp.drawImage(imagenActual, 0, 0);
  const datosImg = ctxTemp.getImageData(0, 0, imagenDatos.w, imagenDatos.h).data;
  const umbral = UmbralDinamico.calcular(datosImg, imagenDatos.w, imagenDatos.h);
  barraProgreso.style.width = '30%'; textoProgreso.textContent = '30%';

  log('📐 Paso 2: Definiendo celdas desde líneas...', 'info');
  const filas = lineasHActuales.length - 1;
  const cols = lineasVActuales.length - 1;
  log(`📊 Celdas: ${filas} filas × ${cols} columnas = ${filas*cols} celdas`, 'ok');
  barraProgreso.style.width = '50%'; textoProgreso.textContent = '50%';

  log('📝 Paso 3: Estructura lista para OCR...', 'info');
  log('ℹ️ Reconocimiento OCR pendiente de integración con PaddleOCR/Yolo', 'warn');
  barraProgreso.style.width = '80%'; textoProgreso.textContent = '80%';

  log('📋 Paso 4: Construyendo tabla...', 'info');
  tablaResultado.innerHTML = '';
  const encabezado = document.createElement('tr');
  encabezado.innerHTML = '<th>#</th>' + Array.from({length:cols}, (_,c)=>`<th>C${c+1}</th>`).join('');
  tablaResultado.appendChild(encabezado);

  for (let f = 0; f < filas; f++) {
    const fila = document.createElement('tr');
    fila.innerHTML = `<td>${f+1}</td>` + Array.from({length:cols}, (_,c)=>{
      const hIni = lineasHActuales[f];
      const hFin = lineasHActuales[f+1];
      const vIni = lineasVActuales[c];
      const vFin = lineasVActuales[c+1];
      return `<td title="Fila ${f+1}: ${(hIni*100).toFixed(1)}%–${(hFin*100).toFixed(1)}% | Col ${c+1}: ${(vIni*100).toFixed(1)}%–${(vFin*100).toFixed(1)}%">—</td>`;
    }).join('');
    tablaResultado.appendChild(fila);
  }
  barraProgreso.style.width = '100%'; textoProgreso.textContent = '100%';

  const tiempoTotal = ((Date.now() - tiempoInicio)/1000).toFixed(1);
  tiempoInfo.textContent = `Transcurrido: ${tiempoTotal}s`;

  log(`✅ === PROCESAMIENTO COMPLETO en ${tiempoTotal}s ===`, 'ok');
  log(`📊 Tabla: ${filas} filas × ${cols} columnas`, 'ok');

  btnProcesar.disabled = false;
});

btnCopiarLog.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(logCompleto); log('📋 Log copiado al portapapeles ✅', 'ok'); }
  catch { log('⚠️ No se pudo copiar — selecciona manualmente', 'warn'); }
});

document.addEventListener('DOMContentLoaded', () => {
  log('═════════════════════════════════════════', 'info');
  log('✅ Sistema inicializado — Área imagen ampliada', 'ok');
  log('   📐 Área imagen: mínimo 33vh / 1/3 pantalla', 'info');
  log('   ✋ Área toque líneas: 35px', 'info');
  log('   🔵 Líneas H y 🔴 V movibles', 'info');
  log('   ▶️ Botón Procesar activo al cargar imagen', 'info');
  log('═════════════════════════════════════════', 'info');
  estadoMotor.textContent = '✅ Listo';
  estadoMotor.className = 'estado-motor estado-listo';
});

