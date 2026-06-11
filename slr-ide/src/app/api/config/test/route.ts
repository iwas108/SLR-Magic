import { exec } from 'child_process';
import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rclonePath = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // Check if parameters are passed in body, otherwise query active project
    let cloudProvider = body.cloud_provider;
    let remote = body.rclone_remote_name;

    if (!cloudProvider || !remote) {
      const project = db.prepare('SELECT cloud_provider, rclone_remote_name FROM projects WHERE id = ?').get(activeProjectId) as { cloud_provider?: string; rclone_remote_name?: string } | undefined;
      cloudProvider = cloudProvider || project?.cloud_provider || 'gdrive';
      remote = remote || project?.rclone_remote_name || (cloudProvider === 'onedrive' ? 'onedrive' : 'gdrive');
    }
    
    const configPath = getConfig('RCLONE_CONFIG_PATH', '');

    let cmd = `"${rclonePath}" listremotes`;
    if (configPath) {
      cmd += ` --config "${configPath}"`;
    }

    return new Promise<Response>((resolve) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          resolve(
            NextResponse.json(
              {
                success: false,
                message: error.message || 'Rclone execution failed',
                details: stderr || 'Is Rclone installed and in PATH?'
              },
              { status: 500 }
            )
          );
          return;
        }

        const remotes = stdout
          .split('\n')
          .map((r) => r.trim().replace(':', ''))
          .filter(Boolean);

        if (remotes.includes(remote)) {
          resolve(
            NextResponse.json({
              success: true,
              message: `Successfully connected! Remote "${remote}:" was found and verified.`
            })
          );
        } else {
          resolve(
            NextResponse.json({
              success: false,
              message: `Remote "${remote}:" was not found in Rclone. Available remotes: ${remotes.join(', ') || 'None'}.`,
              details: 'Please run "rclone config" to create this remote.'
            })
          );
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to test Rclone connection' }, { status: 500 });
  }
}
