import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ModuleNetworkConfig {
  host: string;
  port: number;
}

export interface NetworkConfig {
  server: {
    host: string;
    port: number;
    cors?: boolean;
  };
  modules: {
    slr_ide: ModuleNetworkConfig;
    inter_rater: ModuleNetworkConfig;
    slr_viewer: ModuleNetworkConfig;
    worker_server: ModuleNetworkConfig;
  };
  detectedConfigPath?: string | null;
  detectedFormat?: 'json' | 'env' | 'default';
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  mac: string;
}

const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
  },
  modules: {
    slr_ide: { host: '0.0.0.0', port: 3000 },
    inter_rater: { host: '0.0.0.0', port: 3001 },
    slr_viewer: { host: '0.0.0.0', port: 3002 },
    worker_server: { host: '0.0.0.0', port: 7291 },
  },
};

/**
 * Finds the project root directory whether running from inside slr-ide or root.
 */
export function findWorkspaceRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith('slr-ide')) {
    return path.dirname(cwd);
  }
  return cwd;
}

/**
 * Parses simple KEY=VALUE format from .env files.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

/**
 * Loads network configuration from slr-magic.config.json, .env.local, .env, or env vars.
 */
export function getNetworkConfig(): NetworkConfig {
  const root = findWorkspaceRoot();
  const candidateJsonFiles = [
    path.join(root, 'slr-magic.config.json'),
    path.join(root, 'slr.config.json'),
    path.join(root, 'slr-ide', 'slr-magic.config.json'),
    path.join(root, 'slr-ide', 'slr.config.json'),
  ];

  for (const jsonPath of candidateJsonFiles) {
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          server: {
            host: parsed.server?.host || parsed.host || '0.0.0.0',
            port: Number(parsed.server?.port || parsed.port || 3000),
            cors: parsed.server?.cors ?? true,
          },
          modules: {
            slr_ide: {
              host: parsed.modules?.slr_ide?.host || parsed.server?.host || '0.0.0.0',
              port: Number(parsed.modules?.slr_ide?.port || parsed.server?.port || 3000),
            },
            inter_rater: {
              host: parsed.modules?.inter_rater?.host || parsed.server?.host || '0.0.0.0',
              port: Number(parsed.modules?.inter_rater?.port || 3001),
            },
            slr_viewer: {
              host: parsed.modules?.slr_viewer?.host || parsed.server?.host || '0.0.0.0',
              port: Number(parsed.modules?.slr_viewer?.port || 3002),
            },
            worker_server: {
              host: parsed.modules?.worker_server?.host || parsed.server?.host || '0.0.0.0',
              port: Number(parsed.modules?.worker_server?.port || 7291),
            },
          },
          detectedConfigPath: jsonPath,
          detectedFormat: 'json',
        };
      } catch (err) {
        console.warn(`[NetworkConfig] Failed to parse ${jsonPath}:`, err);
      }
    }
  }

  // Check .env.local and .env
  const candidateEnvFiles = [
    path.join(root, '.env.local'),
    path.join(root, '.env'),
    path.join(root, 'slr-ide', '.env.local'),
    path.join(root, 'slr-ide', '.env'),
  ];

  let mergedEnv: Record<string, string> = {};
  let envSource: string | null = null;
  for (const envPath of candidateEnvFiles) {
    if (fs.existsSync(envPath)) {
      const parsed = parseEnvFile(envPath);
      mergedEnv = { ...parsed, ...mergedEnv };
      if (!envSource) envSource = envPath;
    }
  }

  const host = process.env.HOSTNAME || process.env.HOST || mergedEnv.HOSTNAME || mergedEnv.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || mergedEnv.PORT || 3000);

  return {
    server: {
      host,
      port,
      cors: true,
    },
    modules: {
      slr_ide: {
        host: process.env.SLR_IDE_HOST || mergedEnv.SLR_IDE_HOST || host,
        port: Number(process.env.SLR_IDE_PORT || mergedEnv.SLR_IDE_PORT || port),
      },
      inter_rater: {
        host: process.env.INTER_RATER_HOST || mergedEnv.INTER_RATER_HOST || host,
        port: Number(process.env.INTER_RATER_PORT || mergedEnv.INTER_RATER_PORT || 3001),
      },
      slr_viewer: {
        host: process.env.SLR_VIEWER_HOST || mergedEnv.SLR_VIEWER_HOST || host,
        port: Number(process.env.SLR_VIEWER_PORT || mergedEnv.SLR_VIEWER_PORT || 3002),
      },
      worker_server: {
        host: process.env.WORKER_SERVER_HOST || mergedEnv.WORKER_SERVER_HOST || host,
        port: Number(process.env.WORKER_SERVER_PORT || mergedEnv.WORKER_SERVER_PORT || 7291),
      },
    },
    detectedConfigPath: envSource,
    detectedFormat: envSource ? 'env' : 'default',
  };
}

/**
 * Returns all local IPv4 network interface addresses.
 */
export function getLocalNetworkAddresses(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' || (net as any).family === 4) {
        results.push({
          name,
          address: net.address,
          family: 'IPv4',
          internal: net.internal,
          mac: net.mac,
        });
      }
    }
  }

  return results;
}

/**
 * Returns accessible HTTP URLs for a given port on all non-internal network interfaces.
 */
export function getLanUrls(port: number): string[] {
  const addresses = getLocalNetworkAddresses();
  const urls: string[] = [`http://localhost:${port}`];
  for (const net of addresses) {
    if (!net.internal && net.address) {
      const url = `http://${net.address}:${port}`;
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/**
 * Saves or updates slr-magic.config.json in the workspace root.
 */
export function saveNetworkConfig(config: Partial<NetworkConfig>): { success: boolean; path: string } {
  const root = findWorkspaceRoot();
  const targetPath = path.join(root, 'slr-magic.config.json');

  const current = getNetworkConfig();
  const merged: NetworkConfig = {
    server: {
      ...current.server,
      ...(config.server || {}),
    },
    modules: {
      slr_ide: {
        ...current.modules.slr_ide,
        ...(config.modules?.slr_ide || {}),
      },
      inter_rater: {
        ...current.modules.inter_rater,
        ...(config.modules?.inter_rater || {}),
      },
      slr_viewer: {
        ...current.modules.slr_viewer,
        ...(config.modules?.slr_viewer || {}),
      },
      worker_server: {
        ...current.modules.worker_server,
        ...(config.modules?.worker_server || {}),
      },
    },
  };

  const outputPayload = {
    $schema: "http://json-schema.org/draft-07/schema#",
    server: merged.server,
    modules: merged.modules,
  };

  fs.writeFileSync(targetPath, JSON.stringify(outputPayload, null, 2), 'utf8');
  return { success: true, path: targetPath };
}
