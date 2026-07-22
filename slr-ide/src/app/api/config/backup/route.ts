import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/db';
import { runRcloneBackup } from '@/lib/services/backup-service';

export async function POST() {
  try {
    const destination = getConfig('BACKUP_DESTINATION', '').trim();
    if (!destination) {
      return NextResponse.json(
        { success: false, message: 'Backup destination is not configured.' },
        { status: 400 }
      );
    }

    const success = await runRcloneBackup(destination);
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Database backup completed successfully.'
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Database backup failed. See logs for details.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to execute backup.' },
      { status: 500 }
    );
  }
}
