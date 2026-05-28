import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
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

    const configPath = path.join(process.cwd(), 'analytics.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      return NextResponse.json({ success: true, key: config.aptabaseKey || '', version });
    }
    return NextResponse.json({ success: true, key: '', version });
  } catch (error) {
    console.error('Failed to read analytics.json:', error);
    return NextResponse.json({ success: false, error: 'FETCH_ANALYTICS_FAILED' }, { status: 500 });
  }
}
