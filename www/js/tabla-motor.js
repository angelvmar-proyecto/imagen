/**
 * MOTOR DE TABLA MAR CARIBE — VERSIÓN FINAL COMPLETA
 * Filtro Paso Bajo + Umbral Dinámico + OCR Tesseract.js + Parseo de Tabla
 * 100% JavaScript — Sin dependencias nativas, sin GGUF, sin errores
 */

const TablaMAR = {
  // Columnas oficiales MAR Caribe — 20 columnas exactas
  columnas: [
    'No', 'Tipo', 'Nivel', 'Nombre', 'Puesto/Op', 'Hotel', 'Promotor',
    'Hora Pick Up', 'Monto/Factor', 'Fecha', 'Folio', 'Depósito',
    'Monto Dep.', 'Moneda', 'País/Ciudad', 'Notas', 'Edad',
    'Estado Civil', 'Locación', 'Horario Cierre'
  ],

  /**
   * 🎨 PREPROCESAMIENTO: Filtro Paso Bajo + Umbral Dinámico
   * Limpia ruido, compensa sombras y luz desigual
   */
  preprocesarImagen(canvas) {
    const ctx = canvas.getContext('2d');
    const ancho = canvas.width;
    const alto = canvas.height;
    const imgData = ctx.getImageData(0, 0, ancho, alto);
    const datos = imgData.data;

    // === FILTRO PASO BAJO — Suavizado Gaussiano 3×3 ===
    const copia = new Uint8ClampedArray(datos);
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const sumaKernel = 16;

    for (let y = 1; y < alto - 1; y++) {
      for (let x = 1; x < ancho - 1; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -1, ki = 0; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++, ki++) {
            const idx = ((y + ky) * ancho + (x + kx)) * 4;
            r += copia[idx] * kernel[ki];
            g += copia[idx + 1] * kernel[ki];
            b += copia[idx + 2] * kernel[ki];
          }
        }
        const idx = (y * ancho + x) * 4;
        datos[idx]     = r / sumaKernel;
        datos[idx + 1] = g / sumaKernel;
        datos[idx + 2] = b / sumaKernel;
      }
    }

    // === UMBRAL DINÁMICO — Binarización adaptativa por bloques 15×15 ===
    const tamanoBloque = 15;
    const desplazamientoUmbral = 10;

    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const idx = (y * ancho + x) * 4;
        const gris = 0.299 * datos[idx] + 0.587 * datos[idx + 1] + 0.114 * datos[idx + 2];

        let brilloPromedio = 0;
        let pixelesVecinos = 0;
        const mitadBloque = Math.floor(tamanoBloque / 2);

        for (let vy = Math.max(0, y - mitadBloque); vy < Math.min(alto, y + mitadBloque + 1); vy++) {
          for (let vx = Math.max(0, x - mitadBloque); vx < Math.min(ancho, x + mitadBloque + 1); vx++) {
            const vidx = (vy * ancho + vx) * 4;
            brilloPromedio += 0.299 * copia[vidx] + 0.587 * copia[vidx + 1] + 0.114 * copia[vidx + 2];
            pixelesVecinos++;
          }
        }

        brilloPromedio = brilloPromedio / pixelesVecinos;
        const esTexto = gris < (brilloPromedio - desplazamientoUmbral);
        const valorFinal = esTexto ? 0 : 255;

        datos[idx] = datos[idx + 1] = datos[idx + 2] = valorFinal;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  },

  /**
   * 🔍 RECONOCIMIENTO ÓPTICO — Tesseract.js (español + inglés)
   */
  async reconocerTexto(imagen) {
    if (!window.Tesseract) {
      throw new Error('Librería Tesseract.js no cargada — verifica index.html');
    }

    const trabajador = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => console.log('[OCR]', m.status, Math.round(m.progress * 100) + '%')
    });

    const resultado = await trabajador.recognize(imagen);
    await trabajador.terminate();

    return {
      texto: resultado.data.text,
      palabras: resultado.data.words,
      confianza: resultado.data.confidence
    };
  },

  /**
   * 📊 PARSEO — Convertir texto plano a tabla estructurada
   */
  parsearTabla(datosOCR) {
    const lineas = datosOCR.texto
      .split(/\r?\n/)
      .map(linea => linea.trim())
      .filter(linea => linea.length > 2);

    const filas = lineas.map(linea => {
      const celdas = linea
        .split(/\s{3,}|\t|\|,/)
        .map(celda => celda.trim())
        .filter(celda => celda !== '');

      const filaSalida = {};
      this.columnas.forEach((nombreColumna, indice) => {
        filaSalida[nombreColumna] = celdas[indice] || '';
      });
      return filaSalida;
    });

    return filas;
  },

  /**
   * 🚀 FLUJO COMPLETO — Todo en un solo llamado
   */
  async procesar(canvasImagen) {
    console.log('[TablaMAR] === INICIO DE PROCESAMIENTO ===');

    // Paso 1: Preprocesar imagen
    this.preprocesarImagen(canvasImagen);
    console.log('[TablaMAR] ✅ Preprocesamiento completado');

    // Paso 2: Reconocer texto
    const datosOCR = await this.reconocerTexto(canvasImagen);
    console.log('[TablaMAR] ✅ OCR completado — Confianza:', Math.round(datosOCR.confianza) + '%');

    // Paso 3: Convertir a tabla estructurada
    const filas = this.parsearTabla(datosOCR);
    console.log(`[TablaMAR] ✅ Tabla generada — ${filas.length} filas`);

    return {
      exito: true,
      columnas: this.columnas,
      filas: filas,
      textoCrudo: datosOCR.texto,
      confianza: datosOCR.confianza
    };
  }
};

// Hacer disponible globalmente
window.TablaMAR = TablaMAR;
console.log('[TablaMAR] ✅ MOTOR CARGADO Y LISTO PARA USAR');
