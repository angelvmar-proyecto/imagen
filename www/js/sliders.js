// ============================================
// SLIDERS - Re-ejecuta el paso al soltar
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎚️ Conectando sliders...');

  // Mostrar valor en vivo mientras se mueve
  const sliders = document.querySelectorAll('input[type="range"]');
  sliders.forEach(slider => {
    const valorId = 'val-' + slider.id.replace('param-', '');
    const valorEl = document.getElementById(valorId);
    
    slider.addEventListener('input', () => {
      if (valorEl) {
        let sufijo = '';
        const id = slider.id;
        if (id.includes('cont') || id.includes('long') || id.includes('sat') || id.includes('peso')) sufijo = '%';
        else if (id.includes('matiz')) sufijo = '°';
        else if (id.includes('tol') || id.includes('dist')) sufijo = 'px';
        valorEl.textContent = slider.value + sufijo;
      }
    });

    // Al soltar, re-ejecutar el paso correspondiente
    slider.addEventListener('change', () => {
      const id = slider.id;
      console.log('🎚️ Slider soltado:', id, '=', slider.value);

      // Actualizar parámetros
      if (id === 'param-mediana-ventana') {
        PARAMS_PASO1.TAMANO_VENTANA = parseInt(slider.value);
        // Re-ejecutar paso 1 si ya estaba ejecutado
        if (window.MAR.paso1 && window.MAR.paso1.ejecutado) {
          ejecutarYDebug(ejecutarPaso1, debugPaso1);
        }
      }
      else if (id === 'param-optica-umbral') {
        PARAMS_PASO3.UMBRAL_DENSIDAD = parseInt(slider.value);
        if (window.MAR.paso3 && window.MAR.paso3.ejecutado) {
          ejecutarYDebug(ejecutarPaso3, debugPaso3);
        }
      }
      else if (id === 'param-optica-distV') {
        PARAMS_PASO3.DISTANCIA_MIN_V = parseInt(slider.value);
        if (window.MAR.paso3 && window.MAR.paso3.ejecutado) {
          ejecutarYDebug(ejecutarPaso3, debugPaso3);
        }
      }
      else if (id === 'param-optica-distH') {
        PARAMS_PASO3.DISTANCIA_MIN_H = parseInt(slider.value);
        if (window.MAR.paso3 && window.MAR.paso3.ejecutado) {
          ejecutarYDebug(ejecutarPaso3, debugPaso3);
        }
      }
      else if (id === 'param-optica-cont') {
        PARAMS_PASO3.UMBRAL_CONTINUIDAD = parseInt(slider.value) / 100;
        if (window.MAR.paso3 && window.MAR.paso3.ejecutado) {
          ejecutarYDebug(ejecutarPaso3, debugPaso3);
        }
      }
      else if (id === 'param-eco-contV') {
        PARAMS_PASO4.UMBRAL_CONTRASTE_V = parseInt(slider.value);
        if (window.MAR.paso4 && window.MAR.paso4.ejecutado) {
          ejecutarYDebug(ejecutarPaso4, debugPaso4);
        }
      }
      else if (id === 'param-eco-contH') {
        PARAMS_PASO4.UMBRAL_CONTRASTE = parseInt(slider.value);
        if (window.MAR.paso4 && window.MAR.paso4.ejecutado) {
          ejecutarYDebug(ejecutarPaso4, debugPaso4);
        }
      }
      else if (id === 'param-eco-long') {
        PARAMS_PASO4.LONGITUD_MIN_BORDE = parseInt(slider.value) / 100;
        if (window.MAR.paso4 && window.MAR.paso4.ejecutado) {
          ejecutarYDebug(ejecutarPaso4, debugPaso4);
        }
      }
      else if (id === 'param-espectro-matiz') {
        PARAMS_PASO5.UMBRAL_MATIZ = parseInt(slider.value);
        if (window.MAR.paso5 && window.MAR.paso5.ejecutado) {
          ejecutarYDebug(ejecutarPaso5, debugPaso5);
        }
      }
      else if (id === 'param-espectro-sat') {
        PARAMS_PASO5.UMBRAL_SATURACION = parseInt(slider.value);
        if (window.MAR.paso5 && window.MAR.paso5.ejecutado) {
          ejecutarYDebug(ejecutarPaso5, debugPaso5);
        }
      }
      else if (id === 'param-lidar-tol') {
        PARAMS_PASO6.TOLERANCIA_ALINEACION = parseInt(slider.value);
        if (window.MAR.paso6 && window.MAR.paso6.ejecutado) {
          ejecutarYDebug(ejecutarPaso6, debugPaso6);
        }
      }
      else if (id === 'param-lidar-dist') {
        PARAMS_PASO6.DISTANCIA_AGRUPACION = parseInt(slider.value);
        if (window.MAR.paso6 && window.MAR.paso6.ejecutado) {
          ejecutarYDebug(ejecutarPaso6, debugPaso6);
        }
      }
      else if (id === 'param-lidar-votos') {
        PARAMS_PASO6.VOTOS_MINIMOS = parseInt(slider.value);
        if (window.MAR.paso6 && window.MAR.paso6.ejecutado) {
          ejecutarYDebug(ejecutarPaso6, debugPaso6);
        }
      }
      else if (id === 'param-lidar-peso') {
        PARAMS_PASO6.PESO_PATRON_REGULAR = parseInt(slider.value) / 100;
        if (window.MAR.paso6 && window.MAR.paso6.ejecutado) {
          ejecutarYDebug(ejecutarPaso6, debugPaso6);
        }
      }

      // Persistir en localStorage
      guardarParams();
    });
  });

  // Cargar params guardados
  cargarParams();

  console.log('✅ Sliders conectados');
});

