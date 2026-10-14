import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// GitHub Pages(/docs 폴더)에서 바로 열 수 있도록 한 장짜리 index.html로 빌드합니다.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
})
