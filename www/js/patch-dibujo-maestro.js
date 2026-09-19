// ==============================================
// MAR Caribe v10.4 - PATCH MAESTRO DE DIBUJO
// ==============================================

window.lineasOpticaH = [];
window.lineasOpticaV = [];
window.lineasEcografiaH = [];
window.lineasEcografiaV = [];
window.lineasA3H = [];
window.lineasA3V = [];
window.lineasLidarH = [];
window.lineasLidarV = [];
window.lineasVisibles = true;

function dibujarTodo() {
  if (!imagenActual) return;

  const fuente = (window.estadoPasos && window.estadoPasos.imagenProcesada)
    ? window.estadoPasos.imagenProcesada
    : imagenActual;

  if (lienzo.width !== fuente.width || lienzo.height !== fuente.height) {
    lienzo.width = fuente.width;
    lienzo.height = fuente.height;
  }

  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(fuente, 0, 0);

  if (window.lineasVisibles) {
    const grosor = 2 / zoom;

    // AMARILLO - Optica
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = grosor;
    window.lineasOpticaH.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasOpticaV.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // ROJO - Ecografia H
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = grosor;
    window.lineasEcografiaH.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });

    // AZUL - Ecografia V
    ctx.strokeStyle = '#0088FF';
    window.lineasEcografiaV.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // MORADO - A3
    ctx.strokeStyle = '#8B5CF6';
    window.lineasA3H.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasA3V.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // NEGRO - LIDAR finales
    if (window.lineasLidarH.length > 0) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = grosor * 1.5;
      window.lineasLidarH.forEach(function(y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(fuente.width, y);
        ctx.stroke();
      });
      window.lineasLidarV.forEach(function(x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fuente.height);
        ctx.stroke();
      });
    }
  }

  ctx.restore();

  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoom.toFixed(1) + 'x';
}

function toggleLineas() {
  window.lineasVisibles = !window.lineasVisibles;
  dibujarTodo();
  const btn = document.getElementById('btnToggleLineas');
  if (btn) btn.textContent = window.lineasVisibles ? '👁️' : '🚫';
  if (typeof log === 'function') {
    log(window.lineasVisibles ? '👁️ Lineas visibles' : '🚫 Lineas ocultas', 'info');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const areaImg = document.querySelector('.area-img');
    if (!areaImg || document.getElementById('btnToggleLineas')) return;

    const btn = document.createElement('button');
    btn.id = 'btnToggleLineas';
    btn.textContent = '👁️';
    btn.style.cssText = 'position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;background:rgba(10,61,98,0.9);color:white;border:none;font-size:1.2rem;cursor:pointer;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    btn.onclick = toggleLineas;
    areaImg.appendChild(btn);
    console.log('✅ Boton de lineas agregado');
  }, 500);
});

console.log('✅ Patch maestro de dibujo cargado');
