import { NextRequest, NextResponse } from 'next/server'
import { rawQuery } from '@/lib/db'

// GET order by tracking code
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const trackingCode = searchParams.get('code')

    if (!trackingCode) {
      return NextResponse.json(
        { error: 'Tracking code is required' },
        { status: 400 }
      )
    }

    // SECURITY FIX: Use parameterized query instead of string interpolation
    // This prevents SQL injection attacks by treating trackingCode as a parameter value
    const orders = await rawQuery<{
      id: number
      tracking_code: string
      status: string
      total: number
      created_at: Date
      shipping_name: string
      shipping_address: string
    }>(`
      SELECT id, tracking_code, status, total, created_at, shipping_name, shipping_address 
      FROM orders 
      WHERE tracking_code = $1
    `, [trackingCode])

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ order: orders[0] })
  } catch (error) {
    console.error('Order lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup order', details: String(error) },
      { status: 500 }
    )
  }
}