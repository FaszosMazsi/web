import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, existsSync } from 'fs'
import { readFile, writeFile, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { sendTelegramNotification } from '@/lib/telegram'
import { getTelegramUserByFileTag, getTelegramUserByChatId } from '@/lib/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: { tag: string; fileName: string } }
) {
  const { tag, fileName } = params
  const filePath = join(process.cwd(), 'uploads', tag, fileName)
  const metaPath = `${filePath}.meta`

  try {
    if (!existsSync(filePath) || !existsSync(metaPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    const metaContent = await readFile(metaPath, 'utf-8')
    const metadata = JSON.parse(metaContent)
    console.log('File metadata:', metadata);

    const { password } = await request.json()

    if (metadata.password && metadata.password !== password) {
      if (metadata.telegramChatId && metadata.notificationSettings?.wrongPassword) {
        await sendTelegramNotification(
          Number(metadata.telegramChatId),
          `❌ <b>Wrong Password</b>

Someone tried to access your file "${metadata.originalName}" but entered an incorrect password.`
        )
      }
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 403 }
      )
    }

    if (metadata.password && metadata.password === password && metadata.telegramChatId && metadata.notificationSettings?.validPassword) {
      await sendTelegramNotification(
        Number(metadata.telegramChatId),
        `✅ <b>Correct Password</b>

Someone successfully entered the correct password to access your file "${metadata.originalName}".`
      )
    }

    if (metadata.downloadLimit !== 0 && metadata.downloadCount >= metadata.downloadLimit) {
      return NextResponse.json(
        { error: 'Download limit reached' },
        { status: 403 }
      )
    }

    // Update metadata before sending the file
    metadata.downloads = (metadata.downloads || 0) + 1
    metadata.lastDownloadDate = new Date().toISOString()
    metadata.downloadCount = (metadata.downloadCount || 0) + 1
    await writeFile(metaPath, JSON.stringify(metadata))

    // Send Telegram notification if configured
    if (metadata.telegramChatId && metadata.notificationSettings?.fileDownloaded) {
      console.log('Attempting to send Telegram notification to chat ID:', metadata.telegramChatId);
      
      try {
        let telegramUser = await getTelegramUserByFileTag(tag);
        if (!telegramUser) {
          console.log('Telegram user not found by fileTag, attempting to find by chatId');
          telegramUser = await getTelegramUserByChatId(Number(metadata.telegramChatId));
        }
        
        if (telegramUser) {
          const link = telegramUser.links.find(link => link.fileTag === tag);
          if (link) {
            await sendTelegramNotification(
              Number(metadata.telegramChatId),
              `📥 <b>File Downloaded</b>

File name: <code>${metadata.originalName}</code>
Download count: ${metadata.downloadCount}

To unlink notifications for this link, use the command:
/unlink ${link.unlinkTag}`
            );
            console.log('Telegram notification sent successfully');
          } else {
            console.log('Link not found for fileTag:', tag);
          }
        } else {
          console.log('Telegram user not found for fileTag:', tag, 'and chatId:', metadata.telegramChatId);
        }
      } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        // Continue execution, even if the notification failed
      }
    } else {
      console.log('No Telegram chat ID found in metadata or notifications disabled');
    }

    // If download limit reached, schedule file deletion
    if (metadata.downloadLimit !== 0 && metadata.downloadCount >= metadata.downloadLimit) {
      setTimeout(async () => {
        try {
          await unlink(filePath)
          await unlink(metaPath)
          console.log(`File ${fileName} and its metadata have been deleted.`)
        } catch (error) {
          console.error(`Error deleting file ${fileName}:`, error)
        }
      }, 60 * 60 * 1000)
    }

    const stats = await stat(filePath)
    const stream = createReadStream(filePath)

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename=${encodeURIComponent(metadata.originalName)}`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error processing download:', error)
    return NextResponse.json(
      { error: 'Error processing download' },
      { status: 500 }
    )
  }
}

