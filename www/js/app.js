let rutaImagenActual = null;
let matrizDatos = [];
let porcentajesCorte = [];

const ESQUEMA_20_COLUMNAS = [
  { id: 'No', tipo: 'numero' }, { id: 'Tipo', tipo: 'int_lat' },
  { id: 'Nivel', tipo: 'nivel' }, { id: 'Nombre', tipo: 'texto' },
  { id: 'Puesto/Op', tipo: 'texto' }, { id: 'Hotel', tipo: 'texto' },
  { id: 'Promotor', tipo: 'texto' }, { id: 'Hora Pick Up', tipo: 'hora' },
  { id: 'Monto/Factor', tipo: 'decimal' }, { id: 'Fecha', tipo: 'fecha' },
  { id: 'Folio', tipo: 'texto' }, { id: 'Depósito', tipo: 'texto' },
  { id: 'Monto Dep.', tipo: 'numero' }, { id: 'Moneda', tipo: 'moneda' },
  { id: 'País/Ciudad', tipo: 'texto' }, { id: 'Notas', tipo: 'texto' },
  { id: 'Edad', tipo: 'numero' }, { id: 'Estado Civil', tipo: 'marital' },
  { id: 'Locación', tipo: 'texto' }, { id: 'Horario Cierre', tipo: 'hora' }
];

const NIVELES_MAR = ['PREMIER T3A', 'PREMIER T3B', 'PREMIER T4A', 'PREMIER T4B', 'T2A-CH', 'T2B-CH'];

function setProgreso(porcentaje, pasoTexto) {
  const wrapper = document.getElementById('progressWrapper');
  if (wrapper) wrapper.style.display = 'block';
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = `${porcentaje}%`;
  const step = document.getElementById('progressStep');
  if (step) step.innerText = pasoTexto;
  const pct = document.getElementById('progressPercent');
  if (pct) pct.innerText = `${porcentaje}%`;
  const st = document.getElementById('statusText');
  if (st) st.innerText = `[${porcentaje}%] ${pasoTexto}`;
}

function ocultarProgreso() {
  const wrapper = document.getElementById('progressWrapper');
  if (wrapper) wrapper.style.display = 'none';
  const st = document.getElementById('statusText');
  if (st) st.innerText = "Listo.";
}

async function capturarImagen() {
  try {
    const Camera = window.Capacitor?.Plugins?.Camera;
    if (Camera) {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri',
        source: 'PROMPT'
      });
      let path = photo.webPath;
      if (window.Capacitor?.convertFileSrc && photo.path) {
        path = window.Capacitor.convertFileSrc(photo.path);
      }
      cargarEnCanvas(path);
    } else {
      document.getElementById('fileInput').click();
    }
  } catch (e) {
    document.getElementById('fileInput').click();
  }
}

function cargarDesdeInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => cargarEnCanvas(e.target.result);
  reader.readAsDataURL(file);
}

function cargarEnCanvas(src) {
  rutaImagenActual = src;
  const img = document.getElementById('imgPreview');
  if (img) {
    img.src = src;
    img.onload = () => {
      inicializarRejilla();
      const st = document.getElementById('statusText');
      if (st) st.innerText = "Imagen cargada. Rejilla lista.";
    };
  }
}

function inicializarRejilla() {
  const img = document.getElementById('imgPreview');
  const canvas = document.getElementById('gridCanvas');
  if (!img || !canvas || !img.naturalWidth) return;
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  
  if (porcentajesCorte.length === 0) {
    for (let i = 1; i <= 19; i++) porcentajesCorte.push(Number((i / 20).toFixed(3)));
  }
  dibujarLineas();
}

function dibujarLineas() {
  const canvas = document.getElementById('gridCanvas');
  const img = document.getElementById('imgPreview');
  if (!canvas || !img || !img.naturalWidth) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#d97706';

  porcentajesCorte.forEach(pct => {
    let x = Math.floor(pct * canvas.width) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  });
}

