import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const LINKS_FILE = join(process.cwd(), 'data', 'telegram-links.json');

interface TelegramLink {
  linkTag: string;
  fileTag: string;
  unlinkTag: string;
  used: boolean;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { linkTag, fileTag, unlinkTag } = await request.json();

    if (!linkTag || !fileTag || !unlinkTag) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Ensure the data directory exists
    const dataDir = join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });

    // Initialize or read existing links
    let links: TelegramLink[] = [];
    if (existsSync(LINKS_FILE)) {
      const content = await readFile(LINKS_FILE, 'utf-8');
      links = content ? JSON.parse(content) : [];
    }

    // Add new link
    const newLink: TelegramLink = {
      linkTag,
      fileTag,
      unlinkTag,
      used: false,
      createdAt: new Date().toISOString()
    };

    links.push(newLink);
    console.log('Saving new Telegram link:', newLink);

    // Write updated links to file
    await writeFile(LINKS_FILE, JSON.stringify(links, null, 2));
    console.log('Successfully saved Telegram link to file');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Telegram link:', error);
    return NextResponse.json(
      { error: 'Failed to save Telegram link' },
      { status: 500 }
    );
  }
}

