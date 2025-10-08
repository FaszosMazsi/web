'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Download, Search, Lock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/Pagination'

interface FileInfo {
  name: string
  size: number
  systemName: string
  downloadCount: number
  expirationTime: string
  downloadLimit: number
  isPasswordProtected: boolean
  downloads: number
}

interface DownloadProgress {
  percentage: number
  downloaded: number
  speed: number
  status: 'queued' | 'downloading' | 'completed' | 'error'
}

function truncateFileName(fileName: string, maxLength: number = 30): string {
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
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function FileDownload({ fileTag }: { fileTag: string }) {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({})
  const [overallProgress, setOverallProgress] = useState<number>(0)
  const [password, setPassword] = useState<string>('')
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false)
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState(1)
  const filesPerPage = 5
  const downloadStartTime = useRef<Record<string, number>>({})
  const abortControllers = useRef<Record<string, AbortController>>({})

  const fetchFileInfo = useCallback(async (password?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const url = new URL(`/api/file-info/${fileTag}`, window.location.origin)
      if (password) {
        url.searchParams.append('password', password)
      }
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.status === 403) {
        setIsPasswordProtected(true)
        setIsPasswordVerified(false)
        throw new Error('Password protected')
      }
      if (!response.ok) {
        throw new Error('Unable to fetch metadata')
      }
      const data = await response.json()
      setFiles(data.files)
      setFilteredFiles(data.files)
      setDownloadProgress(prevProgress => {
        const newProgress: Record<string, DownloadProgress> = {}
        data.files.forEach((file: FileInfo) => {
          newProgress[file.name] = prevProgress[file.name] || { percentage: 0, downloaded: 0, speed: 0, status: 'queued' }
        })
        return newProgress
      })
      setIsPasswordVerified(true)
      setIsPasswordProtected(false)
    } catch (err) {
      if (err.message === 'Password protected') {
        setIsPasswordProtected(true)
        setIsPasswordVerified(false)
      } else {
        setError('Unable to fetch metadata')
      }
    } finally {
      setIsLoading(false)
    }
  }, [fileTag])

  useEffect(() => {
    fetchFileInfo()
  }, [fetchFileInfo])

  useEffect(() => {
    const filtered = files.filter(file =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredFiles(filtered)
  }, [searchTerm, files])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetchFileInfo(password)
  }

  const downloadFile = useCallback(async (file: FileInfo) => {
    if (file.downloadLimit !== 0 && file.downloadCount >= file.downloadLimit) {
      setDownloadError(`Download limit reached for file: ${file.name}`);
      return;
    }

    const controller = new AbortController()
    abortControllers.current[file.name] = controller

    try {
      const response = await fetch(`/api/download/${fileTag}/${file.systemName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (response.status === 403) {
        setIsPasswordProtected(true)
        setIsPasswordVerified(false)
        throw new Error('Password protected')
      }

      if (!response.ok) {
        throw new Error(`Error in downloading file: ${file.name}`)
      }

      const reader = response.body?.getReader()
      const contentLength = +(response.headers.get('Content-Length') ?? '0')
      let receivedLength = 0
      const chunks = []

      downloadStartTime.current[file.name] = Date.now()

      while (true) {
        const { done, value } = await reader?.read() ?? { done: true, value: undefined }

        if (done) break

        chunks.push(value)
        receivedLength += value?.length ?? 0
        const timeElapsed = (Date.now() - downloadStartTime.current[file.name]) / 1000 // in seconds
        const speed = receivedLength / timeElapsed / (1024 * 1024) // in MB/s
        setDownloadProgress(prev => {
          const updatedProgress = {
            ...prev,
            [file.name]: {
              percentage: (receivedLength / contentLength) * 100,
              downloaded: receivedLength / (1024 * 1024), // Convert to MB
              speed: speed,
              status: 'downloading'
            }
          }
          const overallProgress = Object.values(updatedProgress).reduce((sum, file) => sum + file.percentage, 0) / Object.keys(updatedProgress).length
          setOverallProgress(overallProgress)
          return updatedProgress
        })
      }

      const blob = new Blob(chunks)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setDownloadProgress(prev => ({
        ...prev,
        [file.name]: { ...prev[file.name], status: 'completed' }
      }))

      await fetchFileInfo(password)
    } catch (err) {
      if (err.name === 'AbortError') {
        setDownloadProgress(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'queued' }
        }))
      } else if (err.message === 'Download limit reached') {
        setDownloadProgress(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'error' }
        }))
        setDownloadError(`Download limit reached for file: ${file.name}`)
      } else if (err.message === 'Password protected') {
        setIsPasswordProtected(true)
        setIsPasswordVerified(false)
      } else {
        console.error(`Error downloading file: ${file.name}`, err)
        setDownloadProgress(prev => ({
          ...prev,
          [file.name]: { ...prev[file.name], status: 'error' }
        }))
        setDownloadError(`Error in downloading file: ${file.name}. Please, try again later.`)
      }
    } finally {
      delete abortControllers.current[file.name]
    }
  }, [fileTag, fetchFileInfo, password])

  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)

    for (const file of currentFiles) {
      if (downloadProgress[file.name].status === 'queued') {
        await downloadFile(file)
      }
    }

    setIsDownloading(false)
  }

  const indexOfLastFile = currentPage * filesPerPage
  const indexOfFirstFile = indexOfLastFile - filesPerPage
  const currentFiles = filteredFiles.slice(indexOfFirstFile, indexOfLastFile)
  const totalPages = Math.ceil(filteredFiles.length / filesPerPage)

  return (
    <div className="fade-in">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Download Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <p className="mb-4">Click the button below to download the files.</p>
          {filteredFiles.length > 1 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2 mb-4" />
            </>
          )}
          {currentFiles.map((file, index) => (
            <div key={index} className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium truncate max-w-[200px] inline-block">
                          {truncateFileName(file.name)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{file.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(file.size)})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Downloads: {file.downloadCount}{file.downloadLimit > 0 ? `/${file.downloadLimit}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={downloadProgress[file.name]?.percentage || 0} 
                    className="flex-grow"
                  />
                </div>
                {downloadProgress[file.name] && downloadProgress[file.name].status === 'downloading' && (
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(downloadProgress[file.name].downloaded * 1024* 1024)} / 
                    {formatFileSize(file.size)} 
                    {' - '}
                    {Math.round(downloadProgress[file.name].percentage)}% 
                    {' - '}
                    {formatSpeed(downloadProgress[file.name].speed * 1024 * 1024)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredFiles.length > filesPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          )}
          {downloadError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error!</AlertTitle>
              <AlertDescription>{downloadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={handleDownload} 
            disabled={isDownloading || filteredFiles.length === 0}
            className="hover-scale"
          >
            {isDownloading ? 'Downloading...' : 'Download Files'}
            <Download className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  )
}

