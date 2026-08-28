let isEditMode = false;
let tableData = JSON.parse(localStorage.getItem('invitaciones_excel_data')) || [
    { id: 1, status: 'Aprobado', nombre: 'Juan Pérez', detalle: 'Mesa 1' },
    { id: 2, status: 'Rechazado', nombre: 'María Gómez', detalle: 'Cancelado' }
];

function saveToStorage() {
    localStorage.setItem('invitaciones_excel_data', JSON.stringify(tableData));
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    tableData.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        const cellEditableAttr = isEditMode ? 'contenteditable="true" class="editable-cell"' : '';

        tr.innerHTML = `
            <td>${row.id}</td>
            <td class="col-status-td">
                <span class="status-badge status-${row.status.toLowerCase()}">${row.status}</span>
            </td>
            <td ${cellEditableAttr} onblur="updateCell(${index}, 'nombre', this.innerText)">${row.nombre}</td>
            <td ${cellEditableAttr} onblur="updateCell(${index}, 'detalle', this.innerText)">${row.detalle}</td>
            <td>
                <button onclick="cambiarEstatus(${index}, 'Aprobado')" style="color:green; font-weight:bold;">✓</button>
                <button onclick="cambiarEstatus(${index}, 'Rechazado')" style="color:red; font-weight:bold;">✗</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('btnToggleEdit');
    btn.innerText = `Modo: ${isEditMode ? 'EDICIÓN' : 'LECTURA'}`;
    btn.className = `btn ${isEditMode ? 'btn-danger' : 'btn-primary'}`;
    renderTable();
}

function updateCell(index, field, value) {
    if (!isEditMode) return;
    tableData[index][field] = value;
    saveToStorage();
}

function cambiarEstatus(index, nuevoEstatus) {
    tableData[index].status = nuevoEstatus;
    saveToStorage();
    renderTable();
}

function purgeDeleted() {
    if (confirm('¿Desea borrar los registros con estatus Rechazado?')) {
        tableData = tableData.filter(row => row.status !== 'Rechazado');
        saveToStorage();
        renderTable();
    }
}

function toggleHideColumn() {
    const colHeader = document.getElementById('colStatus');
    colHeader.classList.toggle('hidden-col');
    document.querySelectorAll('.col-status-td').forEach(td => td.classList.toggle('hidden-col'));
}

function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invitaciones");
    XLSX.writeFile(workbook, "invitaciones.xlsx");
}

window.cargarImagenCompartida = function(base64Data) {
    if (base64Data) {
        const nuevo = {
            id: Date.now(),
            status: 'Aprobado',
            nombre: 'Imagen Recibida',
            detalle: 'Cargada desde WhatsApp'
        };
        tableData.unshift(nuevo);
        saveToStorage();
        renderTable();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    renderTable();
    if (window.sharedImageData) {
        window.cargarImagenCompartida(window.sharedImageData);
    }
});
