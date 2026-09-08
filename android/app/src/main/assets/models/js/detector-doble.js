import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-tflite';

const MODELOS = {
  rapido: {
    nombre: 'SSD MobileNet V2',
    ruta: 'models/ssd_mobilenet_v2.tflite',
    modelo: null,
    cargado: false
  },
  preciso: {
    nombre: 'EfficientDet-Lite0',
    ruta: 'models/efficientdet_lite0.tflite',
    modelo: null,
    cargado: false
  }
};

let etiquetas = [];

async function cargarEtiquetas() {
  const respuesta = await fetch('models/labels.txt');
  const texto = await respuesta.text();
  etiquetas = texto.trim().split('\n');
  console.log(`✅ Cargadas ${etiquetas.length} etiquetas`);
  return etiquetas;
}

export async function cargarTodosLosModelos() {
  console.log('🔄 Cargando modelos de IA...');
  await cargarEtiquetas();

  try {
    MODELOS.rapido.modelo = await tflite.loadTFLiteModel(MODELOS.rapido.ruta);
    MODELOS.rapido.cargado = true;
    console.log(`✅ ${MODELOS.rapido.nombre} CARGADO`);
  } catch (err) {
    console.error(`❌ ${MODELOS.rapido.nombre} FALLÓ:`, err.message);
  }

  try {
    MODELOS.preciso.modelo = await tflite.loadTFLiteModel(MODELOS.preciso.ruta);
    MODELOS.preciso.cargado = true;
    console.log(`✅ ${MODELOS.preciso.nombre} CARGADO`);
  } catch (err) {
    console.error(`❌ ${MODELOS.preciso.nombre} FALLÓ:`, err.message);
  }

  const algunoFunciona = MODELOS.rapido.cargado || MODELOS.preciso.cargado;
  if (!algunoFunciona) throw new Error('❌ NINGÚN modelo se pudo cargar');

  const cuantos = Object.values(MODELOS).filter(m => m.cargado).length;
  console.log(`🎉 ${cuantos} de 2 modelos listos`);
  return { rapido: MODELOS.rapido.cargado, preciso: MODELOS.preciso.cargado };
}

async function detectarConModelo(imagenElemento, tipoModelo) {
  const modelo = MODELOS[tipoModelo];
  if (!modelo.cargado) throw new Error(`Modelo ${modelo.nombre} no disponible`);

  const tensor = tf.browser.fromPixels(imagenElemento)
    .resizeBilinear([320, 320])
    .expandDims(0)
    .toFloat();

  const resultados = await modelo.modelo.predict(tensor);
  return procesarResultados(resultados, etiquetas);
}

export async function detectar(imagenElemento, preferencia = 'rapido') {
  if (MODELOS[preferencia]?.cargado) {
    try {
      console.log(`🔍 Usando: ${MODELOS[preferencia].nombre}`);
      return await detectarConModelo(imagenElemento, preferencia);
    } catch (err) {
      console.warn(`⚠️ ${MODELOS[preferencia].nombre} falló: ${err.message}`);
    }
  }

  const alternativo = preferencia === 'rapido' ? 'preciso' : 'rapido';
  if (MODELOS[alternativo]?.cargado) {
    console.log(`🔄 Cambiando a: ${MODELOS[alternativo].nombre}`);
    return await detectarConModelo(imagenElemento, alternativo);
  }

  throw new Error('❌ Ningún modelo disponible');
}

function procesarResultados(resultados, etiquetas) {
  const cajas = resultados[0].dataSync();
  const clases = resultados[1].dataSync();
  const puntuaciones = resultados[2].dataSync();
  const cantidad = resultados[3].dataSync()[0];

  const detecciones = [];
  for (let i = 0; i < cantidad; i++) {
    const confianza = puntuaciones[i];
    if (confianza > 0.5) {
      detecciones.push({
        clase: etiquetas[clases[i]],
        confianza: Math.round(confianza * 100),
        caja: [
          Math.round(cajas[i * 4]),
          Math.round(cajas[i * 4 + 1]),
          Math.round(cajas[i * 4 + 2]),
          Math.round(cajas[i * 4 + 3])
        ]
      });
    }
  }
  return detecciones;
}

export function estadoModelos() {
  return { rapido: MODELOS.rapido.cargado, preciso: MODELOS.preciso.cargado };
}

