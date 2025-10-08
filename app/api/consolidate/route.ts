import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readdir, rename, writeFile, readFile, rm, stat } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { expirationTime, downloadLimit, password, telegramChatId, telegramFileTag, telegramUnlinkTag, telegramLinkTag, uploadId, notificationSettings } = await request.json()
    console.log('Received consolidate request:', { expirationTime, downloadLimit, uploadId });

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 })
    }

    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId)
    const files = await readdir(tempDir)
    
    console.log('Files in temp directory:', files);

    if (files.length === 0) {
      console.log('No files to consolidate');
      return NextResponse.json({ error: 'No files to consolidate' }, { status: 400 })
    }

    const fileTag = telegramFileTag || nanoid(10);
    const consolidatedDir = path.join(process.cwd(), 'uploads', fileTag)
    await mkdir(consolidatedDir, { recursive: true })

    for (const file of files) {
      const oldPath = path.join(tempDir, file)
      const newFileName = `${crypto.randomBytes(16).toString('hex')}${path.extname(file)}`
      const newPath = path.join(consolidatedDir, newFileName)
      await rename(oldPath, newPath)
      
      if (file.endsWith('.meta')) {
        const metaContent = await readFile(newPath, 'utf-8')
        const metadata = JSON.parse(metaContent)
        metadata.expirationTime = expirationTime
        metadata.downloadLimit = downloadLimit
        metadata.password = password
        if (telegramChatId) {
          metadata.telegramChatId = telegramChatId
          metadata.telegramFileTag = telegramFileTag
          metadata.telegramUnlinkTag = telegramUnlinkTag
          metadata.telegramLinkTag = telegramLinkTag
          metadata.notificationSettings = notificationSettings
        }
        console.log('Saving metadata for file:', newFileName, metadata);
        await writeFile(newPath, JSON.stringify(metadata))
      }
    }

    await rm(tempDir, { recursive: true, force: true })

    const consolidatedFiles = await readdir(consolidatedDir)
    console.log('Files in consolidated directory:', consolidatedFiles);

    // Clean up old temporary directories
    const tempBaseDir = path.join(process.cwd(), 'uploads', 'temp');
    const tempDirs = await readdir(tempBaseDir);
    const currentTime = Date.now();
    const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

    for (const dir of tempDirs) {
      try {
        const dirPath = path.join(tempBaseDir, dir);
        const stats = await stat(dirPath);
        if (currentTime - stats.mtimeMs > ONE_HOUR) {
          await rm(dirPath, { recursive: true, force: true });
          console.log(`Cleaned up old temp directory: ${dir}`);
        }
      } catch (error) {
        console.error(`Error cleaning up temp directory ${dir}:`, error);
      }
    }

    const shareLink = `/s/${fileTag}`
    console.log('Consolidation complete, shareLink:', shareLink);
    return NextResponse.json({ shareLink })
  } catch (error) {
    console.error('Error in consolidate route:', error)
    return NextResponse.json(
      { error: 'Error consolidating files: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

