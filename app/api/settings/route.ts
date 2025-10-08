import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const settingsPath = join(process.cwd(), 'settings.json')
    const settingsContent = await readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error reading settings:', error)
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 })
  }
}

