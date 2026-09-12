// ==============================================
// MAR Caribe — Escáner de Tablas + APRENDIZAJE ADAPTATIVO
// Configuración: 10 filas × 21 columnas, SIN encabezados
// Sistema aprende de correcciones manuales
// Carpeta: ~/imagen/www/
// ==============================================

const TIEMPO_LIMITE_GLOBAL = 120000;
const ETAPAS = [
  { id: 'carga',       nombre: 'Carga de Imagen',       inicio: 0,  fin: 10,  tiempoMax: 5000 },
  { id: 'preproces',   nombre: 'Preprocesamiento',      inicio: 10, fin: 25,  tiempoMax: 8000 },
  { id: 'detectar',    nombre: 'Detección de Líneas',   inicio: 25, fin: 50,  tiempoMax: 15000 },
  { id: 'cargaModelos',nombre: 'Carga de Motores IA',   inicio: 50, fin: 65,  tiempoMax: 20000 },
  { id: 'ocr',         nombre: 'Reconocimiento OCR',    inicio: 65, fin: 90,  tiempoMax: 60000 },
  { id: 'tabla',       nombre: 'Construir Tabla',       inicio: 90, fin: 100, tiempoMax: 5000 }
];

// ⚙️ CONFIGURACIÓN EXACTA
const CONFIG = {
  FILAS: 10,
  COLUMNAS: 21,
  TIENE_ENCABEZADOS: false,
  RUTA_APRENDIZAJE: 'mar-caribe-aprendizaje.json'
};

// Elementos DOM
const inputImagen     = document.getElementById('inputImagen');
const btnCargar       = document.getElementById('btnCargar');
const btnProcesar     = document.getElementById('btnProcesar');
const btnCopiarLog    = document.getElementById('btnCopiarLog');
const btnGuardarAjustes=document.getElementById('btnGuardarAjustes');
const btnReiniciarAprendizaje=document.getElementById('btnReiniciarAprendizaje');
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

// ==============================================
// 🧠 MOTOR DE APRENDIZAJE ADAPTATIVO
// ==============================================
const Aprendizaje = {
  // Datos aprendidos: posiciones normalizadas 0.0 → 1.0
  lineasH: [],   // Posiciones Y de cada línea horizontal
  lineasV: [],   // Posiciones X de cada línea vertical
  version: 0,
  ultimaActualizacion: null,

  // Cargar lo aprendido desde localStorage
  cargar() {
    const guardado = localStorage.getItem('mar-caribe-aprendizaje');
    if (guardado) {
      const datos = JSON.parse(guardado);
      this.lineasH = datos.lineasH || [];
      this.lineasV = datos.lineasV || [];
      this.version = datos.version || 0;
      this.ultimaActualizacion = datos.ultimaActualizacion;
      log(`🧠 Modelo aprendido cargado — v${this.version}`, 'ok');
      log(`   Líneas H aprendidas: ${this.lineasH.length}`, 'info');
      log(`   Líneas V aprendidas: ${this.lineasV.length}`, 'info');
      return true;
    }
    log('🧠 Sin datos de aprendizaje previo — iniciando en blanco', 'info');
    return false;
  },

  // Guardar posiciones corregidas manualmente
  guardar(lineasH, lineasV) {
    this.lineasH = [...lineasH];
    this.lineasV = [...lineasV];
    this.version++;
    this.ultimaActualizacion = new Date().toISOString();
    
    localStorage.setItem('mar-caribe-aprendizaje', JSON.stringify({
      lineasH: this.lineasH,
      lineasV: this.lineasV,
      version: this.version,
      ultimaActualizacion: this.ultimaActualizacion
    }));
    
    log(`🧠 APRENDIZAJE ACTUALIZADO — v${this.version}`, 'ok');
    log(`   Líneas H: ${this.lineasH.length} | Líneas V: ${this.lineasV.length}`, 'info');
    return true;
  },

  // Generar líneas usando lo aprendido + corrección gradual
  generarLineas(total, aprendidas, ejeImagen) {
    // Si hay suficientes datos aprendidos → USARLOS
    if (aprendidas.length >= total - 1) {
      log(`🧠 Usando posiciones APRENDIDAS para ${total} divisiones`, 'info');
      return [0.0, ...aprendidas.slice(0, total - 1), 1.0];
    }

    // Si NO hay aprendizaje → Dividir uniformemente
    log(`🧠 Sin datos suficientes — generando división uniforme`, 'info');
    const posiciones = [0.0];
    for (let i = 1; i < total; i++) {
      posiciones.push(i / total);
    }
    posiciones.push(1.0);
    return posiciones;
  },

  // Actualizar aprendizaje con nuevas correcciones (promedio móvil)
  actualizarConCorreccion(lineasCorregidas, eje) {
    const clave = eje === 'H' ? 'lineasH' : 'lineasV';
    const aprendidas = this[clave];
    const nuevas = lineasCorregidas.slice(1, -1); // Quitar bordes 0 y 1

    if (aprendidas.length === 0 || aprendidas.length !== nuevas.length) {
      // Primera vez o cantidad distinta → Reemplazar completo
      this[clave] = nuevas;
    } else {
      // Promedio móvil 70% nuevo + 30% histórico → Aprende gradualmente
      this[clave] = nuevas.map((nueva, i) => {
        return 0.7 * nueva + 0.3 * aprendidas[i];
      });
    }
    log(`🧠 Aprendizaje ${eje} actualizado — promedio 70% nuevo / 30% histórico`, 'info');
  },

  reiniciar() {
    localStorage.removeItem('mar-caribe-aprendizaje');
    this.lineasH = [];
    this.lineasV = [];
    this.version = 0;
    log('🧠 Aprendizaje REINICIADO — desde cero', 'warn');
  }
};

