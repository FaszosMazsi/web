import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { removeTelegramNotifications } from '@/lib/telegram'

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function checkAuth(request: NextRequest) {
  const authToken = request.cookies.get('admin_auth_token')?.value
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  try {
    const uploadsDir = join(process.cwd(), 'uploads')
    const dirs = await readdir(uploadsDir)
    
    const links = await Promise.all(dirs.map(async (dir) => {
      const dirPath = join(uploadsDir, dir)
      const files = await readdir(dirPath)
      const metaFile = files.find(file => file.endsWith('.meta'))
      let telegramInfo = null
      let totalSize = 0

      for (const file of files) {
        if (!file.endsWith('.meta')) {
          const filePath = join(dirPath, file)
          const fileStats = await stat(filePath)
          totalSize += fileStats.size
        }
      }

      if (metaFile) {
        const metaPath = join(dirPath, metaFile)
        const metaContent = await readFile(metaPath, 'utf-8')
        const metadata = JSON.parse(metaContent)
        if (metadata.telegramChatId) {
          telegramInfo = {
            chatId: metadata.telegramChatId,
            notificationSettings: metadata.notificationSettings || {}
          }
        }
      }

      return {
        id: dir,
        url: `/s/${dir}`,
        fileCount: files.filter(file => !file.endsWith('.meta')).length,
        totalSize,
        telegramInfo
      }
    }))

    return NextResponse.json(links)
  } catch (error) {
    console.error('Error fetching links:', error)
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    const dirPath = join(process.cwd(), 'uploads', id)
    const metaPath = join(dirPath, `${id}.meta`)

    // Проверяем, есть ли метаданные с информацией о Telegram
    if (existsSync(metaPath)) {
      const metaContent = await readFile(metaPath, 'utf-8')
      const metadata = JSON.parse(metaContent)
      if (metadata.telegramChatId) {
        // Если есть информация о Telegram, удаляем уведомления
        await removeTelegramNotifications(metadata.telegramChatId, id, ADMIN_SECRET)
      }
    }

    // Удаляем директорию с файлами
    await rm(dirPath, { recursive: true, force: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting link:', error)
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
  }
}

