import { NextRequest, NextResponse } from 'next/server'
import { executeCommand } from '@/lib/server-utils'

// Security fix: allowlist of safe, predefined diagnostic operations.
// The request-supplied value is only used as a lookup key and is never
// passed directly to the shell, preventing command injection.
const DIAGNOSTIC_OPERATIONS: Record<string, string> = {
  ping: 'ping -c 4 127.0.0.1',
  uptime: 'uptime',
  diskUsage: 'df -h',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command } = body

    if (!command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    // Security fix: resolve the requested operation from the allowlist.
    // Only predefined, trusted commands can be executed.
    const safeCommand = DIAGNOSTIC_OPERATIONS[command]
    if (!safeCommand) {
      return NextResponse.json(
        { error: 'Unsupported diagnostic operation' },
        { status: 400 }
      )
    }

    const output = await executeCommand(safeCommand)

    return NextResponse.json({ output })
  } catch (error) {
    console.error('Diagnostics error:', error)
    return NextResponse.json(
      { error: 'Command execution failed', details: String(error) },
      { status: 500 }
    )
  }
}
