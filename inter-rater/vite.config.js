import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const now = new Date().toISOString()

// Resolve host and port from file-based config (slr-magic.config.json / .env)
function resolveNetworkConfig() {
  const candidateJson = [
    path.join(rootDir, 'slr-magic.config.json'),
    path.join(rootDir, 'slr.config.json'),
    path.join(__dirname, 'slr-magic.config.json'),
  ]
  for (const jPath of candidateJson) {
    if (fs.existsSync(jPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(jPath, 'utf8'))
        const host = parsed.modules?.inter_rater?.host || parsed.server?.host || '0.0.0.0'
        const port = parsed.modules?.inter_rater?.port || 3001
        return { host, port: Number(port) }
      } catch (e) {
        // continue
      }
    }
  }
  return {
    host: process.env.INTER_RATER_HOST || process.env.HOSTNAME || process.env.HOST || '0.0.0.0',
    port: Number(process.env.INTER_RATER_PORT || 3001),
  }
}

const netConfig = resolveNetworkConfig()

// Injects version metadata tag into HTML head
const htmlVersionPlugin = {
  name: 'html-version-injector',
  transformIndexHtml(html) {
    return html.replace(
      '<head>',
      `<head>\n    <meta name="inter-rater-version" content="${pkg.version}">`
    )
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isSingleFile = mode === 'singlefile'
  const plugins = [react(), tailwindcss(), htmlVersionPlugin]
  if (isSingleFile) {
    plugins.push(viteSingleFile())
  }

  return {
    plugins,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(now),
    },
    base: isSingleFile ? './' : mode === 'production' ? '/SLR-Magic/inter-rater/dist/' : './',
    server: {
      host: netConfig.host,
      port: netConfig.port,
    },
  }
})
