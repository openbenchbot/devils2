import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import jwt from 'jsonwebtoken'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET user by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        // Removed sensitive fields (resetToken, preferences) to prevent data exposure
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user', details: String(error) },
      { status: 500 }
    )
  }
}

// PUT update user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    // Authenticate with a signed token; never trust the unsigned legacy session.
    const token = request.cookies.get('token')?.value
    const secret = process.env.JWT_SECRET
    if (!secret) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let actor: jwt.JwtPayload
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
      if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId)) throw new Error('Invalid token')
      actor = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    if (actor.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 })
    const allowed = ['name', 'bio', 'avatarUrl'] as const
    if (Object.keys(body).some(key => !allowed.includes(key as typeof allowed[number])) || allowed.some(key => body[key] !== undefined && typeof body[key] !== 'string')) {
      return NextResponse.json({ error: 'Only profile fields may be updated' }, { status: 400 })
    }
    const data: { name?: string; bio?: string; avatarUrl?: string } = {}
    for (const key of allowed) if (body[key] !== undefined) data[key] = body[key]

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE user - requires authentication and ownership
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    // Require authentication for user deletion
    const token = request.cookies.get('token')?.value
    const secret = process.env.JWT_SECRET
    if (!secret) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let actor: jwt.JwtPayload
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
      if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId)) throw new Error('Invalid token')
      actor = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    // Only allow users to delete their own account
    if (actor.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: String(error) },
      { status: 500 }
    )
  }
}
