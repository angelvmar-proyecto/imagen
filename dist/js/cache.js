// ==============================================
// Cache — IndexedDB para modelos + localStorage para resultados
// ==============================================

// ============================================
// A) IndexedDB para cachear modelos ONNX (.tar)
// ============================================
const DB_NAME = 'ocr_timeshare_db';
const DB_VERSION = 1;
const STORE_NAME = 'modelos';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function guardarModeloEnCache(nombre, arrayBuffer) {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, nombre);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        console.log(`💾 Modelo "${nombre}" guardado en IndexedDB (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('⚠️ No se pudo guardar en IndexedDB:', e);
    return false;
  }
}

async function leerModeloDeCache(nombre) {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(nombre);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          console.log(`⚡ Modelo "${nombre}" cargado de IndexedDB (${(request.result.byteLength / 1024 / 1024).toFixed(2)} MB)`);
          resolve(request.result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function limpiarCacheModelos() {
  try {
    const db = await abrirDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        console.log('🗑️ Caché de modelos limpiada');
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

// Carga un .tar con caché: primero IndexedDB, si no existe lo descarga y guarda
async function cargarModeloConCache(url, nombre) {
  // 1. Intentar leer de IndexedDB
  const cacheado = await leerModeloDeCache(nombre);
  if (cacheado) {
    return cacheado;
  }

  // 2. Descargar del servidor
  console.log(`🌐 Descargando "${nombre}" del servidor...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar ${nombre}: ${response.status}`);
  const buffer = await response.arrayBuffer();

  // 3. Guardar en IndexedDB (no bloquea)
  guardarModeloEnCache(nombre, buffer).catch(() => {});

  return buffer;
}

// ============================================
// B) localStorage para guardar el último resultado
// ============================================
const RESULTADO_KEY = 'ocr_ultimo_resultado';

function guardarUltimoResultado(datos) {
  try {
    localStorage.setItem(RESULTADO_KEY, JSON.stringify({
      matriz: datos.matriz,
      fecha: new Date().toISOString(),
      filas: datos.filas,
      columnas: datos.columnas
    }));
    console.log('💾 Último resultado guardado');
  } catch (e) {
    console.warn('⚠️ No se pudo guardar el resultado:', e);
  }
}

function leerUltimoResultado() {
  try {
    const raw = localStorage.getItem(RESULTADO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function limpiarUltimoResultado() {
  try {
    localStorage.removeItem(RESULTADO_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================
// C) Liberación de memoria
// ============================================
function liberarMemoria(canvas, blob, imageData) {
  try {
    // Soltar canvas
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    }
    // Soltar blob (referencia)
    if (blob) blob = null;
    // Soltar imageData (referencia)
    if (imageData) imageData = null;
    console.log('🧹 Memoria liberada');
  } catch (e) {
    console.warn('⚠️ Error liberando memoria:', e);
  }
}

console.log('✅ Cache cargado (IndexedDB + localStorage + liberación)');
