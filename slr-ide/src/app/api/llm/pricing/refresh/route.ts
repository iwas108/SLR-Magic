import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { PROJECT_ROOT, getVaultKey, getConfig } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
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
      clearSessionMasterPassword();
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key. Vault locked.' }, { status: 401 });
    }

    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe) || !fs.existsSync(mainScript)) {
      return NextResponse.json({ error: 'Python environment or main script not found.' }, { status: 500 });
    }

    let stdoutData = '';
    let stderrData = '';

    // Spawn Python synchronously or asynchronously with wait to refresh pricing
    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonExe, [
        mainScript,
        '--project-id', getConfig('ACTIVE_PROJECT_ID', ''),
        '--job-id', 'pricing-refresh-job',
        '--action', 'refresh-pricing'
      ], {
        cwd: path.join(PROJECT_ROOT, 'python_engine'),
        env: {
          ...process.env,
          GEMINI_API_KEY: geminiApiKey
        }
      });

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else {
          let errorMsg = '';
          const lines = stdoutData.split('\n');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed && parsed.message) {
                errorMsg = parsed.message;
                break;
              }
            } catch (e) {
              // Ignore line parsing errors
            }
          }
          if (!errorMsg) {
            errorMsg = stderrData.trim() || stdoutData.trim() || `Python process exited with code ${code}`;
          }
          reject(new Error(errorMsg));
        }
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
    const errorMsg = sanitizeApiKey(error.message || 'Internal Server Error');
    console.error('Error refreshing pricing:', errorMsg);
    clearSessionMasterPassword(); // Lock the vault to force re-authentication
    return NextResponse.json({ error: errorMsg }, { status: 401 });
  }
}
