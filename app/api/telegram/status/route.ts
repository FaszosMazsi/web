import { NextRequest, NextResponse } from 'next/server'
import { getTelegramUserByFileTag } from '@/lib/storage'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileTag = searchParams.get('fileTag')

  console.log('Received status request for fileTag:', fileTag);

  if (!fileTag) {
    console.log('Missing fileTag parameter');
    return NextResponse.json({ error: 'Missing fileTag parameter' }, { status: 400 })
  }

  try {
    const user = await getTelegramUserByFileTag(fileTag)
    console.log('User found for fileTag:', user);
    if (user) {
      return NextResponse.json({ status: user.status, chatId: user.chatId })
    } else {
      console.log('User not found for fileTag:', fileTag);
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error checking Telegram status:', error)
    return NextResponse.json({ error: 'Failed to check Telegram status' }, { status: 500 })
  }
}