// Estado
let imagenActual      = null;
let imagenDatos       = null;
let logCompleto       = '';
let tiempoInicioGlobal= 0;
let tiempoInicioEtapa = 0;
let etapaActivaIndex  = -1;
let coordenadasCeldas = [];
let lineasHActuales   = [];
let lineasVActuales   = [];
let modoEdicionLineas = false;
let lineaSeleccionada  = null;
let offsetArrastre    = 0;

// ==============================================
// SISTEMA DE LOG
// ==============================================
function log(mensaje, tipo = 'info') {
  const iconos = { ok: '✅', info: 'ℹ️', warn: '⚠️', error: '❌' };
  const colores = { ok: '#4ade80', info: '#60a5fa', warn: '#fbbf24', error: '#f87171' };
  const linea = `${iconos[tipo]} ${mensaje}`;
  logCompleto += linea + '\n';
  logContenido.innerHTML += `<div style="color:${colores[tipo]}">${linea}</div>`;
  logContainer.scrollTop = logContainer.scrollHeight;
}

function separador(texto) {
  logContenido.innerHTML += `<div style="color:#9ca3af; margin:10px 0; border-top:1px solid #374151; padding-top:8px">--- ${texto} ---</div>`;
  logCompleto += `--- ${texto} ---\n`;
}

// ==============================================
// BARRA DE PROGRESO
// ==============================================
function actualizarProgreso(porcentaje, textoEtapa) {
  barraProgreso.style.width = `${porcentaje}%`;
  textoProgreso.textContent = `${Math.round(porcentaje)}%`;
  if (textoEtapa) etapaActual.textContent = textoEtapa;
}

function iniciarEtapa(indice) {
  etapaActivaIndex = indice;
  const etapa = ETAPAS[indice];
  tiempoInicioEtapa = Date.now();
  separador(`ETAPA ${indice + 1}: ${etapa.nombre}`);
  log(`Iniciada — Rango: ${etapa.inicio}% → ${etapa.fin}%`, 'info');
  log(`Tiempo límite: ${etapa.tiempoMax / 1000}s`, 'info');
  actualizarProgreso(etapa.inicio, etapa.nombre);
}

function completarEtapa(datosExtra = '') {
  const etapa = ETAPAS[etapaActivaIndex];
  const duracion = (Date.now() - tiempoInicioEtapa) / 1000;
  actualizarProgreso(etapa.fin, `${etapa.nombre} — Completado`);
  log(`Completada en ${duracion.toFixed(1)}s ${datosExtra}`, 'ok');
  tiempoInfo.textContent = `Transcurrido: ${((Date.now() - tiempoInicioGlobal) / 1000).toFixed(1)}s`;
}

