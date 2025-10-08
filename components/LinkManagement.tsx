'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, ExternalLink, Bell, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface Link {
  id: string
  url: string
  fileCount: number
  totalSize: number
  telegramInfo?: {
    chatId: number
    notificationSettings: {
      wrongPassword: boolean
      validPassword: boolean
      fileDownloaded: boolean
    }
  }
  isDeleting?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function LinkManagement() {
  const [links, setLinks] = useState<Link[]>([])
  const [selectedLink, setSelectedLink] = useState<Link | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchLinks()
  }, [])

  const fetchLinks = async () => {
    const response = await fetch('/api/admin/links')
    if (response.ok) {
      const data = await response.json()
      setLinks(data)
    }
  }

  const deleteLink = async (id: string) => {
    try {
      setLinks(prevLinks => prevLinks.map(link => 
        link.id === id ? { ...link, isDeleting: true } : link
      ));

      const response = await fetch(`/api/admin/links?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLinks(prevLinks => prevLinks.filter(link => link.id !== id));
      } else {
        throw new Error('Failed to delete link');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      setLinks(prevLinks => prevLinks.map(link => 
        link.id === id ? { ...link, isDeleting: false } : link
      ));
      // Здесь вы можете добавить отображение ошибки пользователю
    }
  };

  const openNotificationInfo = (link: Link) => {
    setSelectedLink(link)
    setIsDialogOpen(true)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Link Management</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Link</TableHead>
            <TableHead>File Count</TableHead>
            <TableHead>Total Size</TableHead>
            <TableHead>Notifications</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell>{link.url}</TableCell>
              <TableCell>{link.fileCount}</TableCell>
              <TableCell>{formatFileSize(link.totalSize)}</TableCell>
              <TableCell>
                {link.telegramInfo ? (
                  <Button variant="ghost" size="icon" onClick={() => openNotificationInfo(link)}>
                    <Bell className="h-4 w-4" />
                  </Button>
                ) : (
                  "Not connected"
                )}
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => window.open(link.url, '_blank')}
                  disabled={link.isDeleting}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteLink(link.id)}
                  disabled={link.isDeleting}
                >
                  {link.isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {selectedLink && selectedLink.telegramInfo && (
              <div>
                <p>Chat ID: {selectedLink.telegramInfo.chatId}</p>
                <p>Notifications:</p>
                <ul>
                  <li>Wrong Password: {selectedLink.telegramInfo.notificationSettings.wrongPassword ? 'Yes' : 'No'}</li>
                  <li>Valid Password: {selectedLink.telegramInfo.notificationSettings.validPassword ? 'Yes' : 'No'}</li>
                  <li>File Downloaded: {selectedLink.telegramInfo.notificationSettings.fileDownloaded ? 'Yes' : 'No'}</li>
                </ul>
              </div>
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  )
}

