import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.join(process.cwd(), '.env.local');

// Parses a simple .env file into a dictionary
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

// Formats a dictionary back to .env format, preserving original keys where possible
function formatEnv(originalContent: string, updates: Record<string, string>): string {
  const lines = originalContent.split('\n');
  const updatedKeys = new Set<string>();
  
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      if (key in updates) {
        updatedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
    }
    return line;
  });

  // Add any new keys that weren't in the original file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  }

  return newLines.join('\n');
}

export async function GET() {
  try {
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }
    const envData = parseEnv(envContent);
    
    // Only return specific keys for security (API keys)
    const safeData = {
      OPENAI_API_KEY: envData['OPENAI_API_KEY'] || '',
      GEMINI_API_KEY: envData['GEMINI_API_KEY'] || '',
      ANTHROPIC_API_KEY: envData['ANTHROPIC_API_KEY'] || '',
    };
    
    return NextResponse.json({ success: true, data: safeData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const updates = await req.json();
    
    // Validate inputs - only allow specific keys
    const allowedKeys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];
    const sanitizedUpdates: Record<string, string> = {};
    
    for (const key of allowedKeys) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const newEnvContent = formatEnv(envContent, sanitizedUpdates);
    fs.writeFileSync(ENV_PATH, newEnvContent, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
