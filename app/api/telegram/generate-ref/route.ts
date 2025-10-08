import { NextRequest, NextResponse } from 'next/server'
import { generateTags, saveTelegramUser } from '@/lib/storage'

const TELEGRAM_BOT_NAME = process.env.TELEGRAM_BOT_NAME

export async function POST(request: NextRequest) {
  try {
    const { fileTag, unlinkTag } = generateTags();
    const refLink = `https://t.me/${TELEGRAM_BOT_NAME}?start=${fileTag}`
    
    await saveTelegramUser({
      fileTag,
      unlinkTag,
      chatId: 0,
      status: 'waiting'
    })

    return NextResponse.json({ refLink, fileTag, unlinkTag })
  } catch (error) {
    console.error('Error generating Telegram ref link:', error)
    return NextResponse.json({ error: 'Failed to generate Telegram ref link' }, { status: 500 })
  }
}

