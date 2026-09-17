// ============================================
// MANEJADOR DE PESTAÑAS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 Conectando pestañas...');
  
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  console.log('📑 Pestañas encontradas:', tabs.length);
  console.log('📄 Contenidos encontrados:', contents.length);

  tabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      const targetTab = this.dataset.tab;
      console.log('🎯 Cambiando a pestaña:', targetTab);
      
      // Quitar activo de todas las pestañas
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Activar la pestaña clickeada
      this.classList.add('active');
      const targetContent = document.getElementById('tab-' + targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
        console.log('✅ Pestaña activada:', targetTab);
      } else {
        console.error('❌ No se encontró:', 'tab-' + targetTab);
      }
    });
  });

  console.log('✅ Pestañas conectadas');
});
