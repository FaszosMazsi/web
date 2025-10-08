import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const STORAGE_FILE = join(process.cwd(), 'data', 'telegram-users.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET;

interface TelegramUser {
  chatId: number;
  status: 'active' | 'inactive';
  links: {
    fileTag: string;
    unlinkTag: string;
  }[];
}

async function getTelegramUsers(): Promise<TelegramUser[]> {
  if (!existsSync(STORAGE_FILE)) {
    return [];
  }
  const data = await readFile(STORAGE_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveTelegramUsers(users: TelegramUser[]): Promise<void> {
  await writeFile(STORAGE_FILE, JSON.stringify(users, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const fileTag = searchParams.get('fileTag');
    const unlinkTag = searchParams.get('unlinkTag');

    const users = await getTelegramUsers();

    if (chatId) {
      const user = users.find(u => u.chatId === Number(chatId));
      return NextResponse.json(user || null);
    } else if (fileTag) {
      const user = users.find(u => u.links.some(link => link.fileTag === fileTag));
      return NextResponse.json(user || null);
    } else if (unlinkTag) {
      const user = users.find(u => u.links.some(link => link.unlinkTag === unlinkTag));
      return NextResponse.json(user || null);
    } else {
      return NextResponse.json(users);
    }
  } catch (error) {
    console.error('Error getting Telegram users:', error);
    return NextResponse.json({ error: 'Failed to get Telegram users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { chatId, fileTag, unlinkTag } = await request.json();
    const users = await getTelegramUsers();
    const userIndex = users.findIndex(u => u.chatId === chatId);

    if (userIndex !== -1) {
      users[userIndex].links.push({ fileTag, unlinkTag });
      users[userIndex].status = 'active';
    } else {
      users.push({
        chatId,
        status: 'active',
        links: [{ fileTag, unlinkTag }]
      });
    }

    await saveTelegramUsers(users);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Telegram user:', error);
    return NextResponse.json({ error: 'Failed to save Telegram user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Проверка авторизации
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, fileTag } = await request.json();
    console.log('Deleting link:', { chatId, fileTag });
    
    const users = await getTelegramUsers();
    const userIndex = users.findIndex(u => u.chatId === chatId);

    if (userIndex !== -1) {
      const linkIndex = users[userIndex].links.findIndex(link => link.fileTag === fileTag);

      if (linkIndex !== -1) {
        users[userIndex].links.splice(linkIndex, 1);
        if (users[userIndex].links.length === 0) {
          users[userIndex].status = 'inactive';
        }
        await saveTelegramUsers(users);
        console.log('Successfully removed link from user');
        return NextResponse.json({ success: true });
      }
    }

    console.log('User or link not found');
    return NextResponse.json({ error: 'User or link not found' }, { status: 404 });
  } catch (error) {
    console.error('Error removing Telegram link:', error);
    return NextResponse.json({ error: 'Failed to remove Telegram link' }, { status: 500 });
  }
}