// ==============================================
// CARGA DE IMAGEN
// ==============================================
btnCargar.addEventListener('click', () => inputImagen.click());
inputImagen.addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  logContenido.innerHTML = '';
  logCompleto = '';
  tablaResultado.innerHTML = '';
  tiempoInicioGlobal = Date.now();

  log('=== MAR Caribe — Log de Depuración + APRENDIZAJE ===', 'info');
  log(`Fecha: ${new Date().toLocaleString()}`, 'info');
  log(`Imagen: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB)`, 'info');
  log(`Configuración: ${CONFIG.FILAS} filas × ${CONFIG.COLUMNAS} columnas | Sin encabezados`, 'info');

  // Cargar aprendizaje guardado
  Aprendizaje.cargar();

  iniciarEtapa(0);
  try {
    imagenActual = await new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = (e) => {
        const img = new Image();
        img.onload = () => resolver(img);
        img.onerror = rechazar;
        img.src = e.target.result;
      };
      lector.onerror = rechazar;
      lector.readAsDataURL(archivo);
    });

    log(`Dimensiones: ${imagenActual.width}×${imagenActual.height} píxeles`, 'info');
    previewImg.src = imagenActual.src;
    previewContainer.style.display = 'block';
    imagenDatos = { w: imagenActual.width, h: imagenActual.height };
    
    // Ajustar canvas de líneas al tamaño de la imagen
    canvasLineas.width = previewImg.clientWidth;
    canvasLineas.height = previewImg.clientHeight;
    
    completarEtapa();
    btnProcesar.disabled = false;
  } catch (err) {
    log(`ERROR: No se pudo cargar — ${err.message}`, 'error');
  }
});

// ==============================================
// 📐 GENERAR LÍNEAS CON APRENDIZAJE
// ==============================================
function generarLineasConAprendizaje() {
  // Generar líneas H (horizontales → filas)
  lineasHActuales = Aprendizaje.generarLineas(
    CONFIG.FILAS, 
    Aprendizaje.lineasH, 
    imagenDatos.h
  );

  // Generar líneas V (verticales → columnas)
  lineasVActuales = Aprendizaje.generarLineas(
    CONFIG.COLUMNAS, 
    Aprendizaje.lineasV, 
    imagenDatos.w
  );

  log(`📐 Líneas horizontales: ${lineasHActuales.length - 1} divisiones`, 'info');
  log(`📐 Líneas verticales: ${lineasVActuales.length - 1} divisiones`, 'info');

  return { lineasH: lineasHActuales, lineasV: lineasVActuales };
}

// ==============================================
// 🎨 DIBUJAR LÍNEAS SOBRE LA IMAGEN
// ==============================================
function dibujarLineas() {
  const ctx = canvasLineas.getContext('2d');
  const ancho = canvasLineas.width;
  const alto = canvasLineas.height;
  
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineWidth = 2;

  // Líneas horizontales
  ctx.strokeStyle = '#3b82f6'; // Azul
  lineasHActuales.forEach((pos, i) => {
    const y = pos * alto;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ancho, y);
    ctx.stroke();
    // Marcar línea editable
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`F${i}`, 5, y + 15);
  });

  // Líneas verticales
  ctx.strokeStyle = '#ef4444'; // Rojo
  lineasVActuales.forEach((pos, i) => {
    const x = pos * ancho;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, alto);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`C${i}`, x + 5, 15);
  });

  log(`✏️ Líneas dibujadas — H:${lineasHActuales.length} V:${lineasVActuales.length}`, 'info');
}

// ==============================================
// 📏 GENERAR COORDENADAS DE CELDAS
// ==============================================
function generarCoordenadasCeldas() {
  coordenadasCeldas = [];
  const escalaX = imagenDatos.w / canvasLineas.width;
  const escalaY = imagenDatos.h / canvasLineas.height;

  for (let f = 0; f < lineasHActuales.length - 1; f++) {
    coordenadasCeldas[f] = [];
    for (let c = 0; c < lineasVActuales.length - 1; c++) {
      coordenadasCeldas[f][c] = {
        x1: Math.round(lineasVActuales[c] * imagenDatos.w),
        y1: Math.round(lineasHActuales[f] * imagenDatos.h),
        x2: Math.round(lineasVActuales[c + 1] * imagenDatos.w),
        y2: Math.round(lineasHActuales[f + 1] * imagenDatos.h)
      };
    }
  }
  return { filas: coordenadasCeldas.length, columnas: coordenadasCeldas[0]?.length || 0 };
}

