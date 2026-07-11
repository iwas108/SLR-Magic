import { NextResponse } from 'next/server';
import { listVaultKeyNames, saveVaultKey, deleteVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword } from '@/lib/session';
import { encryptKey } from '@/lib/vault';

export async function GET() {
  try {
    const keys = listVaultKeyNames();
    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault first.' }, { status: 401 });
    }

    const { keyName, plainValue } = await request.json();
    if (!keyName || !plainValue) {
      return NextResponse.json({ error: 'keyName and plainValue are required' }, { status: 400 });
    }

    const password = getSessionMasterPassword();
    if (!password) {
      return NextResponse.json({ error: 'Master password session cache is unavailable' }, { status: 500 });
    }

    // Encrypt the key value using the cached master password
    const encrypted = await encryptKey(plainValue, password);

    // Save to the database
    saveVaultKey({
      key_name: keyName,
      encrypted_value: encrypted.ciphertext,
      salt: encrypted.salt,
      iv: encrypted.iv,
      tag: encrypted.tag,
    });

    return NextResponse.json({ success: true, message: `Key '${keyName}' saved and encrypted successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save key' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault first.' }, { status: 401 });
    }

    const { keyName } = await request.json();
    if (!keyName) {
      return NextResponse.json({ error: 'keyName is required' }, { status: 400 });
    }

    deleteVaultKey(keyName);

    return NextResponse.json({ success: true, message: `Key '${keyName}' deleted successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete key' }, { status: 500 });
  }
}
