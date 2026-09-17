// ============================================
// SLIDERS + FUENTES POR PASO
// ============================================

const VENTANAS_MEDIANA = [1, 3, 5, 7];
const NOMBRES_MEDIANA = ['Sin filtro', 'Suave', 'Medio', 'Fuerte'];

const DEFAULTS = {
  mediana: { INDICE_VENTANA: 0, TAMANO_VENTANA: 1 },
  optica: { UMBRAL_DENSIDAD: 4, DISTANCIA_MIN_V: 22, DISTANCIA_MIN_H: 24, UMBRAL_CONTINUIDAD: 0.55 },
  eco: { UMBRAL_CONTRASTE: 38, UMBRAL_CONTRASTE_V: 42, LONGITUD_MIN_BORDE: 0.15 },
  espectro: { UMBRAL_MATIZ: 20, UMBRAL_SATURACION: 30 },
  lidar: { TOLERANCIA_ALINEACION: 12, DISTANCIA_AGRUPACION: 8, VOTOS_MINIMOS: 2, PESO_PATRON_REGULAR: 0.70 }
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎚️ Conectando sliders y fuentes...');

  // Fuentes por defecto
  window.MAR.fuentes = {
    paso2: 'original',
    paso3: 'original',
    paso4: 'original',
    paso5: 'original',
    paso8: 'filtrada',
    paso9: 'filtrada'
  };

  // Sliders
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valorId = 'val-' + slider.id.replace('param-', '');
    const valorEl = document.getElementById(valorId);
    
    slider.addEventListener('input', () => {
      if (valorEl) actualizarEtiqueta(slider, valorEl);
    });

    slider.addEventListener('change', () => {
      aplicarCambio(slider);
      guardarParams();
    });
  });

  // Botones de fuente
  document.querySelectorAll('.fuente-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const paso = 'paso' + btn.dataset.paso;
      const fuente = btn.dataset.fuente;
      
      // Actualizar visual
      const grupo = btn.parentElement;
      grupo.querySelectorAll('.fuente-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      
      // Actualizar indicador en el botón del paso
      const indicador = document.getElementById('fuente-paso' + btn.dataset.paso);
      if (indicador) indicador.textContent = fuente === 'original' ? '⚪' : '⚫';
      
      // Guardar
      window.MAR.fuentes[paso] = fuente;
      guardarParams();
      
      // Re-ejecutar el paso si ya estaba ejecutado
      const pasoNum = parseInt(btn.dataset.paso);
      if (window.MAR['paso' + pasoNum] && window.MAR['paso' + pasoNum].ejecutado) {
        reejecutarPaso(pasoNum);
      }
      
      console.log('🎯 Fuente paso', pasoNum, '→', fuente);
    });
  });

  // Botones de reset
  document.querySelectorAll('.btn-reset').forEach(btn => {
    btn.addEventListener('click', () => resetearGrupo(btn.dataset.grupo));
  });

  // Botón de ejecutar todo
  document.getElementById('btnEjecutarTodo')?.addEventListener('click', () => {
    if (typeof ejecutarTodo === 'function') ejecutarTodo();
  });

  cargarParams();
  console.log('✅ Sliders y fuentes conectados');
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
  else if (id === 'param-optica-umbral') { PARAMS_PASO3.UMBRAL_DENSIDAD = val; reejecutarPaso(3); }
  else if (id === 'param-optica-distV') { PARAMS_PASO3.DISTANCIA_MIN_V = val; reejecutarPaso(3); }
  else if (id === 'param-optica-distH') { PARAMS_PASO3.DISTANCIA_MIN_H = val; reejecutarPaso(3); }
  else if (id === 'param-optica-cont') { PARAMS_PASO3.UMBRAL_CONTINUIDAD = val / 100; reejecutarPaso(3); }
  else if (id === 'param-eco-contV') { PARAMS_PASO4.UMBRAL_CONTRASTE_V = val; reejecutarPaso(4); }
  else if (id === 'param-eco-contH') { PARAMS_PASO4.UMBRAL_CONTRASTE = val; reejecutarPaso(4); }
  else if (id === 'param-eco-long') { PARAMS_PASO4.LONGITUD_MIN_BORDE = val / 100; reejecutarPaso(4); }
  else if (id === 'param-espectro-matiz') { PARAMS_PASO5.UMBRAL_MATIZ = val; reejecutarPaso(5); }
  else if (id === 'param-espectro-sat') { PARAMS_PASO5.UMBRAL_SATURACION = val; reejecutarPaso(5); }
  else if (id === 'param-lidar-tol') { PARAMS_PASO6.TOLERANCIA_ALINEACION = val; reejecutarPaso(6); }
  else if (id === 'param-lidar-dist') { PARAMS_PASO6.DISTANCIA_AGRUPACION = val; reejecutarPaso(6); }
  else if (id === 'param-lidar-votos') { PARAMS_PASO6.VOTOS_MINIMOS = val; reejecutarPaso(6); }
  else if (id === 'param-lidar-peso') { PARAMS_PASO6.PESO_PATRON_REGULAR = val / 100; reejecutarPaso(6); }
}

