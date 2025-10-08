export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
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

async function getTelegramLinks(): Promise<TelegramLink[]> {
  try {
    if (!existsSync(LINKS_FILE)) {
      console.log('Links file does not exist');
      return [];
    }
    const data = await readFile(LINKS_FILE, 'utf-8');
    if (!data.trim()) {
      console.log('Links file is empty');
      return [];
    }
    const links = JSON.parse(data);
    console.log('Retrieved links:', links);
    return links;
  } catch (error) {
    console.error('Error reading telegram links:', error);
    return [];
  }
}

async function updateLinkStatus(linkTag: string): Promise<void> {
  try {
    const links = await getTelegramLinks();
    const updatedLinks = links.map(link => 
      link.linkTag === linkTag ? { ...link, used: true } : link
    );
    await writeFile(LINKS_FILE, JSON.stringify(updatedLinks, null, 2));
    console.log(`Updated status for link ${linkTag}`);
  } catch (error) {
    console.error('Error updating link status:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkTag = searchParams.get('linkTag');

    console.log('Checking link status for tag:', linkTag);

    if (!linkTag) {
      console.log('No linkTag provided');
      return NextResponse.json({ valid: false, error: 'Missing linkTag parameter' });
    }

    const links = await getTelegramLinks();
    console.log('Found links:', links);
    
    const link = links.find(l => l.linkTag === linkTag && !l.used);

    if (!link) {
      console.log('Link not found or already used:', linkTag);
      return NextResponse.json({ valid: false, error: 'Invalid or already used link' });
    }

    // Mark the link as used
    await updateLinkStatus(linkTag);
    console.log('Link validated and marked as used:', linkTag);

    // Link is valid and hasn't been used
    return NextResponse.json({
      valid: true,
      fileTag: link.fileTag,
      unlinkTag: link.unlinkTag
    });
  } catch (error) {
    console.error('Error in link status check:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Internal server error: ' + (error.message || 'Unknown error') 
    }, { status: 500 });
  }
}

