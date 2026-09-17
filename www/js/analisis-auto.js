// ============================================
// ANÁLISIS AUTOMÁTICO DE IMAGEN
// Detecta nitidez y ruido para recomendar filtro
// ============================================

window.MAR = window.MAR || {};

// Calcular nitidez usando varianza del Laplaciano
function calcularNitidez(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const grises = new Uint8Array(w * h);

  // Convertir a grises
  for (let i = 0; i < src.length; i += 4) {
    grises[i / 4] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
  }

  // Aplicar kernel Laplaciano
  // [ 0  1  0]
  // [ 1 -4  1]
  // [ 0  1  0]
  let suma = 0;
  let sumaCuadrados = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grises[(y-1)*w + x] + grises[(y+1)*w + x] +
                  grises[y*w + (x-1)] + grises[y*w + (x+1)] -
                  4 * grises[i];
      suma += lap;
      sumaCuadrados += lap * lap;
      count++;
    }
  }

  const media = suma / count;
  const varianza = (sumaCuadrados / count) - (media * media);
  return varianza;
}

// Calcular ruido estimado en zonas "vacías"
function calcularRuido(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  // Analizar la esquina superior izquierda (probable zona blanca)
  const tamMuestra = Math.min(50, Math.floor(w / 4), Math.floor(h / 4));
  let suma = 0;
  let sumaCuadrados = 0;
  let count = 0;

  for (let y = 0; y < tamMuestra; y++) {
    for (let x = 0; x < tamMuestra; x++) {
      const idx = (y * w + x) * 4;
      const gris = 0.299 * src[idx] + 0.587 * src[idx+1] + 0.114 * src[idx+2];
      suma += gris;
      sumaCuadrados += gris * gris;
      count++;
    }
  }

  const media = suma / count;
  const varianza = (sumaCuadrados / count) - (media * media);
  return Math.sqrt(varianza);
}

// Analizar la imagen al cargarla
async function analizarImagen(imageData) {
  console.log('🔍 Analizando imagen...');

  const nitidez = calcularNitidez(imageData);
  const ruido = calcularRuido(imageData);

  console.log('📊 Nitidez (varianza Laplaciano):', Math.round(nitidez));
  console.log('📊 Ruido (desviación en zona blanca):', Math.round(ruido));

  // Clasificar nitidez
  let nivelNitidez = 'Baja';
  let emojiNitidez = '🔴';
  if (nitidez > 1000) { nivelNitidez = 'Alta'; emojiNitidez = '🟢'; }
  else if (nitidez > 300) { nivelNitidez = 'Media'; emojiNitidez = '🟡'; }

  // Clasificar ruido
  let nivelRuido = 'Alto';
  let emojiRuido = '🔴';
  if (ruido < 10) { nivelRuido = 'Bajo'; emojiRuido = '🟢'; }
  else if (ruido < 25) { nivelRuido = 'Medio'; emojiRuido = '🟡'; }

  // Recomendación
  let recomendacion = '';
  let indiceVentanaRecomendado = 0;

  if (nitidez > 1000 && ruido < 10) {
    recomendacion = '1 — Sin filtro (imagen nítida y limpia)';
    indiceVentanaRecomendado = 0;
  } else if (nitidez > 300 && ruido < 20) {
    recomendacion = '3 — Filtro suave (buena nitidez)';
    indiceVentanaRecomendado = 1;
  } else if (nitidez > 100 && ruido < 35) {
    recomendacion = '5 — Filtro medio (imagen con algo de ruido)';
    indiceVentanaRecomendado = 2;
  } else {
    recomendacion = '7 — Filtro fuerte (imagen con mucho ruido)';
    indiceVentanaRecomendado = 3;
  }

  return {
    nitidez: Math.round(nitidez),
    ruido: Math.round(ruido),
    nivelNitidez,
    emojiNitidez,
    nivelRuido,
    emojiRuido,
    recomendacion,
    indiceVentanaRecomendado
  };
}

// Mostrar el panel de análisis
function mostrarAnalisis(analisis) {
  const panel = document.getElementById('analisisAuto');
  if (!panel) return;

  panel.style.display = 'block';
  document.getElementById('analisisNitidez').innerHTML = 
    `${analisis.emojiNitidez} ${analisis.nivelNitidez} (${analisis.nitidez})`;
  document.getElementById('analisisRuido').innerHTML = 
    `${analisis.emojiRuido} ${analisis.nivelRuido} (${analisis.ruido})`;
  document.getElementById('analisisRecomendacion').textContent = 
    `💡 ${analisis.recomendacion}`;
}
