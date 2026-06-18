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
    let hasDaemons = true;

    try {
      const daemonFiles = await fs.readdir('/Library/LaunchDaemons');
      if (daemonFiles.filter(f => f.endsWith('.plist')).length === 0) {
        hasDaemons = false;
      }
    } catch {
      hasDaemons = false;
    }

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
    const plistsRaw = await Promise.all(files.map(async f => {
      const fullPath = path.join(agentsDir, f);
      try {
        const stat = await fs.stat(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stat.size,
          mtime: stat.mtime.getTime()
        };
      } catch (e) {
        return null; // Ignore files we can't stat
      }
    }));
    const plists = plistsRaw.filter(p => p !== null) as NonNullable<typeof plistsRaw[0]>[];

    // Get loaded services
    let stdout = '';
    try {
      if (type === 'daemon') {
        const result = await execAsync('launchctl print system', { maxBuffer: 100 * 1024 * 1024 });
        stdout = result.stdout;
      } else {
        const result = await execAsync('launchctl list', { maxBuffer: 100 * 1024 * 1024 });
        stdout = result.stdout;
      }
    } catch {
      // ignore
    }

    let loadedList: string[] = [];
    if (type === 'daemon') {
      const lines = stdout.split('\n');
      let inServices = false;
      for (const line of lines) {
        if (line.match(/^\s*services = {/)) {
          inServices = true;
          continue;
        }
        if (inServices && line.match(/^\s*}/)) {
          inServices = false;
          break; // Stop parsing after services block
        }
        if (inServices) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            // Label is the 3rd column
            loadedList.push(parts[2]);
          }
        }
      }
    } else {
      loadedList = stdout.split('\n');
    }

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

    return NextResponse.json({ success: true, data: enrichedPlists, hasDaemons });
  } catch (e: unknown) { const error = e as { code?: string; stderr?: string; message?: string };
    return NextResponse.json({ error: 'FETCH_FAILED', details: error?.message }, { status: 500 });
  }
}
