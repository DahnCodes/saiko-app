import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { discoverability } from './build/discoverability.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), discoverability()],
})
