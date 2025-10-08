import { NextRequest, NextResponse } from 'next/server'
import { createWriteStream } from 'fs'
import { mkdir, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'
import path from 'path'
import crypto from 'crypto'

function customNanoid(length: number = 21): string {
  return nanoid(length).replace(/-/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const expirationTime = formData.get('expirationTime') as string
    const downloadLimit = parseInt(formData.get('downloadLimit') as string) || 0
    const uploadId = formData.get('uploadId') as string || customNanoid()

    console.log('Received upload request:', { fileName: file.name, uploadId });

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Безопасная обработка имени файла
    const safeFileName = sanitizeFileName(file.name)
    
    // Проверка расширения файла
    if (!isAllowedFileExtension(safeFileName)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId)
    await mkdir(tempDir, { recursive: true })

    // Генерация случайного имени файла
    const randomFileName = `${crypto.randomBytes(16).toString('hex')}${path.extname(safeFileName)}`
    const filePath = path.join(tempDir, randomFileName)

    const writeStream = createWriteStream(filePath)

    const reader = file.stream().getReader()
    let bytesWritten = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writeStream.write(Buffer.from(value))
      bytesWritten += value.length
    }

    writeStream.end()

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    const metadata = {
      expirationTime: expirationTime,
      downloadLimit,
      originalName: safeFileName,
      downloads: 0,
      lastDownloadDate: null,
      uploadId: uploadId,
    }

    await writeFile(`${filePath}.meta`, JSON.stringify(metadata))

    console.log('File uploaded successfully:', { fileName: safeFileName, uploadId, bytesWritten });

    const filesInTemp = await readdir(tempDir);
    console.log('Files in temp directory:', filesInTemp);

    return NextResponse.json({ success: true, uploadId, bytesWritten })
  } catch (error) {
    console.error('Error in upload route:', error)
    return NextResponse.json(
      { error: 'Error saving file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

function sanitizeFileName(fileName: string): string {
  // Удаляем все недопустимые символы и заменяем пробелы на подчеркивания
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\s+/g, '_');
}

function isAllowedFileExtension(fileName: string): boolean {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
  const ext = path.extname(fileName).toLowerCase();
  return allowedExtensions.includes(ext);
}

