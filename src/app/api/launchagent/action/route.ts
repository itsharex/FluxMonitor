import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { runCommandWithSudo, writeFileWithSudo } from '@/lib/exec';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { action, filePath, content, newFilePath, sudoPassword } = await request.json();

    if (!action || !filePath) {
      return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
    }

    if (action === 'read') {
      const data = await fs.readFile(filePath, 'utf-8');
      return NextResponse.json({ success: true, data });
    }

    if (action === 'write') {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.code === 'EACCES') {
          await writeFileWithSudo(filePath, content, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'load') {
      try {
        await execAsync(`launchctl load -w "${filePath}"`);
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.stderr?.includes('Permission denied') || error.stderr?.includes('privileged')) {
          await runCommandWithSudo(`launchctl load -w "${filePath}"`, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'unload') {
      try {
        await execAsync(`launchctl unload -w "${filePath}"`);
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.stderr?.includes('Permission denied') || error.stderr?.includes('privileged')) {
          await runCommandWithSudo(`launchctl unload -w "${filePath}"`, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'reload') {
      try { await execAsync(`launchctl unload -w "${filePath}"`); } catch (e) { } // ignore unload error if not loaded
      try {
        await execAsync(`launchctl load -w "${filePath}"`);
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.stderr?.includes('Permission denied') || error.stderr?.includes('privileged')) {
          await runCommandWithSudo(`launchctl load -w "${filePath}"`, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      try { await execAsync(`launchctl unload -w "${filePath}"`); } catch (e) { } // ignore unload error
      try {
        await fs.unlink(filePath);
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          await runCommandWithSudo(`rm -f "${filePath}"`, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'rename') {
      if (!newFilePath) return NextResponse.json({ error: 'MISSING_NEW_PATH' }, { status: 400 });
      try { await execAsync(`launchctl unload -w "${filePath}"`); } catch (e) { }
      try {
        await fs.rename(filePath, newFilePath);
      } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
        if (error.code === 'EACCES' || error.code === 'EXDEV' || error.code === 'EPERM') {
          await runCommandWithSudo(`mv "${filePath}" "${newFilePath}"`, sudoPassword);
        } else throw error;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
    if (error.code === 'SUDO_REQUIRED') {
      return NextResponse.json({ error: 'SUDO_REQUIRED' }, { status: 403 });
    }
    if (error.stderr?.toLowerCase().includes('password')) {
      return NextResponse.json({ error: 'SUDO_PASSWORD_INCORRECT' }, { status: 403 });
    }
    console.error('LaunchAgent Action Error:', error);
    return NextResponse.json({
      success: false,
      error: 'LAUNCHAGENT_ACTION_FAILED',
      details: error?.stderr || error?.message || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
