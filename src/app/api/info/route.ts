import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';

export async function GET() {
  let version = '';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = pkg.version;
    }
  } catch (e) {
    console.error('Error reading package.json version:', e);
  }

  return NextResponse.json({
    success: true,
    data: {
      version,
      hostname: os.hostname(),
    }
  });
}
