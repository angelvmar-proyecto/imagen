// ===== APP: LECTOR DE TABLAS DESDE IMAGEN =====
const App = {
  paginaActiva: 'seleccion',
  imagenActual: null,
  textoReconocido: '',
  datosTabla: { cabeceras: [], filas: [] },

  init() {
    this.vincularEventos();
    this.navegar('seleccion');
    console.log('🏝️ MAR Caribe — Lector de Tablas inicializado');
  },

  navegar(paginaId) {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
    
    document.getElementById(paginaId).classList.add('activa');
    document.querySelector(`nav button[data-pagina="${paginaId}"]`).classList.add('activo');
    
    this.paginaActiva = paginaId;
  },

  vincularEventos() {
    // Navegación inferior
    document.querySelectorAll('nav button').forEach(btn => {
      btn.addEventListener('click', () => this.navegar(btn.dataset.pagina));
    });

    // Selección de imagen
    document.getElementById('btn-seleccionar').addEventListener('click', () => {
      document.getElementById('input-imagen').click();
    });

    document.getElementById('input-imagen').addEventListener('change', (e) => this.cargarImagen(e));
    document.getElementById('btn-camara').addEventListener('click', () => this.usarCamara());
    document.getElementById('btn-procesar').addEventListener('click', () => this.procesarImagen());

    // Paso 2: Texto
    document.getElementById('btn-convertir-tabla').addEventListener('click', () => this.convertirATabla());
    document.getElementById('btn-volver-imagen').addEventListener('click', () => this.navegar('seleccion'));

    // Paso 3: Tabla
    document.getElementById('btn-copiar-tabla').addEventListener('click', () => this.copiarTabla());
    document.getElementById('btn-compartir-whatsapp').addEventListener('click', () => this.compartirPorWhatsApp());
    document.getElementById('btn-nuevo-proceso').addEventListener('click', () => this.reiniciarProceso());
  },

  // ===== PASO 1: CARGAR IMAGEN =====
  cargarImagen(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      this.mostrarEstado('estado-seleccion', '❌ El archivo seleccionado no es una imagen', 'error');
      return;
    }

    const lector = new FileReader();
    lector.onload = (e) => {
      this.imagenActual = e.target.result;
      document.getElementById('imagen-preview').src = this.imagenActual;
      document.getElementById('vista-previa').classList.remove('oculto');
      document.getElementById('btn-procesar').classList.remove('oculto');
      this.mostrarEstado('estado-seleccion', '✅ Imagen cargada correctamente', 'exito');
    };
    lector.readAsDataURL(archivo);
  },

  usarCamara() {
    this.mostrarEstado('estado-seleccion', '📷 Abriendo cámara... Toma la foto y confirma', 'info');
    // En Capacitor real usaríamos: Capacitor.Camera.getPhoto()
    // Por ahora abrimos selector de archivo que incluye cámara en Android
    document.getElementById('input-imagen').click();
  },

  // ===== PASO 2: PROCESAR IMAGEN → TEXTO =====
  procesarImagen() {
    if (!this.imagenActual) {
      this.mostrarEstado('estado-seleccion', '⚠️ Primero selecciona una imagen', 'alerta');
      return;
    }

    this.navegar('texto');
    this.mostrarEstado('estado-texto', '🔍 Analizando imagen y leyendo texto...', 'info');
    this.mostrarProgreso(150, () => {
      // === SIMULACIÓN DE OCR — Aquí se integrará Tesseract.js después ===
      this.textoReconocido = this.simularLecturaOCR();
      document.getElementById('texto-reconocido').value = this.textoReconocido;
      this.mostrarEstado('estado-texto', '✅ Texto extraído correctamente', 'exito');
    });
  },

  simularLecturaOCR() {
    // Esto simula lo que leería Tesseract.js de una tabla real
    return `FECHA        | NOMBRE          | HAB | ENTRADA    | SALIDA     | PAX | TOTAL
-------------|-----------------|-----|------------|------------|-----|-----------
09/08/2026   | Pérez Juan      | 302 | 09/10/2026 | 09/15/2026 | 4   | $12,450.00
09/08/2026   | López María     | 405 | 09/12/2026 | 09/18/2026 | 2   | $8,900.00
09/08/2026   | García Carlos   | 201 | 09/15/2026 | 09/20/2026 | 3   | $9,600.00
09/08/2026   | Ana Martínez    | 510 | 10/01/2026 | 10/07/2026 | 5   | $18,200.00`;
  },

  // ===== PASO 3: CONVERTIR TEXTO → TABLA =====
  convertirATabla() {
    const texto = document.getElementById('texto-reconocido').value;
    if (!texto.trim()) {
      this.mostrarEstado('estado-texto', '⚠️ No hay texto para convertir', 'alerta');
      return;
    }

    this.textoReconocido = texto;
    this.navegar('tabla');
    this.mostrarEstado('estado-tabla', '📊 Convirtiendo a tabla estructurada...', 'info');

    // Parsear el texto reconociendo separadores | o espacios
    const lineas = texto.trim().split('\n').filter(l => l.trim() && !l.includes('---'));
    
    if (lineas.length === 0) {
      this.mostrarEstado('estado-tabla', '❌ No se encontraron datos en el texto', 'error');
      return;
    }

    // Primera línea = cabeceras
    this.datosTabla.cabeceras = this.parsearFila(lineas[0]);
    
    // Resto de líneas = filas
    this.datosTabla.filas = lineas.slice(1).map(fila => this.parsearFila(fila));

    this.renderizarTabla();
    this.mostrarEstado('estado-tabla', `✅ Tabla generada: ${this.datosTabla.filas.length} filas`, 'exito');
  },

  parsearFila(textoFila) {
    // Reconocer separador: | o múltiples espacios
    if (textoFila.includes('|')) {
      return textoFila.split('|').map(c => c.trim()).filter(c => c !== '');
    } else {
      // Para formato con espacios — detecta columnas por múltiples espacios
      return textoFila.split(/\s{2,}/).map(c => c.trim()).filter(c !== '');
    }
  },

  renderizarTabla() {
    // Cabecera
    const elCabecera = document.getElementById('tabla-cabecera');
    elCabecera.innerHTML = '<tr>' + 
      this.datosTabla.cabeceras.map(c => `<th>${c}</th>`).join('') + 
    '</tr>';

    // Cuerpo
    const elCuerpo = document.getElementById('tabla-cuerpo');
    elCuerpo.innerHTML = this.datosTabla.filas.map(fila => 
      '<tr>' + fila.map(celda => `<td>${celda}</td>`).join('') + '</tr>'
    ).join('');
  },

  // ===== ACCIONES FINALES =====
  copiarTabla() {
    const textoTabla = this.generarTextoTabla();
    navigator.clipboard.writeText(textoTabla)
      .then(() => this.mostrarEstado('estado-tabla', '✅ ¡Tabla copiada al portapapeles!', 'exito'))
      .catch(() => this.mostrarEstado('estado-tabla', '❌ No se pudo copiar', 'error'));
  },

  compartirPorWhatsApp() {
    const textoTabla = this.generarTextoTabla();
    const mensaje = encodeURIComponent('🏝️ MAR Caribe — Tabla Convertida\n\n' + textoTabla);
    const url = `https://wa.me/?text=${mensaje}`;
    
    this.mostrarEstado('estado-tabla', '💬 Abriendo WhatsApp...', 'exito');
    
    if (window.Capacitor?.Browser) {
      Capacitor.Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  },

  generarTextoTabla() {
    let texto = '🏝️ MAR Caribe — Tabla Convertida\n';
    texto += 'Fecha de procesamiento: ' + new Date().toLocaleString() + '\n\n';
    
    // Cabeceras
    texto += this.datosTabla.cabeceras.join(' | ') + '\n';
    texto += '-'.repeat(40) + '\n';
    
    // Filas
    this.datosTabla.filas.forEach(fila => {
      texto += fila.join(' | ') + '\n';
    });
    
    return texto;
  },

  reiniciarProceso() {
    this.imagenActual = null;
    this.textoReconocido = '';
    this.datosTabla = { cabeceras: [], filas: [] };
    
    document.getElementById('input-imagen').value = '';
    document.getElementById('vista-previa').classList.add('oculto');
    document.getElementById('btn-procesar').classList.add('oculto');
    document.getElementById('texto-reconocido').value = '';
    document.getElementById('tabla-cabecera').innerHTML = '';
    document.getElementById('tabla-cuerpo').innerHTML = '';
    
    this.navegar('seleccion');
  },

  // ===== UTILIDADES =====
  mostrarEstado(idElemento, mensaje, tipo = 'info') {
    const el = document.getElementById(idElemento);
    if (!el) return;
    el.className = `estado estado-${tipo} visible`;
    el.textContent = mensaje;
    clearTimeout(this._timeoutEstado);
    this._timeoutEstado = setTimeout(() => el.classList.remove('visible'), 6000);
  },

  mostrarProgreso(ms, callback) {
    const barra = document.getElementById('barra-progreso');
    const progreso = document.getElementById('progreso');
    barra.classList.remove('oculto');
    progreso.style.width = '0%';
    
    let pct = 0;
    const intervalo = setInterval(() => {
      pct += 100 / (ms / 100);
      if (pct >= 100) {
        pct = 100;
        clearInterval(intervalo);
        setTimeout(() => {
          barra.classList.add('oculto');
          progreso.style.width = '0%';
          callback();
        }, 300);
      }
      progreso.style.width = pct + '%';
    }, 100);
  }
};

// Iniciar app
document.addEventListener('DOMContentLoaded', () => App.init());
</script>

