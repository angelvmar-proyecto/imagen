// ============================================
// SLIDERS - Re-ejecuta el paso al soltar
// ============================================

const VENTANAS_MEDIANA = [1, 3, 5, 7];
const NOMBRES_MEDIANA = ['Sin filtro', 'Suave', 'Medio', 'Fuerte'];

// Valores por defecto para reset
const DEFAULTS = {
  mediana: { INDICE_VENTANA: 0 },
  optica: { UMBRAL_DENSIDAD: 4, DISTANCIA_MIN_V: 22, DISTANCIA_MIN_H: 24, UMBRAL_CONTINUIDAD: 0.55 },
  eco: { UMBRAL_CONTRASTE: 38, UMBRAL_CONTRASTE_V: 42, LONGITUD_MIN_BORDE: 0.15 },
  espectro: { UMBRAL_MATIZ: 20, UMBRAL_SATURACION: 30 },
  lidar: { TOLERANCIA_ALINEACION: 12, DISTANCIA_AGRUPACION: 8, VOTOS_MINIMOS: 2, PESO_PATRON_REGULAR: 0.70 }
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎚️ Conectando sliders...');

  const sliders = document.querySelectorAll('input[type="range"]');
  sliders.forEach(slider => {
    const valorId = 'val-' + slider.id.replace('param-', '');
    const valorEl = document.getElementById(valorId);
    
    slider.addEventListener('input', () => {
      if (valorEl) {
        actualizarEtiqueta(slider, valorEl);
      }
    });

    slider.addEventListener('change', () => {
      aplicarCambio(slider);
      guardarParams();
    });
  });

  // Conectar botones de reset
  document.querySelectorAll('.btn-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      const grupo = btn.dataset.grupo;
      resetearGrupo(grupo);
    });
  });

  cargarParams();
  console.log('✅ Sliders conectados');
});

function actualizarEtiqueta(slider, valorEl) {
  const id = slider.id;
  const val = parseInt(slider.value);
  
  if (id === 'param-mediana-ventana') {
    valorEl.textContent = NOMBRES_MEDIANA[val] + ' (' + VENTANAS_MEDIANA[val] + ')';
    return;
  }
  
  let sufijo = '';
  if (id.includes('cont') || id.includes('long') || id.includes('sat') || id.includes('peso')) sufijo = '%';
  else if (id.includes('matiz')) sufijo = '°';
  else if (id.includes('tol') || id.includes('dist')) sufijo = 'px';
  
  valorEl.textContent = val + sufijo;
}

function aplicarCambio(slider) {
  const id = slider.id;
  const val = parseInt(slider.value);

  if (id === 'param-mediana-ventana') {
    PARAMS_PASO1.INDICE_VENTANA = val;
    PARAMS_PASO1.TAMANO_VENTANA = VENTANAS_MEDIANA[val];
    if (window.MAR.paso1 && window.MAR.paso1.ejecutado) {
      ejecutarYDebug(ejecutarPaso1, debugPaso1, 'paso1');
    }
  }
  else if (id === 'param-optica-umbral') {
    PARAMS_PASO3.UMBRAL_DENSIDAD = val;
    if (window.MAR.paso3 && window.MAR.paso3.ejecutado) ejecutarYDebug(ejecutarPaso3, debugPaso3, 'paso3');
  }
  else if (id === 'param-optica-distV') {
    PARAMS_PASO3.DISTANCIA_MIN_V = val;
    if (window.MAR.paso3 && window.MAR.paso3.ejecutado) ejecutarYDebug(ejecutarPaso3, debugPaso3, 'paso3');
  }
  else if (id === 'param-optica-distH') {
    PARAMS_PASO3.DISTANCIA_MIN_H = val;
    if (window.MAR.paso3 && window.MAR.paso3.ejecutado) ejecutarYDebug(ejecutarPaso3, debugPaso3, 'paso3');
  }
  else if (id === 'param-optica-cont') {
    PARAMS_PASO3.UMBRAL_CONTINUIDAD = val / 100;
    if (window.MAR.paso3 && window.MAR.paso3.ejecutado) ejecutarYDebug(ejecutarPaso3, debugPaso3, 'paso3');
  }
  else if (id === 'param-eco-contV') {
    PARAMS_PASO4.UMBRAL_CONTRASTE_V = val;
    if (window.MAR.paso4 && window.MAR.paso4.ejecutado) ejecutarYDebug(ejecutarPaso4, debugPaso4, 'paso4');
  }
  else if (id === 'param-eco-contH') {
    PARAMS_PASO4.UMBRAL_CONTRASTE = val;
    if (window.MAR.paso4 && window.MAR.paso4.ejecutado) ejecutarYDebug(ejecutarPaso4, debugPaso4, 'paso4');
  }
  else if (id === 'param-eco-long') {
    PARAMS_PASO4.LONGITUD_MIN_BORDE = val / 100;
    if (window.MAR.paso4 && window.MAR.paso4.ejecutado) ejecutarYDebug(ejecutarPaso4, debugPaso4, 'paso4');
  }
  else if (id === 'param-espectro-matiz') {
    PARAMS_PASO5.UMBRAL_MATIZ = val;
    if (window.MAR.paso5 && window.MAR.paso5.ejecutado) ejecutarYDebug(ejecutarPaso5, debugPaso5, 'paso5');
  }
  else if (id === 'param-espectro-sat') {
    PARAMS_PASO5.UMBRAL_SATURACION = val;
    if (window.MAR.paso5 && window.MAR.paso5.ejecutado) ejecutarYDebug(ejecutarPaso5, debugPaso5, 'paso5');
  }
  else if (id === 'param-lidar-tol') {
    PARAMS_PASO6.TOLERANCIA_ALINEACION = val;
    if (window.MAR.paso6 && window.MAR.paso6.ejecutado) ejecutarYDebug(ejecutarPaso6, debugPaso6, 'paso6');
  }
  else if (id === 'param-lidar-dist') {
    PARAMS_PASO6.DISTANCIA_AGRUPACION = val;
    if (window.MAR.paso6 && window.MAR.paso6.ejecutado) ejecutarYDebug(ejecutarPaso6, debugPaso6, 'paso6');
  }
  else if (id === 'param-lidar-votos') {
    PARAMS_PASO6.VOTOS_MINIMOS = val;
    if (window.MAR.paso6 && window.MAR.paso6.ejecutado) ejecutarYDebug(ejecutarPaso6, debugPaso6, 'paso6');
  }
  else if (id === 'param-lidar-peso') {
    PARAMS_PASO6.PESO_PATRON_REGULAR = val / 100;
    if (window.MAR.paso6 && window.MAR.paso6.ejecutado) ejecutarYDebug(ejecutarPaso6, debugPaso6, 'paso6');
  }
}

