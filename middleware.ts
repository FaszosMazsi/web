import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // Получаем текущий путь
  const path = request.nextUrl.pathname
  const authToken = request.cookies.get('admin_auth_token')?.value

  // Если пользователь пытается получить доступ к /admin/login, будучи уже авторизованным
  if (path === '/admin/login' && authToken) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Если пользователь пытается получить доступ к защищенным маршрутам без авторизации
  if (path.startsWith('/admin') && path !== '/admin/login' && !authToken) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Для API маршрутов просто проверяем авторизацию
  if (path.startsWith('/api/admin') && path !== '/api/admin/login' && !authToken) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const response = NextResponse.next()

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

