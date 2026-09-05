import { NextRequest, NextResponse } from 'next/server'
import { prisma, rawQuery } from '@/lib/db'
import { verifyPassword, generateToken, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Query user - use parameterized Prisma raw query to prevent SQL injection
    // The tagged template literal automatically parameterizes the interpolated value
    const users = await prisma.$queryRaw<{
      id: number
      email: string
      password: string
      name: string
      role: string
    }[]>`SELECT id, email, password, name, role FROM users WHERE email = ${email} LIMIT 1`

    const user = users[0]

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }

    const token = generateToken(tokenPayload)
    const session = createSession(tokenPayload)

    // Create response with cookies
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    })

    // Set cookies
    response.cookies.set('token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    response.cookies.set('session', session, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An error occurred during login', details: String(error) },
      { status: 500 }
    )
  }
}
