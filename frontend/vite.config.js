import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/serv-pickleball/',
  
  server: {
    port: 5173,
  },
})