function resetRejilla() {
  porcentajesCorte = [];
  for (let i = 1; i <= 19; i++) porcentajesCorte.push(Number((i / 20).toFixed(3)));
  const canvas = document.getElementById('gridCanvas');
  const img = document.getElementById('imgPreview');
  if (img && img.naturalWidth) {
    dibujarLineas();
  } else if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function obtenerCanvasProcesado() {
  const imgElement = document.getElementById('imgPreview');
  if (!imgElement || !imgElement.naturalWidth) return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0);

  const applyLowPass = document.getElementById('lowPassToggle')?.checked;
  if (applyLowPass) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const src = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    const tempGray = new Float32Array(width * height);

    for (let i = 0; i < src.length; i += 4) {
      tempGray[i / 4] = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
    }

    const dst = src;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += tempGray[ny * width + nx];
              count++;
            }
          }
        }
        let avg = sum / count;
        let idx = (y * width + x) * 4;
        dst[idx] = dst[idx+1] = dst[idx+2] = avg >= 130 ? 255 : 0;
        dst[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

async function autoAlinearHibrida() {
  if (!rutaImagenActual) { alert("Carga una imagen primero."); return; }
  setProgreso(10, "Analizando distribución de texto...");

  try {
    const canvasElement = obtenerCanvasProcesado();
    const worker = await Tesseract.createWorker('spa');

    setProgreso(40, "Mapeando coordenadas X de palabras...");
    const { data } = await worker.recognize(canvasElement);
    await worker.terminate();

    if (!data || !data.words || data.words.length < 10) {
      alert("No se detectó suficiente texto para calcular las columnas.");
      ocultarProgreso();
      return;
    }

    const widthImg = canvasElement.width;
    let centrosX = data.words
      .filter(w => w.confidence > 40 && w.text.trim().length > 0)
      .map(w => (w.bbox.x0 + w.bbox.x1) / 2);

    setProgreso(70, "Calculando fronteras de columnas...");

    let clusters = inicializarClusters(centrosX, 20);
    for (let i = 0; i < 12; i++) {
      clusters = asignarYActualizarClusters(centrosX, clusters);
    }

    let centrosValidos = clusters
      .filter(c => c.puntos.length > 0)
      .map(c => c.centro)
      .sort((a, b) => a - b);

    let nuevosCortes = [];
    for (let i = 0; i < centrosValidos.length - 1; i++) {
      let corte = (centrosValidos[i] + centrosValidos[i+1]) / 2;
      nuevosCortes.push(Number((corte / widthImg).toFixed(3)));
    }

    if (nuevosCortes.length > 0) {
      porcentajesCorte = nuevosCortes;
      dibujarLineas();
    }
    
    const st = document.getElementById('statusText');
    if (st) st.innerText = `Rejilla alineada (${centrosValidos.length} columnas activas).`;
    ocultarProgreso();

  } catch (err) {
    console.error(err);
    alert("Error en alineación: " + (err.message || err));
    ocultarProgreso();
  }
}

function inicializarClusters(datos, k) {
  datos.sort((a, b) => a - b);
  let clusters = [];
  let step = Math.floor(datos.length / k);
  for (let i = 0; i < k; i++) {
    clusters.push({ centro: datos[Math.min(i * step, datos.length - 1)], puntos: [] });
  }
  return clusters;
}

function asignarYActualizarClusters(datos, clusters) {
  clusters.forEach(c => c.puntos = []);
  datos.forEach(d => {
    let cercano = clusters[0];
    let minDist = Math.abs(d - clusters[0].centro);
    for (let i = 1; i < clusters.length; i++) {
      let dist = Math.abs(d - clusters[i].centro);
      if (dist < minDist) {
        minDist = dist;
        cercano = clusters[i];
      }
    }
    cercano.puntos.push(d);
  });
  
  return clusters.map(c => {
    if (c.puntos.length === 0) return c;
    let suma = c.puntos.reduce((a, b) => a + b, 0);
    return { centro: suma / c.puntos.length, puntos: [] };
  });
}

async function ejecutarEscaneoConFiltros() {
  if (!rutaImagenActual) { alert("Carga una imagen primero."); return; }

  const engine = document.getElementById('engineSelect')?.value || 'tesseract';

  try {
    setProgreso(10, `Cargando motor OCR (${engine.toUpperCase()})...`);
    const canvasElement = obtenerCanvasProcesado();
    
    const worker = await Tesseract.createWorker('spa');

    setProgreso(40, "Extrayendo texto y coordenadas...");
    const { data } = await worker.recognize(canvasElement);
    await worker.terminate();

    setProgreso(75, "Asignando palabras a la matriz...");

    const widthImg = canvasElement.width;
    const limitesX = [0, ...porcentajesCorte.map(p => p * widthImg), widthImg];

    let palabras = [];
    if (data && data.words) {
      data.words.forEach(w => {
        if (w.text && w.text.trim().length > 0) {
          palabras.push({
            text: w.text.trim(),
            x: (w.bbox.x0 + w.bbox.x1) / 2,
            y: (w.bbox.y0 + w.bbox.y1) / 2
          });
        }
      });
    }

    palabras.sort((a, b) => a.y - b.y);
    let filas = [];
    let umbralFila = 18;

    palabras.forEach(p => {
      let f = filas.find(row => Math.abs(row.yCentro - p.y) < umbralFila);
      if (f) {
        f.palabras.push(p);
      } else {
        filas.push({ yCentro: p.y, palabras: [p] });
      }
    });

    setProgreso(90, "Formateando tabla...");

    matrizDatos = filas.map(fila => {
      let filaCols = new Array(20).fill("");
      fila.palabras.forEach(p => {
        let colIdx = limitesX.findIndex((lim, i) => i > 0 && p.x <= lim) - 1;
        if (colIdx < 0) colIdx = 0;
        if (colIdx >= 20) colIdx = 19;

        filaCols[colIdx] = filaCols[colIdx] ? filaCols[colIdx] + " " + p.text : p.text;
      });
      return filaCols.map((val, idx) => aplicarReglasFuzzy(val, idx));
    });

    setProgreso(100, "¡Escaneo completado!");
    setTimeout(ocultarProgreso, 600);
    renderizarMatriz();

  } catch (err) {
    console.error(err);
    ocultarProgreso();
    alert("Error en escaneo: " + (err.message || err));
  }
}

function aplicarReglasFuzzy(valRaw, colIdx) {
  if (!valRaw) return "";
  let t = valRaw.replace(/[|¦\\]/g, "").trim();
  let tipo = ESQUEMA_20_COLUMNAS[colIdx]?.tipo || 'texto';

  switch(tipo) {
    case 'numero': return t.replace(/[^0-9]/g, "");
    case 'decimal': return t.replace(/[^0-9.]/g, "");
    case 'int_lat':
      if (/I[N1]T/i.test(t)) return "INT";
      if (/L[A4]T/i.test(t)) return "LAT";
      return t;
    case 'nivel':
      let c = t.toUpperCase().replace(/\s+/g, "");
      for (let nv of NIVELES_MAR) if (c.includes(nv.replace(/\s+/g, ""))) return nv;
      return t;
    case 'moneda':
      if (/USD|US|\$/i.test(t)) return "USD";
      if (/MXN|MX|PESO/i.test(t)) return "MXN";
      return t;
    default: return t;
  }
}

function renderizarMatriz() {
  const wrapper = document.getElementById('tableWrapper');
  const rowCount = document.getElementById('rowCount');
  if (rowCount) rowCount.innerText = `${matrizDatos.length} filas`;
  if (!wrapper) return;

  if (!matrizDatos.length) {
    wrapper.innerHTML = '<div class="empty-state">No hay datos procesados.</div>';
    return;
  }

  let html = "<table><thead><tr>";
  for (let i = 0; i < 20; i++) html += `<th>${ESQUEMA_20_COLUMNAS[i]?.id || `Col ${i+1}`}</th>`;
  html += "</tr></thead><tbody>";

  matrizDatos.forEach((row) => {
    html += "<tr>";
    for (let c = 0; c < 20; c++) html += `<td contenteditable="true">${row[c] || ""}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrapper.innerHTML = html;
}

function filtrarMatriz() {
  let q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll("#tableWrapper tbody tr").forEach(tr => {
    tr.style.display = tr.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

async function copiarAlPortapapeles() {
  if (!matrizDatos.length) { alert("No hay datos para copiar."); return; }
  let headers = ESQUEMA_20_COLUMNAS.map(c => c.id).join("\t");
  let tsv = headers + "\n" + matrizDatos.map(f => f.join("\t")).join("\n");
  
  const Clipboard = window.Capacitor?.Plugins?.Clipboard;
  if (Clipboard) {
    await Clipboard.write({ string: tsv });
    alert("¡Copiado al portapapeles!");
  } else {
    navigator.clipboard.writeText(tsv);
    alert("Copiado en formato TSV.");
  }
}

function limpiarTabla() {
  matrizDatos = [];
  renderizarMatriz();
}
