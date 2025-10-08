const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET; // Добавьте это в ваш .env файл

export async function sendTelegramNotification(chatId: number, message: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token is not configured');
    return;
  }

  if (!chatId) {
    console.error('Chat ID is missing or invalid:', chatId);
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  console.log('Sending Telegram notification:', { chatId, message });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Telegram API error:', data);
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    console.log('Telegram notification sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    throw error;
  }
}

export async function removeTelegramNotifications(chatId: number, fileTag: string, adminSecret: string) {
  try {
    console.log('Removing Telegram notifications:', { chatId, fileTag });
    
    // Проверка прав администратора
    if (adminSecret !== ADMIN_SECRET) {
      throw new Error('Unauthorized access');
    }

    const message = `Уведомления для файла с тегом ${fileTag} были отключены администратором.`;
    await sendTelegramNotification(chatId, message);

    // Удаляем информацию о ссылке из хранилища Telegram пользователей
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://anon-files.tech';
    const response = await fetch(`${API_BASE_URL}/api/telegram-users`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}` // Добавляем заголовок авторизации
      },
      body: JSON.stringify({ chatId, fileTag }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to remove Telegram link:', errorData);
      throw new Error('Failed to remove Telegram link');
    }

    console.log(`Telegram notifications removed for chatId: ${chatId}, fileTag: ${fileTag}`);
  } catch (error) {
    console.error('Error removing Telegram notifications:', error);
    throw error;
  }
}

