import { NextResponse } from 'next/server';
import { 
  getNetworkConfig, 
  getLocalNetworkAddresses, 
  getLanUrls, 
  saveNetworkConfig,
  NetworkConfig 
} from '@/lib/network-config';

export async function GET() {
  try {
    const config = getNetworkConfig();
    const localInterfaces = getLocalNetworkAddresses();
    const lanUrls = getLanUrls(config.modules.slr_ide.port);
    const isAllInterfaces = config.modules.slr_ide.host === '0.0.0.0' || config.server.host === '0.0.0.0';

    return NextResponse.json({
      success: true,
      config,
      localInterfaces,
      lanUrls,
      isAllInterfaces,
      currentPort: config.modules.slr_ide.port,
      currentHost: config.modules.slr_ide.host,
      detectedConfigPath: config.detectedConfigPath,
      detectedFormat: config.detectedFormat,
    });
  } catch (error: any) {
    console.error('Error fetching network info:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch network information' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid configuration payload' },
        { status: 400 }
      );
    }

    const result = saveNetworkConfig(body as Partial<NetworkConfig>);
    const freshConfig = getNetworkConfig();
    const lanUrls = getLanUrls(freshConfig.modules.slr_ide.port);

    return NextResponse.json({
      success: true,
      message: 'Network configuration saved successfully to ' + result.path,
      configPath: result.path,
      config: freshConfig,
      lanUrls,
    });
  } catch (error: any) {
    console.error('Error saving network configuration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save network configuration' },
      { status: 500 }
    );
  }
}
