import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  root: 'www',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // WASM de ONNX
        {
          src: resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm'),
          dest: '.'
        },
        // Modelos .tar
        {
          src: resolve(__dirname, 'www/models/*'),
          dest: 'models'
        },
        // Scripts clásicos
        {
          src: resolve(__dirname, 'www/js/config-deteccion.js'),
          dest: 'js'
        },
        {
          src: resolve(__dirname, 'www/js/utilidades.js'),
          dest: 'js'
        },
        {
          src: resolve(__dirname, 'www/js/preprocesamiento.js'),
          dest: 'js'
        },
        {
          src: resolve(__dirname, 'www/js/deteccion.js'),
          dest: 'js'
        },
        {
          src: resolve(__dirname, 'www/js/lidar.js'),
          dest: 'js'
        },
        {
          src: resolve(__dirname, 'www/js/retina.js'),
          dest: 'js'
        }
      ]
    })
  ],
  server: {
    port: 3000,
  },
});
