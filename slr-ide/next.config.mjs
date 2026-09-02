import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf8'));
const now = new Date().toISOString();

import os from 'os';

function getDynamicAllowedOrigins() {
  const origins = ['localhost', '127.0.0.1', '0.0.0.0', '*.local'];
  try {
    const ifaces = os.networkInterfaces();
    for (const netList of Object.values(ifaces)) {
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === 'IPv4' || net.family === 4) {
          if (!origins.includes(net.address)) {
            origins.push(net.address);
          }
        }
      }
    }
  } catch (e) {
    // Ignore interface inspection errors
  }

  if (process.env.SLR_IDE_HOST && !origins.includes(process.env.SLR_IDE_HOST)) {
    origins.push(process.env.SLR_IDE_HOST);
  }
  if (process.env.HOSTNAME && !origins.includes(process.env.HOSTNAME)) {
    origins.push(process.env.HOSTNAME);
  }
  if (process.env.HOST && !origins.includes(process.env.HOST)) {
    origins.push(process.env.HOST);
  }

  return origins;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  serverExternalPackages: ['better-sqlite3', 'ts-morph', 'bcryptjs'],
  allowedDevOrigins: getDynamicAllowedOrigins(),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version || '0.1.0',
    NEXT_PUBLIC_BUILD_TIME: now,
  },
};

export default nextConfig;

