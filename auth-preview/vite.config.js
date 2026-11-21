import { defineConfig } from 'vite';

// Arquivos independentes, ainda não servidos pelo Worker público.
export default defineConfig({ base: './', build: { outDir: 'dist' } });
