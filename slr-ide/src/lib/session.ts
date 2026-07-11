// Session state for the local-first application server context
// Singleton-cached on globalThis to prevent isolation across Next.js API routes
const globalForSession = globalThis as any;

if (globalForSession.cachedMasterPassword === undefined) {
  globalForSession.cachedMasterPassword = null;
}

export function getSessionMasterPassword(): string | null {
  return globalForSession.cachedMasterPassword;
}

export function setSessionMasterPassword(password: string): void {
  globalForSession.cachedMasterPassword = password;
}

export function clearSessionMasterPassword(): void {
  globalForSession.cachedMasterPassword = null;
}

export function hasSessionMasterPassword(): boolean {
  return globalForSession.cachedMasterPassword !== null;
}
