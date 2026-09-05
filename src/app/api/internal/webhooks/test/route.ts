import { NextRequest, NextResponse } from 'next/server'
import { resolve4, resolve6 } from 'dns/promises'

function isPrivateIP(ip: string): boolean {
  // Block IPv4 private, loopback, link-local, and multicast ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b, c, d] = ip.split('.').map(Number)
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 192 && b === 0 && c === 0) return true
    if (a === 198 && b >= 18 && b <= 19) return true
    if (a >= 224) return true
    return false
  }
  // Block IPv6 loopback, link-local, unique-local, and multicast
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('fe80:')) return true
    if (lower.startsWith('ff')) return true
    return false
  }
  return false
}

async function validateUrl(urlStr: string): Promise<{ valid: boolean; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { valid: false, reason: 'Invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed' }
  }

  const hostname = parsed.hostname

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { valid: false, reason: 'Private addresses are not allowed' }
  }

  const allowlistEnv = process.env.WEBHOOK_TEST_ALLOWLIST
  const allowlist = allowlistEnv ? allowlistEnv.split(',').map(h => h.trim()).filter(Boolean) : undefined
  if (allowlist && allowlist.length > 0 && !allowlist.includes(hostname)) {
    return { valid: false, reason: 'URL not in allowlist' }
  }

  if (isPrivateIP(hostname)) {
    return { valid: false, reason: 'Private IP addresses are not allowed' }
  }

  try {
    const [v4, v6] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ])
    const addresses = [
      ...(v4.status === 'fulfilled' ? v4.value : []),
      ...(v6.status === 'fulfilled' ? v6.value : []),
    ]
    if (addresses.length === 0) {
      return { valid: false, reason: 'Unable to resolve hostname' }
    }
    if (addresses.some(isPrivateIP)) {
      return { valid: false, reason: 'Hostname resolves to a private IP address' }
    }
  } catch {
    return { valid: false, reason: 'Unable to resolve hostname' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Enforce authorization when INTERNAL_WEBHOOK_SECRET is configured
    const secret = process.env.INTERNAL_WEBHOOK_SECRET
    if (secret) {
      const authHeader = request.headers.get('x-internal-secret')
      if (authHeader !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const { url, event } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL and resolve host to prevent SSRF
    const validation = await validateUrl(url)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      )
    }

    // Construct webhook payload
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook from Devil\'s Advocate',
      },
    }

    // Enforce a 10-second outbound request timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    return NextResponse.json({
      message: `Webhook sent to ${url}`,
      status: response.status,
      statusText: response.statusText,
    })
  } catch (error) {
    console.error('Webhook test error:', error)
    return NextResponse.json(
      { error: 'Failed to send webhook', details: String(error) },
      { status: 500 }
    )
  }
}