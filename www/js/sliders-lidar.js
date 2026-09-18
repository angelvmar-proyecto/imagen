// ============================================
// SLIDERS LIDAR EN VIVO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎚️ Conectando sliders LIDAR...');

  const btnAjustes = document.getElementById('btnAjustesFlotante');
  const panel = document.getElementById('panelLidar');
  const btnCerrar = document.getElementById('btnCerrarPanel');

  const sliderVotos = document.getElementById('sliderVotos');
  const sliderDistancia = document.getElementById('sliderDistancia');
  const sliderTolerancia = document.getElementById('sliderTolerancia');
  const togglePatron = document.getElementById('togglePatron');
  const btnRedetectar = document.getElementById('btnRedetectarLidar');

  const valVotos = document.getElementById('valVotos');
  const valDistancia = document.getElementById('valDistancia');
  const valTolerancia = document.getElementById('valTolerancia');

  // Abrir/cerrar panel
  if (btnAjustes) {
    btnAjustes.addEventListener('click', () => {
      panel.classList.add('abierto');
    });
  }
  if (btnCerrar) {
    btnCerrar.addEventListener('click', () => {
      panel.classList.remove('abierto');
    });
  }

  // Slider votos
  if (sliderVotos) {
    sliderVotos.addEventListener('input', () => {
      const val = parseInt(sliderVotos.value);
      valVotos.textContent = val;
      PARAMS_PASO6.VOTOS_MINIMOS = val;
    });
  }

  // Slider distancia
  if (sliderDistancia) {
    sliderDistancia.addEventListener('input', () => {
      const val = parseInt(sliderDistancia.value);
      valDistancia.textContent = val + 'px';
      PARAMS_PASO6.AGRUPAR_DIST = val;
    });
  }

  // Slider tolerancia
  if (sliderTolerancia) {
    sliderTolerancia.addEventListener('input', () => {
      const val = parseInt(sliderTolerancia.value);
      valTolerancia.textContent = val + 'px';
      PARAMS_PASO6.TOLERANCIA = val;
    });
  }

  // Toggle patrón regular
  if (togglePatron) {
    togglePatron.addEventListener('click', () => {
      const activo = togglePatron.classList.toggle('activo');
      togglePatron.textContent = activo ? '✓ ON' : '✗ OFF';
      PARAMS_PASO6.USAR_PATRON = activo;
    });
  }

  // Botón redetectar
  if (btnRedetectar) {
    btnRedetectar.addEventListener('click', async () => {
      console.log('🔄 Redetectando LIDAR con:', {
        votos: PARAMS_PASO6.VOTOS_MINIMOS,
        distancia: PARAMS_PASO6.AGRUPAR_DIST,
        tolerancia: PARAMS_PASO6.TOLERANCIA,
        patron: PARAMS_PASO6.USAR_PATRON
      });

      if (window.MAR.paso6) {
        window.MAR.paso6.ejecutado = false;
      }

      try {
        await ejecutarPaso6();
        const dbg = debugPaso6();
        mostrarDebug(dbg);
        actualizarEstadoBoton('paso6', true, false);
      } catch (e) {
        mostrarDebug('❌ Error: ' + e.message);
        actualizarEstadoBoton('paso6', false, true);
      }
    });
  }

  console.log('✅ Sliders LIDAR conectados');
});
