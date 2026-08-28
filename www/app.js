(function() {
    let isEditMode = false;
    let tableData = [];

    try {
        const stored = localStorage.getItem('invitaciones_celdas');
        if (stored) tableData = JSON.parse(stored);
    } catch(e) {
        tableData = [];
    }

    function saveToStorage() {
        try {
            localStorage.setItem('invitaciones_celdas', JSON.stringify(tableData));
            const label = document.getElementById('saveState');
            if (label) {
                label.innerText = 'Guardando...';
                setTimeout(() => { label.innerText = 'Guardado ✔'; }, 300);
            }
        } catch(e) {
            console.error('Error guardando storage', e);
        }
    }

    function renderTable() {
        const tbody = document.getElementById('tableBody');
        const emptyMsg = document.getElementById('emptyMsg');
        if (!tbody || !emptyMsg) return;

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
                    <span class="status-badge status-${(row.status || 'Aprobado').toLowerCase()}">${row.status || 'Aprobado'}</span>
                </td>
                <td><img src="${row.imagen || ''}" class="img-thumb" alt="foto" /></td>
                <td ${editAttr} data-index="${index}" data-field="nombre">${row.nombre || ''}</td>
                <td ${editAttr} data-index="${index}" data-field="detalle">${row.detalle || ''}</td>
                <td>
                    <button class="action-btn" data-action="aprobar" data-index="${index}" style="color:green;">✓</button>
                    <button class="action-btn" data-action="rechazar" data-index="${index}" style="color:red;">✗</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Habilitar edición de celdas en Modo Edición
        if (isEditMode) {
            tbody.querySelectorAll('.cell-editable').forEach(cell => {
                cell.addEventListener('blur', function() {
                    const idx = parseInt(this.getAttribute('data-index'));
                    const field = this.getAttribute('data-field');
                    if (!isNaN(idx) && field && tableData[idx]) {
                        tableData[idx][field] = this.innerText.trim();
                        saveToStorage();
                    }
                });
            });
        }

        // Asignar listeners a botones de acción (✓ / ✗)
        tbody.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'));
                const action = this.getAttribute('data-action');
                if (!isNaN(idx) && tableData[idx]) {
                    tableData[idx].status = action === 'aprobar' ? 'Aprobado' : 'Rechazado';
                    saveToStorage();
                    renderTable();
                }
            });
        });
    }

    function agregarRegistroDesdeImagen(base64Data) {
        const nuevo = {
            id: Date.now().toString().slice(-4),
            status: 'Aprobado',
            imagen: base64Data,
            nombre: 'Nuevo Invitado',
            detalle: 'Recibido ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        tableData.unshift(nuevo);
        saveToStorage();
        renderTable();
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderTable();

        // 1. Botón Seleccionar Imagen
        const btnCapturar = document.getElementById('btnCapturar');
        if (btnCapturar) {
            btnCapturar.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => agregarRegistroDesdeImagen(evt.target.result);
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            });
        }

        // 2. Botón Alternar Lectura / Edición
        const btnToggleEdit = document.getElementById('btnToggleEdit');
        if (btnToggleEdit) {
            btnToggleEdit.addEventListener('click', () => {
                isEditMode = !isEditMode;
                btnToggleEdit.innerText = `✏️ Modo: ${isEditMode ? 'EDICIÓN' : 'LECTURA'}`;
                btnToggleEdit.className = `btn ${isEditMode ? 'btn-warning' : 'btn-secondary'}`;
                renderTable();
            });
        }

        // 3. Botón Mostrar / Ocultar columna Estatus
        const btnToggleStatus = document.getElementById('btnToggleStatus');
        if (btnToggleStatus) {
            btnToggleStatus.addEventListener('click', () => {
                const th = document.getElementById('thStatus');
                if (th) th.classList.toggle('hidden-col');
                document.querySelectorAll('.col-status').forEach(td => td.classList.toggle('hidden-col'));
            });
        }

        // 4. Botón Borrar Rechazados
        const btnPurge = document.getElementById('btnPurge');
        if (btnPurge) {
            btnPurge.addEventListener('click', () => {
                if (confirm('¿Desea eliminar los registros con estatus Rechazado?')) {
                    tableData = tableData.filter(r => r.status !== 'Rechazado');
                    saveToStorage();
                    renderTable();
                }
            });
        }

        // 5. Botón Exportar CSV / Excel
        const btnExport = document.getElementById('btnExport');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (tableData.length === 0) {
                    alert('No hay datos para exportar');
                    return;
                }
                let csvContent = "data:text/csv;charset=utf-8,ID,Status,Nombre,Detalle\n";
                tableData.forEach(r => {
                    csvContent += `"${r.id}","${r.status || ''}","${(r.nombre || '').replace(/"/g, '""')}","${(r.detalle || '').replace(/"/g, '""')}"\n`;
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "invitaciones_reporte.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        if (window.sharedImageData) {
            agregarRegistroDesdeImagen(window.sharedImageData);
        }
    });

    window.cargarImagenCompartida = function(base64Data) {
        if (base64Data) agregarRegistroDesdeImagen(base64Data);
    };
})();
