import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/onnxruntime-web/dist/*.wasm', dest: 'onnx' },
        { src: 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data', dest: 'piper' },
        { src: 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm', dest: 'piper' }
      ]
    })
  ],
  build: { target: 'es2022' },
  worker: { format: 'es' }
});
