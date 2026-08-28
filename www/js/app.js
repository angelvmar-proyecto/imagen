let isEditMode = false;
let tableData = JSON.parse(localStorage.getItem('invitaciones_celdas') || '[]');

document.getElementById('btnCapturar').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => procesarImagenOCR(evt.target.result);
            reader.readAsDataURL(file);
        }
    };
    input.click();
});

function setStatusMsg(msg) {
    document.getElementById('ocrStatus').innerText = msg;
}

async function procesarImagenOCR(base64Data) {
    setStatusMsg("Escanenado texto (OCR)...");
    try {
        const worker = await Tesseract.createWorker('spa');
        const ret = await worker.recognize(base64Data);
        await worker.terminate();

        const lineas = ret.data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lineas.length === 0) {
            lineas.push("Texto no detectado en imagen");
        }

        lineas.forEach((linea, idx) => {
            tableData.unshift({
                id: Date.now() + idx,
                status: 'Aprobado',
                nombre: linea,
                detalle: `Extraído OCR (${new Date().toLocaleTimeString()})`
            });
        });

        saveToStorage();
        renderTable();
        setStatusMsg("Conversión completada ✔");
    } catch (err) {
        setStatusMsg("Error en OCR");
        console.error(err);
    }
}

function saveToStorage() {
    localStorage.setItem('invitaciones_celdas', JSON.stringify(tableData));
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const emptyMsg = document.getElementById('emptyMsg');
    tbody.innerHTML = '';

    if (tableData.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    tableData.forEach((row, index) => {
        const tr = document.createElement('tr');
        const editAttr = isEditMode ? 'contenteditable="true" class="cell-editable"' : '';

        tr.innerHTML = `
            <td>${row.id}</td>
            <td class="col-status">
                <span class="status-badge status-${row.status.toLowerCase()}">${row.status}</span>
            </td>
            <td ${editAttr} onblur="updateCell(${index}, 'nombre', this.innerText)">${row.nombre}</td>
            <td ${editAttr} onblur="updateCell(${index}, 'detalle', this.innerText)">${row.detalle}</td>
            <td>
                <button onclick="cambiarEstatus(${index}, 'Aprobado')" style="color:green; border:none; background:none; cursor:pointer;">✓</button>
                <button onclick="cambiarEstatus(${index}, 'Rechazado')" style="color:red; border:none; background:none; cursor:pointer;">✗</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('btnToggleEdit');
    btn.innerText = `✏️ Modo: ${isEditMode ? 'EDICIÓN' : 'LECTURA'}`;
    btn.className = `btn ${isEditMode ? 'btn-warning' : 'btn-secondary'}`;
    renderTable();
}

function updateCell(index, field, value) {
    if (!isEditMode) return;
    tableData[index][field] = value;
    saveToStorage();
}

function cambiarEstatus(index, nuevoStatus) {
    tableData[index].status = nuevoStatus;
    saveToStorage();
    renderTable();
}

function purgeDeleted() {
    if (confirm('¿Desea eliminar las filas marcadas como Rechazado?')) {
        tableData = tableData.filter(r => r.status !== 'Rechazado');
        saveToStorage();
        renderTable();
    }
}

function toggleStatusColumn() {
    document.getElementById('thStatus').classList.toggle('hidden-col');
    document.querySelectorAll('.col-status').forEach(td => td.classList.toggle('hidden-col'));
}

function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invitaciones");
    XLSX.writeFile(workbook, "Control_Invitaciones.xlsx");
}

window.cargarImagenCompartida = function(base64Data) {
    if (base64Data) {
        procesarImagenOCR(base64Data);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderTable();
    if (window.sharedImageData) {
        window.cargarImagenCompartida(window.sharedImageData);
    }
});
