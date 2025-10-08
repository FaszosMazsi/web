import { unlink, readdir, rm } from 'fs/promises';
import { join } from 'path';

export async function deleteFile(fileTag: string): Promise<boolean> {
  try {
    const uploadsDir = join(process.cwd(), 'uploads');
    const fileDir = join(uploadsDir, fileTag);

    if (!existsSync(fileDir)) {
      console.log(`Directory not found for fileTag: ${fileTag}`);
      return false;
    }

    const files = await readdir(fileDir);

    for (const file of files) {
      await unlink(join(fileDir, file));
    }

    await rm(fileDir, { recursive: true, force: true });

    console.log(`Successfully deleted files and directory for fileTag: ${fileTag}`);
    return true;
  } catch (error) {
    console.error(`Error deleting file with tag ${fileTag}:`, error);
    return false;
  }
}

