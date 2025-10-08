import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { sendTelegramNotification } from '@/lib/telegram'

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const fileTag = params.tag
  const uploadDir = join(process.cwd(), 'uploads', fileTag)

  try {
    const files = await readdir(uploadDir)
    const fileInfoPromises = files
      .filter(fileName => !fileName.endsWith('.meta'))
      .map(async (fileName) => {
        const filePath = join(uploadDir, fileName)
        const metaPath = `${filePath}.meta`
        
        try {
          const stats = await stat(filePath)
          const metaContent = await readFile(metaPath, 'utf-8')
          const metadata = JSON.parse(metaContent)
          
          return {
            name: metadata.originalName,
            size: stats.size,
            systemName: fileName,
            downloadCount: metadata.downloadCount || 0,
            expirationTime: metadata.expirationTime,
            downloadLimit: metadata.downloadLimit,
            isPasswordProtected: !!metadata.password
          }
        } catch (error) {
          console.error(`Error reading file or metadata for ${fileName}:`, error)
          return null
        }
      })

    const fileInfos = (await Promise.all(fileInfoPromises)).filter(Boolean)

    if (fileInfos.length === 0) {
      return NextResponse.json({ error: 'No valid files found' }, { status: 404 })
    }

    return NextResponse.json({ files: fileInfos })
  } catch (error) {
    console.error('Error reading file information:', error)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error reading file information' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const fileTag = params.tag
  const uploadDir = join(process.cwd(), 'uploads', fileTag)

  try {
    const { password } = await request.json()
    const files = await readdir(uploadDir)
    const metaFile = files.find(file => file.endsWith('.meta'))

    if (!metaFile) {
      return NextResponse.json({ error: 'Metadata file not found' }, { status: 404 })
    }

    const metaPath = join(uploadDir, metaFile)
    const metaContent = await readFile(metaPath, 'utf-8')
    const metadata = JSON.parse(metaContent)

    if (metadata.password && metadata.password !== password) {
      if (metadata.telegramChatId && metadata.notificationSettings?.wrongPassword) {
        await sendTelegramNotification(
          Number(metadata.telegramChatId),
          `❌ <b>Wrong Password</b>

Someone tried to access your file "${metadata.originalName}" but entered an incorrect password.`
        )
      }
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    if (metadata.password && metadata.password === password && metadata.telegramChatId && metadata.notificationSettings?.validPassword) {
      await sendTelegramNotification(
        Number(metadata.telegramChatId),
        `✅ <b>Correct Password</b>

Someone successfully entered the correct password to access your file "${metadata.originalName}".`
      )
    }

    const fileInfo = {
      name: metadata.originalName,
      size: (await stat(join(uploadDir, files.find(f => !f.endsWith('.meta')) || ''))).size,
      downloadCount: metadata.downloadCount || 0,
      expirationTime: metadata.expirationTime,
      downloadLimit: metadata.downloadLimit
    }

    return NextResponse.json(fileInfo)
  } catch (error) {
    console.error('Error processing password check:', error)
    return NextResponse.json({ error: 'Error processing password check' }, { status: 500 })
  }
}

