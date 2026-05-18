import { NextResponse } from 'next/server';
import { execAsync } from '@/lib/exec';

interface PortEntry {
  protocol: string;
  port: number;
  address: string;
  endpoint: string;
  endpoints?: string[];
  connectionCount?: number;
  state: string;
}

interface PortProcessGroup {
  pid: string;
  command: string;
  user: string;
  cpu: string;
  mem: string;
  ppid: string;
  start: string;
  fullCommand: string;
  ports: PortEntry[];
}

const STATE_ORDER: Record<string, number> = {
  LISTEN: 0,
  ESTABLISHED: 1,
  UDP: 2,
};

function extractPort(endpoint: string) {
  const localEndpoint = endpoint.split('->')[0].trim();
  const match = localEndpoint.match(/:(\d+)(?:\s|$)/);

  if (!match) return null;

  const port = Number(match[1]);
  if (!Number.isFinite(port)) return null;

  return {
    port,
    address: localEndpoint.replace(/:\d+$/, '') || '*',
  };
}

function parseLsofLine(line: string) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 9) return null;

  const command = parts[0];
  const pid = parts[1];
  const user = parts[2];
  const protocol = parts[7];
  const rawName = parts.slice(8).join(' ');
  const stateMatch = rawName.match(/\(([^)]+)\)$/);
  const state = stateMatch?.[1] || (protocol === 'UDP' ? 'UDP' : '');
  const endpoint = rawName.replace(/\s+\([^)]+\)$/, '');
  const portInfo = extractPort(endpoint);

  if (!/^\d+$/.test(pid) || !portInfo) return null;

  return {
    command,
    pid,
    user,
    port: {
      protocol,
      port: portInfo.port,
      address: portInfo.address,
      endpoint,
      state,
    },
  };
}

async function getProcessInfo(pid: string) {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o pid,ppid,pcpu,pmem,start,user -ww | tail -n +2`);
    const line = stdout.trim();
    if (!line) return null;

    const parts = line.split(/\s+/);
    const parsedPid = parts[0];
    const ppid = parts[1] || '';
    const cpu = parts[2] || '0.0';
    const mem = parts[3] || '0.0';
    const user = parts[parts.length - 1] || '';
    const start = parts.slice(4, parts.length - 1).join(' ');
    const { stdout: commandOut } = await execAsync(`ps -p ${pid} -o command= -ww`);
    const fullCommand = commandOut.trim();

    return { pid: parsedPid, ppid, cpu, mem, user, start, fullCommand };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    let stdout = '';

    try {
      const result = await execAsync('lsof -nP -iTCP -iUDP');
      stdout = result.stdout;
    } catch (error: unknown) {
      const err = error as { stdout?: string; message?: string };
      stdout = err.stdout || '';
      if (!stdout.trim()) {
        return NextResponse.json({ success: true, data: [], summary: { processes: 0, ports: 0, listening: 0 } });
      }
    }

    const rows = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('COMMAND'))
      .map(parseLsofLine)
      .filter((row): row is NonNullable<ReturnType<typeof parseLsofLine>> => Boolean(row));

    const groups = new Map<string, PortProcessGroup>();

    for (const row of rows) {
      const existing = groups.get(row.pid);
      if (existing) {
        existing.ports.push(row.port);
      } else {
        groups.set(row.pid, {
          pid: row.pid,
          command: row.command,
          user: row.user,
          cpu: '0.0',
          mem: '0.0',
          ppid: '',
          start: '',
          fullCommand: row.command,
          ports: [row.port],
        });
      }
    }

    await Promise.all(Array.from(groups.values()).map(async group => {
      const info = await getProcessInfo(group.pid);
      if (!info) return;

      group.ppid = info.ppid;
      group.cpu = info.cpu;
      group.mem = info.mem;
      group.user = info.user || group.user;
      group.start = info.start;
      group.fullCommand = info.fullCommand || group.fullCommand;
      group.command = (info.fullCommand || group.command).split('/').pop()?.split(/\s+/)[0] || group.command;
    }));

    const data = Array.from(groups.values())
      .map(group => ({
        ...group,
        ports: Array.from(group.ports.reduce((map, port) => {
          const key = `${port.protocol}:${port.port}:${port.state || ''}`;
          const existing = map.get(key);

          if (existing) {
            const endpoints = existing.endpoints || [];
            if (!endpoints.includes(port.endpoint)) {
              endpoints.push(port.endpoint);
            }
            existing.endpoints = endpoints;
            existing.connectionCount = (existing.connectionCount || 1) + 1;
          } else {
            map.set(key, {
              ...port,
              endpoints: [port.endpoint],
              connectionCount: 1,
            });
          }

          return map;
        }, new Map<string, PortEntry>()).values())
          .map(port => ({
            ...port,
            endpoint: port.endpoints?.[0] || port.endpoint,
            address: (port.endpoints?.length || 0) > 1 ? `${port.endpoints?.length} endpoints` : port.address,
          }))
          .sort((a, b) => (
            (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) ||
            a.port - b.port ||
            a.protocol.localeCompare(b.protocol)
          )),
      }))
      .sort((a, b) => (
        Math.min(...a.ports.map(port => port.port)) - Math.min(...b.ports.map(port => port.port)) ||
        a.command.localeCompare(b.command)
      ));

    return NextResponse.json({
      success: true,
      data,
      summary: {
        processes: data.length,
        ports: data.reduce((sum, group) => sum + group.ports.length, 0),
        listening: data.reduce((sum, group) => sum + group.ports.filter(port => port.state === 'LISTEN').length, 0),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: 'FETCH_PORTS_FAILED', details: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, pid } = await request.json();

    if ((action === 'kill' || action === 'term') && pid) {
      if (!/^\d+$/.test(pid)) {
        return NextResponse.json({ error: 'INVALID_PID' }, { status: 400 });
      }

      const signal = action === 'kill' ? '-9' : '-15';
      try {
        await execAsync(`kill ${signal} ${pid}`);
        return NextResponse.json({ success: true });
      } catch (error: unknown) {
        const err = error as Error;
        const msg = err.message || '';
        if (msg.includes('Operation not permitted') || msg.includes('Permission denied')) {
          return NextResponse.json({ error: 'PERMISSION_DENIED' }, { status: 403 });
        }
        return NextResponse.json({ error: 'PORT_PROCESS_ACTION_FAILED', details: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: 'EXECUTION_FAILED', details: err.message }, { status: 500 });
  }
}
