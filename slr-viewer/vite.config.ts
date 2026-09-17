import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'fs'
import path from 'path'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const now = new Date().toISOString()
const rootDir = path.resolve(__dirname, '..')

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
        const host = parsed.modules?.slr_viewer?.host || parsed.server?.host || '0.0.0.0'
        const port = parsed.modules?.slr_viewer?.port || 3002
        return { host, port: Number(port) }
      } catch (e) {
        // continue
      }
    }
  }
  return {
    host: process.env.SLR_VIEWER_HOST || process.env.HOSTNAME || process.env.HOST || '0.0.0.0',
    port: Number(process.env.SLR_VIEWER_PORT || 3002),
  }
}

const netConfig = resolveNetworkConfig()

// Injects version metadata tag into HTML head
const htmlVersionPlugin = {
  name: 'html-version-injector',
  transformIndexHtml(html: string) {
    return html.replace(
      '<head>',
      `<head>\n    <meta name="slr-viewer-version" content="${pkg.version}">`
    )
  },
}

// Inlines woff2 fonts as base64 data URIs for true offline zero-dependency singlefile bundling
const inlineFontsPlugin = {
  name: 'inline-fonts-singlefile',
  closeBundle() {
    const distHtml = path.resolve(__dirname, './dist/index.html')
    if (fs.existsSync(distHtml)) {
      let html = fs.readFileSync(distHtml, 'utf8')
      const fontsDir = path.resolve(__dirname, './public/fonts')
      const regex = /url\((['"]?)(?:(?:\.\/|\/)fonts\/([^'")]+))\1\)/g
      let count = 0
      html = html.replace(regex, (match, _q, fontFileName) => {
        const filePath = path.join(fontsDir, fontFileName)
        if (fs.existsSync(filePath)) {
          count++
          const fontData = fs.readFileSync(filePath)
          const base64 = fontData.toString('base64')
          return `url("data:font/woff2;charset=utf-8;base64,${base64}")`
        }
        return match
      })
      fs.writeFileSync(distHtml, html, 'utf8')
      console.log(`  ✓ [inlineFontsPlugin] Inlined ${count} core WOFF2 fonts into single-file HTML bundle.`)
    }
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isSingleFile = mode === 'singlefile'
  const plugins = [react(), tailwindcss(), htmlVersionPlugin]
  if (isSingleFile) {
    plugins.push(viteSingleFile(), inlineFontsPlugin)
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(now),
    },
    base: isSingleFile ? './' : mode === 'production' ? '/SLR-Magic/slr-viewer/dist/' : './',
    server: {
      host: netConfig.host,
      port: netConfig.port,
    },
  }
})