function resetearGrupo(grupo) {
  if (!confirm('¿Resetear los parámetros de ' + grupo + '?')) return;

  if (grupo === 'mediana') {
    Object.assign(PARAMS_PASO1, DEFAULTS.mediana);
    document.getElementById('param-mediana-ventana').value = 0;
    document.getElementById('val-mediana-ventana').textContent = 'Sin filtro (1)';
  }
  else if (grupo === 'optica') {
    Object.assign(PARAMS_PASO3, DEFAULTS.optica);
    document.getElementById('param-optica-umbral').value = 4;
    document.getElementById('val-optica-umbral').textContent = '4';
    document.getElementById('param-optica-distV').value = 22;
    document.getElementById('val-optica-distV').textContent = '22px';
    document.getElementById('param-optica-distH').value = 24;
    document.getElementById('val-optica-distH').textContent = '24px';
    document.getElementById('param-optica-cont').value = 55;
    document.getElementById('val-optica-cont').textContent = '55%';
  }
  else if (grupo === 'eco') {
    Object.assign(PARAMS_PASO4, DEFAULTS.eco);
    document.getElementById('param-eco-contV').value = 42;
    document.getElementById('val-eco-contV').textContent = '42';
    document.getElementById('param-eco-contH').value = 38;
    document.getElementById('val-eco-contH').textContent = '38';
    document.getElementById('param-eco-long').value = 15;
    document.getElementById('val-eco-long').textContent = '15%';
  }
  else if (grupo === 'espectro') {
    Object.assign(PARAMS_PASO5, DEFAULTS.espectro);
    document.getElementById('param-espectro-matiz').value = 20;
    document.getElementById('val-espectro-matiz').textContent = '20°';
    document.getElementById('param-espectro-sat').value = 30;
    document.getElementById('val-espectro-sat').textContent = '30%';
  }
  else if (grupo === 'lidar') {
    Object.assign(PARAMS_PASO6, DEFAULTS.lidar);
    document.getElementById('param-lidar-tol').value = 12;
    document.getElementById('val-lidar-tol').textContent = '12px';
    document.getElementById('param-lidar-dist').value = 8;
    document.getElementById('val-lidar-dist').textContent = '8px';
    document.getElementById('param-lidar-votos').value = 2;
    document.getElementById('val-lidar-votos').textContent = '2';
    document.getElementById('param-lidar-peso').value = 70;
    document.getElementById('val-lidar-peso').textContent = '70%';
  }

  guardarParams();
  alert('✅ Parámetros reseteados');
}

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
      document.getElementById('param-mediana-ventana').value = PARAMS_PASO1.INDICE_VENTANA;
      document.getElementById('val-mediana-ventana').textContent = 
        NOMBRES_MEDIANA[PARAMS_PASO1.INDICE_VENTANA] + ' (' + VENTANAS_MEDIANA[PARAMS_PASO1.INDICE_VENTANA] + ')';
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

// Inicializar etiqueta de mediana
window.addEventListener('load', () => {
  const slider = document.getElementById('param-mediana-ventana');
  const valEl = document.getElementById('val-mediana-ventana');
  if (slider && valEl) {
    const idx = parseInt(slider.value);
    valEl.textContent = NOMBRES_MEDIANA[idx] + ' (' + VENTANAS_MEDIANA[idx] + ')';
  }
});
