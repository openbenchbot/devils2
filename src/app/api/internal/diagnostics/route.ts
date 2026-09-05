import { NextRequest, NextResponse } from 'next/server'

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

    // SECURITY FIX: Removed arbitrary command execution to prevent unauthenticated
    // command injection (CWE-78). Request input must never be passed to shell execution.
    return NextResponse.json(
      { error: 'Command execution is not permitted' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Diagnostics error:', error)
    return NextResponse.json(
      { error: 'Command execution failed', details: String(error) },
      { status: 500 }
    )
  }
}
