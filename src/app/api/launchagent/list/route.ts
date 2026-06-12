import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'agent';

    const homeDir = process.env.HOME || '/Users/chentao';
    let agentsDir = '';

    if (type === 'daemon') {
      agentsDir = '/Library/LaunchDaemons';
    } else {
      agentsDir = path.join(homeDir, 'Library', 'LaunchAgents');
    }

    // Fallback if no dir exists
    if (!await fs.stat(agentsDir).catch(() => false)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const files = (await fs.readdir(agentsDir)).filter(f => f.endsWith('.plist'));
    const plists = await Promise.all(files.map(async f => {
      const fullPath = path.join(agentsDir, f);
      const stat = await fs.stat(fullPath);
      return {
        name: f,
        path: fullPath,
        size: stat.size,
        mtime: stat.mtime.getTime()
      };
    }));

    // Get loaded services
    // Note: launchctl list run by standard user may only show user's agents.
    // For system daemons, we still try standard launchctl list, but it might not list them.
    let stdout = '';
    try {
      const result = await execAsync('launchctl list', { maxBuffer: 100 * 1024 * 1024 });
      stdout = result.stdout;
    } catch {
      // ignore
    }
    const loadedList = stdout.split('\n');

    const enrichedPlists = await Promise.all(plists.map(async p => {
      try {
        // Use plutil to get the real Label from the plist file
        const { stdout: label } = await execAsync(`plutil -extract Label raw "${p.path}"`);
        const cleanLabel = label.trim();
        const isLoaded = loadedList.some(l => l.includes(cleanLabel));
        return { ...p, isLoaded, label: cleanLabel };
      } catch (e) {
        // Fallback to filename if plutil fails
        const label = p.name.replace('.plist', '');
        const isLoaded = loadedList.some(l => l.includes(label));
        return { ...p, isLoaded, label };
      }
    }));

    return NextResponse.json({ success: true, data: enrichedPlists });
  } catch (error: any) {
    return NextResponse.json({ error: 'FETCH_FAILED', details: error?.message }, { status: 500 });
  }
}
