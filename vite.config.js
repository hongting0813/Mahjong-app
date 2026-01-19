import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // ✨ 加入這一行，允許區網連線
    port: 5173       // 確保 Port 固定
  }
});