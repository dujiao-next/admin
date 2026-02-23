import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const cfAsyncModuleScriptPlugin = () => ({
  name: 'cfasync-module-script',
  transformIndexHtml(html: string) {
    return html.replace(
      /<script\s+type="module"(?![^>]*data-cfasync)/g,
      '<script data-cfasync="false" type="module"',
    )
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), cfAsyncModuleScriptPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
