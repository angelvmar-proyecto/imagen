function cargarImagenCompartida(base64Data) {
    const img = document.getElementById('preview');
    const status = document.getElementById('status');
    if (base64Data) {
        img.src = base64Data;
        img.style.display = 'block';
        status.innerText = '¡Imagen recibida exitosamente!';
    }
}

window.onload = function() {
    if (window.sharedImageData) {
        cargarImagenCompartida(window.sharedImageData);
    }
};

