import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get('admin_auth_token')?.value

  if (authToken) {
    return NextResponse.json({ authenticated: true })
  }

  return NextResponse.json({ authenticated: false }, { status: 401 })
}

