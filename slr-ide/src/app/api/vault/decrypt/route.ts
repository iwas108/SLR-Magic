import { NextResponse } from 'next/server';
import { getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';

export async function POST(request: Request) {
  try {
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault first.' }, { status: 401 });
    }

    const { keyName } = await request.json();
    if (!keyName) {
      return NextResponse.json({ error: 'keyName is required' }, { status: 400 });
    }

    const password = getSessionMasterPassword();
    if (!password) {
      return NextResponse.json({ error: 'Master password session cache is unavailable' }, { status: 500 });
    }

    const keyRow = getVaultKey(keyName);
    if (!keyRow) {
      return NextResponse.json({ error: `Key '${keyName}' not found in vault` }, { status: 404 });
    }

    // Decrypt in-memory
    let plainValue: string;
    try {
      plainValue = await decryptKey({
        ciphertext: keyRow.encrypted_value,
        salt: keyRow.salt,
        iv: keyRow.iv,
        tag: keyRow.tag,
      }, password);
    } catch (decryptErr) {
      clearSessionMasterPassword();
      return NextResponse.json({ error: 'Failed to decrypt key. Vault locked.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, plainValue });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to decrypt key' }, { status: 500 });
  }
}
