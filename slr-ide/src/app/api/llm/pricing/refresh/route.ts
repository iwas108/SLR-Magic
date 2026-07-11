import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { PROJECT_ROOT, getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import db from '@/lib/db';

export async function POST() {
  try {
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault to refresh pricing.' }, { status: 401 });
    }

    const password = getSessionMasterPassword();
    const keyRow = getVaultKey('GEMINI_API_KEY');
    if (!keyRow || !password) {
      return NextResponse.json({ error: 'Gemini API Key is not configured. Add it in Settings.' }, { status: 400 });
    }

    let geminiApiKey: string;
    try {
      geminiApiKey = await decryptKey({
        ciphertext: keyRow.encrypted_value,
        salt: keyRow.salt,
        iv: keyRow.iv,
        tag: keyRow.tag,
      }, password);
    } catch (decryptErr) {
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key.' }, { status: 500 });
    }

    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe) || !fs.existsSync(mainScript)) {
      return NextResponse.json({ error: 'Python environment or main script not found.' }, { status: 500 });
    }

    // Spawn Python synchronously or asynchronously with wait to refresh pricing
    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonExe, [
        mainScript,
        '--project-id', 'default-project',
        '--job-id', 'pricing-refresh-job',
        '--action', 'refresh-pricing'
      ], {
        cwd: path.join(PROJECT_ROOT, 'python_engine'),
        env: {
          ...process.env,
          GEMINI_API_KEY: geminiApiKey
        }
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python process exited with code ${code}`));
      });
      child.on('error', (err) => reject(err));
    });

    // Query new pricing data from SQLite to return
    const pricing = db.prepare('SELECT * FROM llm_pricing').all();

    return NextResponse.json({
      success: true,
      message: 'Pricing updated successfully.',
      pricing
    });

  } catch (error: any) {
    console.error('Error refreshing pricing:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
