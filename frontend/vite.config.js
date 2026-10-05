import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Must match the repo name segment in package.json's "homepage" —
  // this is a GitHub Pages PROJECT page (github.io/serv-pickleball),
  // not a user/org page, so assets and routing need this prefix.
  base: '/serv-pickleball/',
  plugins: [react()],
})