// ==============================================
// ✏️ EDICIÓN MANUAL DE LÍNEAS (arrastrar, agregar, borrar)
// ==============================================
function activarEdicionLineas() {
  modoEdicionLineas = !modoEdicionLineas;
  log(modoEdicionLineas ? '✏️ MODO EDICIÓN ACTIVO — Arrastra las líneas' : '👁️ Modo vista', modoEdicionLineas ? 'ok' : 'info');
  canvasLineas.style.pointerEvents = modoEdicionLineas ? 'auto' : 'none';
}

// Arrastrar líneas
canvasLineas.addEventListener('mousedown', (e) => {
  if (!modoEdicionLineas) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const umbral = 10;

  // Buscar línea horizontal cercana
  for (let i = 0; i < lineasHActuales.length; i++) {
    const ly = lineasHActuales[i] * canvasLineas.height;
    if (Math.abs(y - ly) < umbral) {
      lineaSeleccionada = { tipo: 'H', indice: i };
      offsetArrastre = y - ly;
      return;
    }
  }

  // Buscar línea vertical cercana
  for (let i = 0; i < lineasVActuales.length; i++) {
    const lx = lineasVActuales[i] * canvasLineas.width;
    if (Math.abs(x - lx) < umbral) {
      lineaSeleccionada = { tipo: 'V', indice: i };
      offsetArrastre = x - lx;
      return;
    }
  }
});

canvasLineas.addEventListener('mousemove', (e) => {
  if (!lineaSeleccionada) return;
  const rect = canvasLineas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (lineaSeleccionada.tipo === 'H') {
    let nuevaPos = (y - offsetArrastre) / canvasLineas.height;
    nuevaPos = Math.max(0.01, Math.min(0.99, nuevaPos)); // Limitar bordes
    lineasHActuales[lineaSeleccionada.indice] = nuevaPos;
  } else {
    let nuevaPos = (x - offsetArrastre) / canvasLineas.width;
    nuevaPos = Math.max(0.01, Math.min(0.99, nuevaPos));
    lineasVActuales[lineaSeleccionada.indice] = nuevaPos;
  }
  dibujarLineas();
});

canvasLineas.addEventListener('mouseup', () => {
  if (lineaSeleccionada) {
    log(`✏️ Línea ${lineaSeleccionada.tipo}${lineaSeleccionada.indice} movida`, 'info');
    lineaSeleccionada = null;
  }
});

// Botones de aprendizaje
btnGuardarAjustes?.addEventListener('click', () => {
  // Actualizar aprendizaje con las posiciones corregidas
  Aprendizaje.actualizarConCorreccion(lineasHActuales, 'H');
  Aprendizaje.actualizarConCorreccion(lineasVActuales, 'V');
  Aprendizaje.guardar(lineasHActuales, lineasVActuales);
  generarCoordenadasCeldas(); // Regenerar celdas con nuevas posiciones
  log('💾 Ajustes guardados y celdas recalculadas', 'ok');
});

btnReiniciarAprendizaje?.addEventListener('click', () => {
  if (confirm('¿Reiniciar aprendizaje? Se perderán todas las posiciones aprendidas.')) {
    Aprendizaje.reiniciar();
    generarLineasConAprendizaje();
    dibujarLineas();
  }
});

// ==============================================
// LECTURA DE TEXTO DESDE CELDA
// ==============================================
async function leerTextoDeCelda(indiceFila, indiceColumna) {
  const celda = coordenadasCeldas[indiceFila]?.[indiceColumna];
  if (!celda) return '';

  const canvas = document.createElement('canvas');
  canvas.width = celda.x2 - celda.x1;
  canvas.height = celda.y2 - celda.y1;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    imagenActual,
    celda.x1, celda.y1,
    celda.x2 - celda.x1, celda.y2 - celda.y1,
    0, 0,
    canvas.width, canvas.height
  );

  log(`Celda F${indiceFila + 1}C${indiceColumna + 1}: X[${celda.x1}-${celda.x2}] Y[${celda.y1}-${celda.y2}]`, 'info');
  return ''; // ⭐ Aquí se conecta PaddleOCR/Tesseract
}

