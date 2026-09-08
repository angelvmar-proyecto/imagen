// Estado global
const App = {
  paginaActiva: 'dashboard',
  datos: {
    reservas: [],
    escaneos: [],
    ultimoMensaje: null
  },

  init() {
    this.navegar('dashboard');
    this.cargarReservas();
    this.vincularEventos();
    console.log('🏝️ MAR Caribe — App inicializada');
  },

  navegar(paginaId) {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
    
    document.getElementById(paginaId).classList.add('activa');
    document.querySelector(`[data-pagina="${paginaId}"]`).classList.add('activo');
    
    this.paginaActiva = paginaId;
  },

  vincularEventos() {
    // Navegación
    document.querySelectorAll('nav button').forEach(btn => {
      btn.addEventListener('click', () => this.navegar(btn.dataset.pagina));
    });

    // Botones Dashboard
    document.getElementById('btn-escaneo')?.addEventListener('click', () => this.navegar('ocr'));
    document.getElementById('btn-whatsapp')?.addEventListener('click', () => this.navegar('compartir'));

    // Botones OCR
    document.getElementById('btn-camara')?.addEventListener('click', () => this.escanearCamara());
    document.getElementById('btn-archivo')?.addEventListener('click', () => this.seleccionarArchivo());
    document.getElementById('btn-procesar')?.addEventListener('click', () => this.procesarOCR());

    // Botones Compartir
    document.getElementById('btn-enviar-whatsapp')?.addEventListener('click', () => this.enviarWhatsApp());
    document.getElementById('btn-copiar')?.addEventListener('click', () => this.copiarMensaje());

    // Formulario Reserva
    document.getElementById('form-reserva')?.addEventListener('submit', e => {
      e.preventDefault();
      this.guardarReserva();
    });
  },

  // ===== DASHBOARD =====
  cargarReservas() {
    const guardadas = localStorage.getItem('marcaribe_reservas');
    if (guardadas) this.datos.reservas = JSON.parse(guardadas);
    this.actualizarTablaReservas();
  },

  guardarReserva() {
    const reserva = {
      id: Date.now(),
      nombre: document.getElementById('res-nombre').value,
      fecha: document.getElementById('res-fecha').value,
      personas: document.getElementById('res-personas').value,
      estado: document.getElementById('res-estado').value,
      notas: document.getElementById('res-notas').value,
      creado: new Date().toLocaleString()
    };

    if (!reserva.nombre || !reserva.fecha) {
      this.mostrarEstado('estado-dashboard', 'Por favor completa nombre y fecha', 'alerta');
      return;
    }

    this.datos.reservas.unshift(reserva);
    localStorage.setItem('marcaribe_reservas', JSON.stringify(this.datos.reservas));
    
    document.getElementById('form-reserva').reset();
    this.actualizarTablaReservas();
    this.mostrarEstado('estado-dashboard', '✅ Reserva guardada correctamente', 'exito');
  },

  actualizarTablaReservas() {
    const tabla = document.getElementById('tabla-reservas');
    if (!tabla) return;
    
    tabla.innerHTML = this.datos.reservas.map(r => `
      <tr>
        <td>${r.nombre}</td>
        <td>${r.fecha}</td>
        <td>${r.personas}</td>
        <td><span style="color:${r.estado==='Confirmada'?'#22c55e':'#f59e0b'}">${r.estado}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Sin reservas registradas</td></tr>';
  },

  // ===== OCR / ESCANEO =====
  escanearCamara() {
    this.mostrarEstado('estado-ocr', '📷 Accediendo a la cámara...', 'info');
    this.simularProgreso(80, () => {
      document.getElementById('ocr-texto').value = 
        '=== ESCANEADO DESDE CÁMARA ===\n' +
        'Fecha: ' + new Date().toLocaleString() + '\n' +
        'Cliente: Pérez López, Juan\n' +
        'Habitación: 302\n' +
        'Entrada: 2026-09-10 | Salida: 2026-09-15\n' +
        'Personas: 4 | Adultos: 2 | Menores: 2\n' +
        'Total: $12,450.00 MXN\n' +
        'Estado: Confirmada ✅';
      this.mostrarEstado('estado-ocr', '✅ Imagen capturada y procesada', 'exito');
    });
  },

  seleccionarArchivo() {
    this.mostrarEstado('estado-ocr', '📂 Seleccionando imagen...', 'info');
    this.simularProgreso(60, () => {
      document.getElementById('ocr-texto').value = 
        '=== ARCHIVO CARGADO ===\n' +
        'Fuente: Galería / Archivo local\n' +
        'Fecha: ' + new Date().toLocaleString() + '\n' +
        'Reserva #8872 | Cliente: Martínez Ana\n' +
        'Periodo: 2026-10-01 al 2026-10-07\n' +
        'Semanas: 1 | Tipo: Gold\n' +
        'Monto: $18,200.00 MXN';
      this.mostrarEstado('estado-ocr', '✅ Archivo procesado correctamente', 'exito');
    });
  },

  procesarOCR() {
    const texto = document.getElementById('ocr-texto').value;
    if (!texto) {
      this.mostrarEstado('estado-ocr', '⚠️ No hay texto para procesar', 'alerta');
      return;
    }
    this.mostrarEstado('estado-ocr', '🔍 Analizando tablas y datos...', 'info');
    this.simularProgreso(100, () => {
      this.datos.ultimoMensaje = texto;
      this.mostrarEstado('estado-ocr', '✅ Datos extraídos y listos para compartir', 'exito');
    });
  },

  // ===== COMPARTIR / WHATSAPP =====
  enviarWhatsApp() {
    const texto = document.getElementById('mensaje-texto').value || this.datos.ultimoMensaje;
    if (!texto) {
      this.mostrarEstado('estado-compartir', '⚠️ No hay mensaje para enviar', 'alerta');
      return;
    }

    const numero = document.getElementById('whatsapp-numero').value.replace(/\D/g, '');
    if (!numero || numero.length < 10) {
      this.mostrarEstado('estado-compartir', '⚠️ Ingresa un número válido', 'alerta');
      return;
    }

    const mensaje = encodeURIComponent('🏝️ MAR Caribe — Datos de Reserva\n\n' + texto);
    const url = `https://wa.me/52${numero}?text=${mensaje}`;
    
    this.mostrarEstado('estado-compartir', '🔗 Abriendo WhatsApp...', 'exito');
    
    // En Capacitor abre en navegador; en móvil abre WhatsApp directo
    if (window.Capacitor?.Browser) {
      Capacitor.Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  },

  copiarMensaje() {
    const texto = document.getElementById('mensaje-texto').value || this.datos.ultimoMensaje;
    if (!texto) {
      this.mostrarEstado('estado-compartir', '⚠️ No hay texto para copiar', 'alerta');
      return;
    }

    navigator.clipboard.writeText('🏝️ MAR Caribe\n\n' + texto)
      .then(() => this.mostrarEstado('estado-compartir', '✅ ¡Mensaje copiado al portapapeles!', 'exito'))
      .catch(() => this.mostrarEstado('estado-compartir', '❌ No se pudo copiar', 'error'));
  },

  // ===== UTILIDADES =====
  mostrarEstado(idElemento, mensaje, tipo = 'info') {
    const el = document.getElementById(idElemento);
    if (!el) return;
    el.className = `estado estado-${tipo} visible`;
    el.textContent = mensaje;
    setTimeout(() => el.classList.remove('visible'), 5000);
  },

  simularProgreso(segundos, callback) {
    const barra = document.getElementById('barra-progreso');
    const progreso = document.getElementById('progreso');
    if (barra) barra.classList.remove('oculto');
    let pct = 0;
    const intervalo = setInterval(() => {
      pct += 100 / (segundos * 10);
      if (pct >= 100) {
        pct = 100;
        clearInterval(intervalo);
        setTimeout(() => {
          if (barra) barra.classList.add('oculto');
          progreso.style.width = '0%';
          callback();
        }, 300);
      }
      progreso.style.width = pct + '%';
    }, 100);
  }
};

// Iniciar app al cargar
document.addEventListener('DOMContentLoaded', () => App.init());
</script>

