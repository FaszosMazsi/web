import { NextRequest, NextResponse } from 'next/server'
import { removeLinkFromTelegramUser, getTelegramUserByFileTag } from '@/lib/storage'
import { deleteFile } from '@/lib/fileManager'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://anon-files.tech';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://anon-files.tech';

export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    console.log('Received Telegram update:', JSON.stringify(update));
    
    if (update.message && update.message.text.startsWith('/start')) {
      const linkTag = update.message.text.split(' ')[1]
      const chatId = update.message.chat.id
      
      console.log(`Processing /start command: linkTag=${linkTag}, chatId=${chatId}`);
      
      // First, check if this link tag exists and hasn't been used
      const linkResponse = await fetch(`${API_BASE_URL}/api/telegram-users/link-status?linkTag=${linkTag}`);
      const linkStatus = await linkResponse.json();
      
      if (!linkStatus.valid) {
        await sendTelegramMessage(chatId, 'Error: invalid or already used link for notification binding.');
        return NextResponse.json({ success: false });
      }

      const userResponse = await fetch(`${API_BASE_URL}/api/telegram-users?chatId=${chatId}`);
      const user = await userResponse.json();

      if (user) {
        console.log(`User found: ${JSON.stringify(user)}`);
        await fetch(`${API_BASE_URL}/api/telegram-users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            fileTag: linkStatus.fileTag,
            unlinkTag: linkStatus.unlinkTag,
            linkTag
          }),
        });
        await sendTelegramMessage(chatId, `You have successfully added a new link to your notifications!

To unlink notifications for this link, use the command:
/unlink ${linkStatus.unlinkTag}

To view a list of all your active links, use the command:
/list`)
      } else {
        console.log(`User not found, creating new user`);
        await fetch(`${API_BASE_URL}/api/telegram-users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            fileTag: linkStatus.fileTag,
            unlinkTag: linkStatus.unlinkTag,
            linkTag
          }),
        });
        await sendTelegramMessage(chatId, `You have successfully connected notifications to your files!

To unlink notifications for this link, use the command:
/unlink ${linkStatus.unlinkTag}

To view a list of all your active links, use the command:
/list`)
      }
    } else if (update.message && update.message.text.startsWith('/unlink')) {
      const chatId = update.message.chat.id
      const unlinkTag = update.message.text.split(' ')[1]
      
      console.log(`Processing /unlink command: unlinkTag=${unlinkTag}, chatId=${chatId}`);
      
      if (!unlinkTag) {
        await sendTelegramMessage(chatId, 'Please specify the tag to unlink after the /unlink command.')
        return NextResponse.json({ success: true })
      }
      
      const result = await fetch(`${API_BASE_URL}/api/telegram-users`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, unlinkTag }),
      });

      if (result.ok) {
        await sendTelegramMessage(chatId, `Notifications for the specified link have been successfully disabled.`)
      } else {
        await sendTelegramMessage(chatId, `An error occurred while disabling notifications. Please check the tag correctness or try again.`)
      }
    } else if (update.message && update.message.text === '/list') {
      const chatId = update.message.chat.id
      const userResponse = await fetch(`${API_BASE_URL}/api/telegram-users?chatId=${chatId}`);
      const user = await userResponse.json();
      
      if (user && user.links && user.links.length > 0) {
        let messageText = '<b>Your active links:</b>\n\n';
        
        for (const link of user.links) {
          const fileInfoResponse = await fetch(`${API_BASE_URL}/api/file-info/${link.fileTag}`);
          const fileInfo = await fileInfoResponse.json();
          
          if (fileInfo && fileInfo.files && fileInfo.files.length > 0) {
            const file = fileInfo.files[0]; // Предполагаем, что у нас один файл на ссылку
            messageText += `🔗 <b>File:</b> ${file.name}\n`;
            messageText += `📥 <b>Link:</b> ${process.env.NEXT_PUBLIC_APP_URL}/s/${link.fileTag}\n`;
            messageText += `🔓 <b>Unlink command:</b> /unlink ${link.unlinkTag}\n`;
            messageText += `📊 <b>Downloads:</b> ${file.downloadCount}`;
            if (file.downloadLimit > 0) {
              messageText += ` / ${file.downloadLimit}`;
            }
            messageText += '\n\n';
          }
        }
        
        await sendTelegramMessage(chatId, messageText);
      } else {
        await sendTelegramMessage(chatId, 'You have no active links.');
      }
    } else if (update.message && update.message.text.startsWith('/delete')) {
      const chatId = update.message.chat.id
      const fileTag = update.message.text.split(' ')[1]
      
      if (!fileTag) {
        await sendTelegramMessage(chatId, 'Please specify the file tag to delete after the /delete command.')
        return NextResponse.json({ success: true })
      }
      
      const user = await getTelegramUserByFileTag(fileTag)
      
      if (!user || user.chatId !== chatId) {
        await sendTelegramMessage(chatId, 'You do not have permission to delete this file or the file does not exist.')
        return NextResponse.json({ success: true })
      }
      
      const deleteResult = await deleteFile(fileTag)
      
      if (deleteResult) {
        await removeLinkFromTelegramUser(chatId, fileTag)
        await sendTelegramMessage(chatId, `File with tag ${fileTag} has been successfully deleted.`)
      } else {
        await sendTelegramMessage(chatId, `An error occurred while deleting the file with tag ${fileTag}.`)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing Telegram webhook:', error)
    return NextResponse.json({ error: 'Failed to process Telegram webhook' }, { status: 500 })
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML' // Added parse_mode for HTML formatting
    }),
  })

  if (!response.ok) {
    console.error('Failed to send Telegram message:', await response.text())
    throw new Error('Failed to send Telegram message')
  }
}