function reejecutarPaso(num) {
  if (window.MAR['paso' + num] && window.MAR['paso' + num].ejecutado) {
    ejecutarYDebug(window['ejecutarPaso' + num], window['debugPaso' + num], 'paso' + num);
  }
}

function resetearGrupo(grupo) {
  if (!confirm('¿Resetear ' + grupo + '?')) return;

  if (grupo === 'mediana') {
    Object.assign(PARAMS_PASO1, DEFAULTS.mediana);
    document.getElementById('param-mediana-ventana').value = 0;
    document.getElementById('val-mediana-ventana').textContent = 'Sin filtro (1)';
  } else if (grupo === 'optica') {
    Object.assign(PARAMS_PASO3, DEFAULTS.optica);
    document.getElementById('param-optica-umbral').value = 4;
    document.getElementById('val-optica-umbral').textContent = '4';
    document.getElementById('param-optica-distV').value = 22;
    document.getElementById('val-optica-distV').textContent = '22px';
    document.getElementById('param-optica-distH').value = 24;
    document.getElementById('val-optica-distH').textContent = '24px';
    document.getElementById('param-optica-cont').value = 55;
    document.getElementById('val-optica-cont').textContent = '55%';
  } else if (grupo === 'eco') {
    Object.assign(PARAMS_PASO4, DEFAULTS.eco);
    document.getElementById('param-eco-contV').value = 42;
    document.getElementById('val-eco-contV').textContent = '42';
    document.getElementById('param-eco-contH').value = 38;
    document.getElementById('val-eco-contH').textContent = '38';
    document.getElementById('param-eco-long').value = 15;
    document.getElementById('val-eco-long').textContent = '15%';
  } else if (grupo === 'espectro') {
    Object.assign(PARAMS_PASO5, DEFAULTS.espectro);
    document.getElementById('param-espectro-matiz').value = 20;
    document.getElementById('val-espectro-matiz').textContent = '20°';
    document.getElementById('param-espectro-sat').value = 30;
    document.getElementById('val-espectro-sat').textContent = '30%';
  } else if (grupo === 'lidar') {
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
}

function guardarParams() {
  localStorage.setItem('marCaribeParams', JSON.stringify({
    mediana: { ...PARAMS_PASO1 },
    optica: { ...PARAMS_PASO3 },
    eco: { ...PARAMS_PASO4 },
    espectro: { ...PARAMS_PASO5 },
    lidar: { ...PARAMS_PASO6 },
    fuentes: window.MAR.fuentes
  }));
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
    if (p.optica) Object.assign(PARAMS_PASO3, p.optica);
    if (p.eco) Object.assign(PARAMS_PASO4, p.eco);
    if (p.espectro) Object.assign(PARAMS_PASO5, p.espectro);
    if (p.lidar) Object.assign(PARAMS_PASO6, p.lidar);
    if (p.fuentes) window.MAR.fuentes = p.fuentes;
  } catch (e) { console.error(e); }
}

function toggleDebug() {
  const content = document.getElementById('debugContent');
  const toggle = document.getElementById('debugToggle');
  if (!content || !toggle) return;
  content.style.display = content.style.display === 'none' ? 'block' : 'none';
  toggle.textContent = content.style.display === 'none' ? '▶' : '▼';
}

window.addEventListener('load', () => {
  const slider = document.getElementById('param-mediana-ventana');
  const valEl = document.getElementById('val-mediana-ventana');
  if (slider && valEl) {
    const idx = parseInt(slider.value);
    valEl.textContent = NOMBRES_MEDIANA[idx] + ' (' + VENTANAS_MEDIANA[idx] + ')';
  }
});
