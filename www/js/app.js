let currentImageData = null;

document.getElementById('btnCapturar').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                mostrarVistaPrevia(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
});

function mostrarVistaPrevia(base64Data) {
    currentImageData = base64Data;
    document.getElementById('imgPreview').src = currentImageData;
    document.getElementById('previewContainer').classList.remove('hidden');
}

function guardarRegistro(estatus) {
    if (!currentImageData) return;
    const registros = JSON.parse(localStorage.getItem('registros_invitaciones') || '[]');
    const nuevoRegistro = {
        id: Date.now(),
        fecha: new Date().toLocaleString(),
        estatus: estatus,
        imagen: currentImageData
    };
    registros.unshift(nuevoRegistro);
    localStorage.setItem('registros_invitaciones', JSON.stringify(registros));
    
    currentImageData = null;
    document.getElementById('previewContainer').classList.add('hidden');
    renderizarRegistros();
}

function renderizarRegistros() {
    const filtro = document.getElementById('filtroEstatus').value;
    const registros = JSON.parse(localStorage.getItem('registros_invitaciones') || '[]');
    const lista = document.getElementById('listaRegistros');
    lista.innerHTML = '';

    const filtrados = filtro === 'Todos' ? registros : registros.filter(r => r.estatus === filtro);

    if (filtrados.length === 0) {
        lista.innerHTML = '<li style="text-align:center; color:#888; padding:15px;">No hay registros</li>';
        return;
    }

    filtrados.forEach(reg => {
        const li = document.createElement('li');
        li.className = 'registro-item';
        li.innerHTML = `
            <img src="${reg.imagen}">
            <div>
                <div><strong>Fecha:</strong> ${reg.fecha}</div>
                <span class="badge ${reg.estatus}">${reg.estatus}</span>
            </div>
            <button onclick="borrarRegistroIndividual(${reg.id})" class="btn danger-outline" style="width:auto; padding:5px 10px;">🗑️</button>
        `;
        lista.appendChild(li);
    });
}

function borrarRegistroIndividual(id) {
    if (confirm('¿Desea eliminar este registro permanentemente?')) {
        let registros = JSON.parse(localStorage.getItem('registros_invitaciones') || '[]');
        registros = registros.filter(r => r.id !== id);
        localStorage.setItem('registros_invitaciones', JSON.stringify(registros));
        renderizarRegistros();
    }
}

function confirmarBorradoPorEstatus() {
    const filtro = document.getElementById('filtroEstatus').value;
    if (filtro === 'Todos') {
        if (confirm('¿Está seguro de que desea BORRAR TODOS los registros?')) {
            localStorage.removeItem('registros_invitaciones');
            renderizarRegistros();
        }
    } else {
        if (confirm(`¿Está seguro de que desea borrar todos los registros con estatus: "${filtro}"?`)) {
            let registros = JSON.parse(localStorage.getItem('registros_invitaciones') || '[]');
            registros = registros.filter(r => r.estatus !== filtro);
            localStorage.setItem('registros_invitaciones', JSON.stringify(registros));
            renderizarRegistros();
        }
    }
}

// Listener para recibir imágenes enviadas por WhatsApp / Intent
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHARED_IMAGE') {
        mostrarVistaPrevia(event.data.data);
    }
});

// Comprobar si la app inició con una imagen compartida
if (window.sharedImageData) {
    mostrarVistaPrevia(window.sharedImageData);
}

document.addEventListener('DOMContentLoaded', renderizarRegistros);