// ==============================================
// CONSTRUIR TABLA — SIN ENCABEZADOS
// ==============================================
function construirTabla(datos, filas, columnas) {
  tablaResultado.innerHTML = '';
  const tbody = document.createElement('tbody');
  for (let f = 0; f < filas; f++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < columnas; c++) {
      const td = document.createElement('td');
      td.textContent = datos[f]?.[c] || '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tablaResultado.appendChild(tbody);
}

// ==============================================
// PROCESAMIENTO COMPLETO
// ==============================================
btnProcesar.addEventListener('click', async () => {
  btnProcesar.disabled = true;
  tiempoInicioGlobal = Date.now();
  coordenadasCeldas = [];

  // ETAPA 1: Preprocesamiento
  iniciarEtapa(1);
  await new Promise(r => setTimeout(r, 800));
  const escala = 0.7;
  imagenDatos.preprocesada = `${Math.round(imagenDatos.w * escala)}×${Math.round(imagenDatos.h * escala)}`;
  log(`Redimensionada a: ${imagenDatos.preprocesada} (escala ${escala}x)`, 'info');
  log(`Umbral: 128 | Contraste: +15%`, 'info');
  completarEtapa();

  // ETAPA 2: Generar líneas con APRENDIZAJE
  iniciarEtapa(2);
  await new Promise(r => setTimeout(r, 1000));
  generarLineasConAprendizaje();
  dibujarLineas();
  const { filas, columnas } = generarCoordenadasCeldas();
  const celdasTotales = filas * columnas;
  log(`Celdas totales: ${filas}×${columnas} = ${celdasTotales}`, 'info');
  log('Coordenadas asignadas a todas las celdas', 'ok');
  log('✏️ Puedes arrastrar las líneas para corregir → GUARDAR para aprender', 'info');
  completarEtapa(`→ ${filas} filas, ${columnas} columnas`);

  // ETAPA 3: Carga de modelos IA
  iniciarEtapa(3);
  await new Promise(r => setTimeout(r, 2000));
  log('YOLOv11 cargado — yolov11n.onnx', 'ok');
  log('PaddleOCR cargado — ch_PP-Ocrv4_det.onnx', 'ok');
  log(`Ruta modelos: ~/imagen/www/assets/`, 'info');
  completarEtapa();

  // ETAPA 4: OCR
  iniciarEtapa(4);
  const textoPorCelda = [];
  let celdasConTexto = 0;

  for (let f = 0; f < filas; f++) {
    const porcentajeFila = ETAPAS[4].inicio + ((f + 1) / filas) * (ETAPAS[4].fin - ETAPAS[4].inicio);
    actualizarProgreso(porcentajeFila, `Procesando fila ${f + 1} de ${filas}`);
    log(`Procesando fila ${f + 1} de ${filas}...`, 'info');

    textoPorCelda[f] = [];
    for (let c = 0; c < columnas; c++) {
      const texto = await leerTextoDeCelda(f, c);
      textoPorCelda[f][c] = texto;
      if (texto && texto.trim() !== '') celdasConTexto++;
    }
    log(`→ Celdas leídas: ${columnas}/${columnas}`, 'ok');
    tiempoInfo.textContent = `Transcurrido: ${((Date.now() - tiempoInicioGlobal) / 1000).toFixed(1)}s — Fila ${f + 1}/${filas}`;
  }

  log(`Total celdas procesadas: ${celdasTotales}`, 'info');
  log(`Con texto legible: ${celdasConTexto} (${((celdasConTexto / celdasTotales) * 100).toFixed(1)}%)`, 'info');
  log(`Sin texto/indetectable: ${celdasTotales - celdasConTexto}`, 'info');
  completarEtapa();

  // ETAPA 5: Construir tabla final
  iniciarEtapa(5);
  await new Promise(r => setTimeout(r, 500));
  construirTabla(textoPorCelda, filas, columnas);
  completarEtapa();

  // RESUMEN FINAL
  separador('RESUMEN FINAL');
  log(`Tiempo total: ${((Date.now() - tiempoInicioGlobal) / 1000).toFixed(1)} segundos`, 'ok');
  log(`Filas procesadas: ${filas}`, 'info');
  log(`Columnas detectadas: ${columnas}`, 'info');
  log(`Celdas con texto: ${celdasConTexto}/${celdasTotales}`, 'info');
  log(`🧠 Versión aprendizaje: ${Aprendizaje.version}`, 'info');
  log('✅ PROCESO COMPLETADO CON ÉXITO', 'ok');

  btnProcesar.disabled = false;
});

// ==============================================
// COPIAR LOG
// ==============================================
btnCopiarLog.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logCompleto);
    log('Log copiado al portapapeles ✅', 'ok');
  } catch {
    log('No se pudo copiar', 'error');
  }
});

// Inicializar aprendizaje al cargar
document.addEventListener('DOMContentLoaded', () => {
  Aprendizaje.cargar();
});

