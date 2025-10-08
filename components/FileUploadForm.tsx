'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Check, Upload, X, Clock, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { UploadSuccessModal } from '@/components/UploadSuccessModal'
import { nanoid } from 'nanoid'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion } from 'framer-motion'
import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from '@/components/Pagination'

const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes

interface FileWithProgress extends File {
  progress: number;
  id: string;
  speed: number;
  status: 'queued' | 'uploading' | 'completed' | 'error';
}

interface Settings {
  allowForeverStorage: boolean;
}

interface NotificationSettings {
  wrongPassword: boolean;
  validPassword: boolean;
  fileDownloaded: boolean;
}

function truncateFileName(fileName: string | undefined, maxLength: number = 30): string {
  if (!fileName) return 'Unnamed File';
  if (fileName.length <= maxLength) return fileName;
  
  const extension = fileName.split('.').pop() || '';
  const nameWithoutExt = fileName.slice(0, fileName.length - extension.length - 1);
  
  if (nameWithoutExt.length <= maxLength - 5) return fileName;
  
  const truncatedName = nameWithoutExt.slice(0, maxLength - 5);
  return `${truncatedName}...${extension ? `.${extension}` : ''}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const calculateTotalSize = (existingFiles: FileWithProgress[], newFiles: File[] = []): number => {
  const existingSize = existingFiles.reduce((total, file) => total + file.size, 0);
  const newSize = newFiles.reduce((total, file) => total + file.size, 0);
  return existingSize + newSize;
};

export default function FileUploadForm() {
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [overallProgress, setOverallProgress] = useState<number>(0)
  const [expirationTime, setExpirationTime] = useState<string>("7d")
  const [keepForever, setKeepForever] = useState<boolean>(false)
  const [downloadLimit, setDownloadLimit] = useState<number>(0)
  const [settings, setSettings] = useState<Settings>({ allowForeverStorage: true })
  const [password, setPassword] = useState<string>('') 
  const [telegramWebhook, setTelegramWebhook] = useState(false)
  const [telegramRefLink, setTelegramRefLink] = useState('')
  const [telegramStatus, setTelegramStatus] = useState('Inactive')
  const [telegramFileTag, setTelegramFileTag] = useState('') 
  const [generatedTags, setGeneratedTags] = useState<{ fileTag: string; unlinkTag: string; linkTag: string } | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    wrongPassword: true,
    validPassword: true,
    fileDownloaded: true,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const filesPerPage = 5
  const uploadStartTime = useRef<Record<string, number>>({})
  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({})

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings(data)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }
    }
    fetchSettings()
  }, [])

  useEffect(() => {
    if (telegramWebhook) {
      generateTelegramRefLink()
    } else {
      setTelegramRefLink('')
      setTelegramStatus('Inactive')
    }
  }, [telegramWebhook])

  const generateTelegramRefLink = async () => {
    try {
      const fileTag = nanoid(10);
      const linkTag = nanoid(32);
      const unlinkTag = nanoid(16);
      const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'anonfilestech_bot';
    
      // Сначала сохраняем информацию о ссылке
      const response = await fetch('/api/telegram-users/save-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkTag,
          fileTag,
          unlinkTag,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save Telegram link');
      }

      const refLink = `https://t.me/${TELEGRAM_BOT_NAME}?start=${linkTag}`;
      setTelegramRefLink(refLink);
      setTelegramFileTag(fileTag);
      setTelegramStatus('Waiting');
      setGeneratedTags({ fileTag, unlinkTag, linkTag });
    } catch (error) {
      console.error('Error generating Telegram ref link:', error);
      setTelegramWebhook(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (telegramStatus === 'Waiting' && telegramFileTag) { 
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/telegram-users?fileTag=${telegramFileTag}`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'active') {
              setTelegramStatus('Active');
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error checking Telegram status:', error);
        }
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [telegramStatus, telegramFileTag]); 

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalSize = calculateTotalSize(files, acceptedFiles);
    if (totalSize > MAX_TOTAL_SIZE) {
      setError('Total size of all files cannot exceed 1GB');
      return;
    }

    setFiles(prevFiles => {
      const newFiles = acceptedFiles.map(file => {
        const match = file.name.match(/^(.+?)(?:\s$$(\d+)$$)?(\.[^.]+)?$/)
        if (!match) return Object.assign(file, { progress: 0, id: nanoid(), speed: 0, status: 'queued' as const })
        
        const [, baseName, number, ext = ''] = match
        
        const existingFiles = prevFiles.filter(f => f.name.startsWith(baseName) && f.name.endsWith(ext))
        
        let newName = file.name
        if (existingFiles.length > 0) {
          const nextNumber = existingFiles.length + 1
          newName = `${baseName} (${nextNumber})${ext}`
        }
        
        const newFile = new File([file], newName, { type: file.type })
        return Object.assign(newFile, { progress: 0, id: nanoid(), speed: 0, status: 'queued' as const })
      })
      
      return [...prevFiles, ...newFiles]
    })
  }, [files])

  const onDropRejected = useCallback((rejectedFiles) => {
    const error = rejectedFiles[0]?.errors[0]
    if (error?.code === 'file-too-large') {
      setError('File is too large. Maximum size is 1GB.')
    } else {
      setError('Error uploading file. Please try again.')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxSize: MAX_FILE_SIZE,
  })

  const removeFile = useCallback((id: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id))
    if (xhrRefs.current[id]) {
      xhrRefs.current[id].abort()
      delete xhrRefs.current[id]
    }
  }, [])

  const cancelUpload = useCallback((id: string) => {
    if (xhrRefs.current[id]) {
      xhrRefs.current[id].abort();
      delete xhrRefs.current[id];
    }
    setFiles(prevFiles => prevFiles.map(file => 
      file.id === id ? { ...file, status: 'error', progress: 0 } : file
    ));
  }, []);

  const uploadFile = useCallback((file: FileWithProgress, currentUploadId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.timeout = 3600000
      xhrRefs.current[file.id] = xhr
      xhr.open('POST', '/api/upload', true)

      xhr.upload.onloadstart = () => {
        uploadStartTime.current[file.id] = Date.now()
        setFiles(prevFiles => prevFiles.map(f => 
          f.id === file.id ? { ...f, status: 'uploading' } : f
        ))
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          const timeElapsed = (Date.now() - uploadStartTime.current[file.id]) / 1000
          const speed = event.loaded / timeElapsed / (1024 * 1024)
          setFiles(prevFiles => {
            const updatedFiles = prevFiles.map(f =>
              f.id === file.id ? { 
                ...f, 
                progress, 
                speed, 
                status: 'uploading',
                name: file.name 
              } : f
            )
            const overallProgress = updatedFiles.reduce((sum, file) => sum + file.progress, 0) / updatedFiles.length
            setOverallProgress(overallProgress)
            return updatedFiles
          })
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText)
            console.log('Server response:', response)
          
            if (response.uploadId) {
              console.log('Received uploadId:', response.uploadId)
              setFiles(prevFiles => prevFiles.map(f => 
                f.id === file.id ? { 
                  ...f, 
                  status: 'completed',
                  name: file.name 
                } : f
              ))
              resolve(response.uploadId)
            } else {
              console.error('No uploadId in response')
              reject(new Error('No uploadId in response'))
            }
          } catch (error) {
            console.error('Error parsing server response:', error)
            reject(error)
          }
        } else {
          console.error('Server returned status:', xhr.status)
          reject(new Error(`Server returned status: ${xhr.status}`))
        }
      }

      xhr.onerror = () => {
        console.error('XHR error occurred')
        reject(new Error('Network error occurred'))
      }

      xhr.ontimeout = () => {
        console.error('XHR request timed out')
        reject(new Error('Request timed out'))
      }

      xhr.onabort = () => {
        console.log('Upload aborted')
        reject(new Error('Upload aborted'))
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('expirationTime', keepForever ? 'forever' : expirationTime)
      formData.append('downloadLimit', downloadLimit.toString())
      formData.append('uploadId', currentUploadId)
      xhr.send(formData)
    })
  }, [expirationTime, keepForever, downloadLimit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    setIsUploading(true)
    setError(null)
    setUploadError(null)
    
    const currentUploadId = nanoid()
    setUploadId(currentUploadId)

    console.log('Starting file upload process with uploadId:', currentUploadId)

    try {
      for (const file of files) {
        if (file.status === 'queued') {
          console.log(`Uploading file: ${file.name}`)
          await uploadFile(file, currentUploadId)
        }
      }

      const requestBody: any = {
        expirationTime: keepForever ? 'forever' : expirationTime,
        downloadLimit,
        password: password || undefined,
        uploadId: currentUploadId,
        notificationSettings,
      }

      if (telegramWebhook && generatedTags) {
        console.log('Checking Telegram status for fileTag:', generatedTags.fileTag)
        const telegramStatusResponse = await fetch(`/api/telegram-users?fileTag=${generatedTags.fileTag}`)
        if (telegramStatusResponse.ok) {
          const telegramStatusData = await telegramStatusResponse.json()
          if (telegramStatusData && telegramStatusData.status === 'active') {
            requestBody.telegramChatId = telegramStatusData.chatId
            requestBody.telegramFileTag = generatedTags.fileTag
            requestBody.telegramUnlinkTag = generatedTags.unlinkTag
            requestBody.telegramLinkTag = generatedTags.linkTag
          }
        }
      }

      console.log('Sending consolidate request with body:', requestBody)
      const response = await fetch('/api/consolidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Consolidate error:', errorText)
        throw new Error('Failed to consolidate files')
      }

      const data = await response.json()
      console.log('Consolidate response:', data)
      setShareLink(data.shareLink)
      setIsModalOpen(true)
    } catch (err) {
      console.error('Error in handleSubmit:', err)
      setUploadError(err instanceof Error ? err.message : 'Error in uploading files')
      setIsModalOpen(true)
    } finally {
      setIsUploading(false)
      setUploadId(null)
      console.log('Upload process completed')
    }
  }

  const handleContinue = () => {
    setIsModalOpen(false)
    setShareLink(null)
    setFiles([])
    setUploadError(null)
    setOverallProgress(0)
  }

  const indexOfLastFile = currentPage * filesPerPage
  const indexOfFirstFile = indexOfLastFile - filesPerPage
  const currentFiles = files.slice(indexOfFirstFile, indexOfLastFile)
  const totalPages = Math.ceil(files.length / filesPerPage)

  return (
    <motion.div 
      className="fade-in"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <CardTitle>Upload Files</CardTitle>
          </motion.div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <motion.div
                {...getRootProps()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary' : 'border-border'
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-2"
                >
                  Drag and drop files here or click to select
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-sm text-muted-foreground mt-1"
                >
                  Maximum allowed size: 1GB per file, 1GB total
                </motion.p>
              </motion.div>
              {files.length > 0 && (
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  {files.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm text-muted-foreground">{Math.round(overallProgress)}%</span>
                      </div>
                      <Progress value={overallProgress} className="h-2 mb-4" />
                    </motion.div>
                  )}
                  {currentFiles.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      className="flex items-center justify-between bg-muted/50 p-3 rounded-lg"
                    >
                      <div className="flex-1 mr-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm font-medium truncate max-w-[200px] inline-block">
                                    {truncateFileName(file?.name || 'Unnamed File')}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="flex flex-col">
                                  <p className="font-medium">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground ml-2">
                            {file.status === 'uploading' && (
                              <>{Math.round(file.progress)}% - {file.speed.toFixed(2)} MB/s</>
                            )}
                          </span>
                        </div>
                        <Progress 
                          value={file.progress} 
                          className="h-2"
                          variant={file.status === 'error' ? 'destructive' : 'default'}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => file.status === 'uploading' ? cancelUpload(file.id) : removeFile(file.id)}
                        disabled={file.status === 'completed'}
                        className="shrink-0"
                      >
                        {file.status === 'completed' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : file.status === 'uploading' ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  ))}
                  {files.length > filesPerPage && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => {
                        setCurrentPage(page);
                      }}
                    />
                  )}
                </motion.div>
              )}
              <motion.div 
                className="space-y-4 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <div className="flex items-center space-x-2">
                  <Switch
                    id="keepForever"
                    checked={keepForever}
                    onCheckedChange={setKeepForever}
                    disabled={!settings.allowForeverStorage || isUploading}
                  />
                  <Label 
                    htmlFor="keepForever" 
                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${!settings.allowForeverStorage ? 'text-muted-foreground' : ''}`}
                  >
                    Keep Forever
                  </Label>
                </div>
                {!keepForever && (
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="expiration">File Expiration</Label>
                    <Select
                      onValueChange={setExpirationTime}
                      value={expirationTime}
                      disabled={isUploading}
                    >
                      <SelectTrigger id="expiration">
                        <SelectValue placeholder="Select expiration time" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="1d">1 day</SelectItem>
                        <SelectItem value="7d">1 week</SelectItem>
                        <SelectItem value="30d">1 month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="downloadLimit">Download Limit (0 for unlimited)</Label>
                  <Input
                    id="downloadLimit"
                    type="number"
                    value={downloadLimit}
                    onChange={(e) => setDownloadLimit(parseInt(e.target.value) || 0)}
                    min="0"
                    disabled={isUploading}
                  />
                </div>
                <div className="flex flex-col space-y-1.5"> 
                  <Label htmlFor="password">Password (optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to protect the file"
                    disabled={isUploading}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="telegramWebhook"
                    checked={telegramWebhook}
                    onCheckedChange={setTelegramWebhook}
                    disabled={isUploading}
                  />
                  <Label htmlFor="telegramWebhook">Telegram Notifications</Label>
                </div>
                {telegramWebhook && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Status:</span>
                      {telegramStatus === 'Waiting' ? (
                        <span className="flex items-center space-x-1 text-yellow-500">
                          <Clock className="h-4 w-4" />
                          <span className="animate-pulse">Waiting</span>
                        </span>
                      ) : telegramStatus === 'Active' ? (
                        <span className="flex items-center space-x-1 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{telegramStatus}</span>
                      )}
                    </div>
                    {telegramRefLink && (
                      <>
                        <p className="text-sm mb-2">Please click the link below to receive notifications:</p>
                        <a href={telegramRefLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {telegramRefLink}
                        </a>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Notification Settings</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="wrongPassword"
                          checked={notificationSettings.wrongPassword}
                          onCheckedChange={(checked) => 
                            setNotificationSettings(prev => ({ ...prev, wrongPassword: checked as boolean }))
                          }
                          disabled={isUploading}
                        />
                        <Label htmlFor="wrongPassword">Wrong Password Input</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="validPassword"
                          checked={notificationSettings.validPassword}
                          onCheckedChange={(checked) => 
                            setNotificationSettings(prev => ({ ...prev, validPassword: checked as boolean }))
                          }
                          disabled={isUploading}
                        />
                        <Label htmlFor="validPassword">Valid Password Input</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="fileDownloaded"
                          checked={notificationSettings.fileDownloaded}
                          onCheckedChange={(checked) => 
                            setNotificationSettings(prev => ({ ...prev, fileDownloaded: checked as boolean }))
                          }
                          disabled={isUploading}
                        />
                        <Label htmlFor="fileDownloaded">File Downloaded</Label>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
            <CardFooter className="flex justify-center mt-4 p-0">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  type="submit" 
                  disabled={isUploading || files.length === 0}
                  className="relative overflow-hidden"
                  onClick={handleSubmit}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                  <motion.div
                    className="ml-2 inline-flex"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: isUploading ? 360 : 0 }}
                    transition={{ duration: 1, repeat: isUploading ? Infinity : 0, ease: "linear" }}
                  >
                    <Upload className="h-4 w-4" />
                  </motion.div>
                </Button>
              </motion.div>
            </CardFooter>
          </form>
        </CardContent>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error!</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
        <UploadSuccessModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shareLink={shareLink}
          error={uploadError}
          onContinue={handleContinue}
        />
      </Card>
    </motion.div>
  )
}

