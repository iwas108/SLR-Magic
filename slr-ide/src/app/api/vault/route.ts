import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isVaultInitialized, getVaultPasswordHash, setVaultPassword } from '@/lib/db';
import { setSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword } from '@/lib/session';

export async function GET() {
  try {
    const initialized = isVaultInitialized();
    const unlocked = hasSessionMasterPassword();
    return NextResponse.json({ initialized, unlocked });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to check vault status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { password, action } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const initialized = isVaultInitialized();

    if (action === 'setup') {
      if (initialized) {
        return NextResponse.json({ error: 'Vault is already initialized' }, { status: 400 });
      }

      // Hash password using bcryptjs and save to db
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      setVaultPassword(hash);

      // Also unlock the session
      setSessionMasterPassword(password);

      return NextResponse.json({ success: true, message: 'Vault initialized and unlocked successfully' });
    } else {
      // Default action: unlock/verify
      if (!initialized) {
        return NextResponse.json({ error: 'Vault is not initialized. Please set up a master password first.' }, { status: 400 });
      }

      const hash = getVaultPasswordHash();
      if (!hash) {
        return NextResponse.json({ error: 'Vault config hash is missing' }, { status: 500 });
      }

      const match = await bcrypt.compare(password, hash);
      if (!match) {
        return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
      }

      // Unlock the session
      setSessionMasterPassword(password);

      return NextResponse.json({ success: true, unlocked: true, message: 'Vault unlocked successfully' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Vault operation failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearSessionMasterPassword();
    return NextResponse.json({ success: true, message: 'Vault locked successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to lock vault' }, { status: 500 });
  }
}
