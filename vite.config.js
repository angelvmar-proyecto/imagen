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
        {
          src: resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm'),
          dest: '.'
        },
        {
          src: resolve(__dirname, 'www/models/*'),
          dest: 'models'
        }
      ]
    })
  ],
  server: {
    port: 3000,
  },
});
