import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0', // 允許區網連線
    port: 5173,
    https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    },
    proxy: {
      // 將 Socket.io 請求轉發至後端 (3001)
      '/socket.io': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false, // 允許自簽憑證
        ws: true       // 支援 WebSocket
      },
      // 將 API 請求也一併轉發
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});