function guardarParams() {
  const params = {
    mediana: { ...PARAMS_PASO1 },
    optica: { ...PARAMS_PASO3 },
    eco: { ...PARAMS_PASO4 },
    espectro: { ...PARAMS_PASO5 },
    lidar: { ...PARAMS_PASO6 }
  };
  localStorage.setItem('marCaribeParams', JSON.stringify(params));
}

function cargarParams() {
  try {
    const saved = localStorage.getItem('marCaribeParams');
    if (!saved) return;
    const p = JSON.parse(saved);

    if (p.mediana) {
      Object.assign(PARAMS_PASO1, p.mediana);
      document.getElementById('param-mediana-ventana').value = PARAMS_PASO1.TAMANO_VENTANA;
      document.getElementById('val-mediana-ventana').textContent = PARAMS_PASO1.TAMANO_VENTANA;
    }
    if (p.optica) {
      Object.assign(PARAMS_PASO3, p.optica);
      document.getElementById('param-optica-umbral').value = PARAMS_PASO3.UMBRAL_DENSIDAD;
      document.getElementById('val-optica-umbral').textContent = PARAMS_PASO3.UMBRAL_DENSIDAD;
      document.getElementById('param-optica-distV').value = PARAMS_PASO3.DISTANCIA_MIN_V;
      document.getElementById('val-optica-distV').textContent = PARAMS_PASO3.DISTANCIA_MIN_V + 'px';
      document.getElementById('param-optica-distH').value = PARAMS_PASO3.DISTANCIA_MIN_H;
      document.getElementById('val-optica-distH').textContent = PARAMS_PASO3.DISTANCIA_MIN_H + 'px';
      document.getElementById('param-optica-cont').value = PARAMS_PASO3.UMBRAL_CONTINUIDAD * 100;
      document.getElementById('val-optica-cont').textContent = Math.round(PARAMS_PASO3.UMBRAL_CONTINUIDAD * 100) + '%';
    }
    if (p.eco) {
      Object.assign(PARAMS_PASO4, p.eco);
      document.getElementById('param-eco-contV').value = PARAMS_PASO4.UMBRAL_CONTRASTE_V;
      document.getElementById('val-eco-contV').textContent = PARAMS_PASO4.UMBRAL_CONTRASTE_V;
      document.getElementById('param-eco-contH').value = PARAMS_PASO4.UMBRAL_CONTRASTE;
      document.getElementById('val-eco-contH').textContent = PARAMS_PASO4.UMBRAL_CONTRASTE;
      document.getElementById('param-eco-long').value = PARAMS_PASO4.LONGITUD_MIN_BORDE * 100;
      document.getElementById('val-eco-long').textContent = Math.round(PARAMS_PASO4.LONGITUD_MIN_BORDE * 100) + '%';
    }
    if (p.espectro) {
      Object.assign(PARAMS_PASO5, p.espectro);
      document.getElementById('param-espectro-matiz').value = PARAMS_PASO5.UMBRAL_MATIZ;
      document.getElementById('val-espectro-matiz').textContent = PARAMS_PASO5.UMBRAL_MATIZ + '°';
      document.getElementById('param-espectro-sat').value = PARAMS_PASO5.UMBRAL_SATURACION;
      document.getElementById('val-espectro-sat').textContent = PARAMS_PASO5.UMBRAL_SATURACION + '%';
    }
    if (p.lidar) {
      Object.assign(PARAMS_PASO6, p.lidar);
      document.getElementById('param-lidar-tol').value = PARAMS_PASO6.TOLERANCIA_ALINEACION;
      document.getElementById('val-lidar-tol').textContent = PARAMS_PASO6.TOLERANCIA_ALINEACION + 'px';
      document.getElementById('param-lidar-dist').value = PARAMS_PASO6.DISTANCIA_AGRUPACION;
      document.getElementById('val-lidar-dist').textContent = PARAMS_PASO6.DISTANCIA_AGRUPACION + 'px';
      document.getElementById('param-lidar-votos').value = PARAMS_PASO6.VOTOS_MINIMOS;
      document.getElementById('val-lidar-votos').textContent = PARAMS_PASO6.VOTOS_MINIMOS;
      document.getElementById('param-lidar-peso').value = PARAMS_PASO6.PESO_PATRON_REGULAR * 100;
      document.getElementById('val-lidar-peso').textContent = Math.round(PARAMS_PASO6.PESO_PATRON_REGULAR * 100) + '%';
    }
  } catch (e) {
    console.error('Error cargando params:', e);
  }
}

function toggleDebug() {
  const content = document.getElementById('debugContent');
  const toggle = document.getElementById('debugToggle');
  if (!content || !toggle) return;
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▼';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▶';
  }
}
