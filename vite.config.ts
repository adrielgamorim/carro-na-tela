import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fipeProxyPlugin } from './server/vite-plugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-side only: variables without the VITE_ prefix never reach the bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const token = (env.FIPE_PROXY_TOKEN || env.FIPE_TOKEN)?.trim() || undefined

  return {
    plugins: [react(), fipeProxyPlugin({ token })],
  }
})
