import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';

const STORAGE_FILE = join(process.cwd(), 'data', 'telegram-users.json');

interface TelegramUser {
  chatId: number;
  status: 'active' | 'inactive';
  links: {
    fileTag: string;
    unlinkTag: string;
  }[];
}

export function generateTags(): { fileTag: string; unlinkTag: string } {
  return {
    fileTag: nanoid(10),
    unlinkTag: nanoid(16)
  };
}

export async function saveTelegramUser(user: TelegramUser): Promise<void> {
  try {
    const users = await getTelegramUsers();
    const existingUserIndex = users.findIndex(u => u.chatId === user.chatId);
    if (existingUserIndex !== -1) {
      users[existingUserIndex] = user;
    } else {
      users.push(user);
    }
    console.log('Saving Telegram user:', user);
    await writeFile(STORAGE_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving Telegram user:', error);
    throw error;
  }
}

export async function getTelegramUsers(): Promise<TelegramUser[]> {
  try {
    const data = await readFile(STORAGE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    console.error('Error reading Telegram users:', error);
    throw error;
  }
}

export async function addLinkToTelegramUser(chatId: number, fileTag: string, unlinkTag: string): Promise<void> {
  try {
    const users = await getTelegramUsers();
    const userIndex = users.findIndex(user => user.chatId === chatId);
    if (userIndex !== -1) {
      if (!users[userIndex].links) {
        users[userIndex].links = [];
      }
      users[userIndex].links.push({ fileTag, unlinkTag });
      users[userIndex].status = 'active';
      console.log('Adding link to Telegram user:', { chatId, fileTag, unlinkTag });
      await writeFile(STORAGE_FILE, JSON.stringify(users, null, 2));
    } else {
      console.log('User not found, creating new user');
      await saveTelegramUser({
        chatId,
        status: 'active',
        links: [{ fileTag, unlinkTag }]
      });
    }
  } catch (error) {
    console.error('Error adding link to Telegram user:', error);
    throw error;
  }
}

export async function removeLinkFromTelegramUser(chatId: number, identifier: string): Promise<boolean> {
  try {
    console.log(`Attempting to remove link for chatId: ${chatId}, identifier: ${identifier}`);
    
    const users = await getTelegramUsers();
    const userIndex = users.findIndex(user => user.chatId === chatId);
    
    if (userIndex === -1) {
      console.log(`No user found for chatId: ${chatId}`);
      return false;
    }
    
    const linkIndex = users[userIndex].links.findIndex(link => 
      link.unlinkTag === identifier || link.fileTag === identifier
    );
    
    if (linkIndex === -1) {
      console.log(`No link found for identifier: ${identifier}`);
      return false;
    }
    
    const { fileTag, unlinkTag } = users[userIndex].links[linkIndex];
    users[userIndex].links.splice(linkIndex, 1);
    
    if (users[userIndex].links.length === 0) {
      users[userIndex].status = 'inactive';
    }
    
    await writeFile(STORAGE_FILE, JSON.stringify(users, null, 2));
    console.log(`Removed link for chatId: ${chatId}, fileTag: ${fileTag}, unlinkTag: ${unlinkTag}`);

    // Update file metadata
    const uploadsDir = join(process.cwd(), 'uploads');
    const metaPath = join(uploadsDir, fileTag, `${fileTag}.meta`);
    
    if (existsSync(metaPath)) {
      const metaContent = await readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(metaContent);
      
      if (metadata.telegramChatId == chatId) {
        console.log(`Found matching metadata for chatId: ${chatId}, fileTag: ${fileTag}`);
        delete metadata.telegramChatId;
        await writeFile(metaPath, JSON.stringify(metadata, null, 2));
        console.log(`Updated metadata for file with fileTag: ${fileTag}`);
      } else {
        console.log(`Metadata chatId mismatch: expected ${chatId}, found ${metadata.telegramChatId}`);
      }
    } else {
      console.log(`No matching metadata found for fileTag: ${fileTag}`);
    }

    return true;
  } catch (error) {
    console.error('Error removing link from Telegram user:', error);
    return false;
  }
}

export async function getTelegramUserByChatId(chatId: number): Promise<TelegramUser | null> {
  try {
    const users = await getTelegramUsers();
    const user = users.find(user => user.chatId === chatId);
    console.log('Getting Telegram user by chatId:', { chatId, user });
    return user || null;
  } catch (error) {
    console.error('Error getting Telegram user by chatId:', error);
    throw error;
  }
}

export async function getTelegramUserByFileTag(fileTag: string): Promise<TelegramUser | null> {
  try {
    const users = await getTelegramUsers();
    const user = users.find(user => user.links.some(link => link.fileTag === fileTag));
    console.log('Getting Telegram user by fileTag:', { fileTag, user });
    return user || null;
  } catch (error) {
    console.error('Error getting Telegram user by fileTag:', error);
    throw error;
  }
}

export async function getTelegramUserByUnlinkTag(unlinkTag: string): Promise<TelegramUser | null> {
  try {
    const users = await getTelegramUsers();
    const user = users.find(user => user.links.some(link => link.unlinkTag === unlinkTag));
    console.log('Getting Telegram user by unlinkTag:', { unlinkTag, user });
    return user || null;
  } catch (error) {
    console.error('Error getting Telegram user by unlinkTag:', error);
    throw error;
  }
}

