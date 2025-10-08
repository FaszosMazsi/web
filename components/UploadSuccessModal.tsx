import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Check, Copy, Share, AlertCircle, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string | null;
  error: string | null;
  onContinue: () => void;
}

export function UploadSuccessModal({ isOpen, onClose, shareLink, error, onContinue }: UploadSuccessModalProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText("https://anon-files.tech" + shareLink!)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Share link',
        text: 'Download my file:',
        url: "https://anon-files.tech" + shareLink!,
      })
    } else {
      handleCopy()
    }
  }

  const handleOpenLink = () => {
    window.open("https://anon-files.tech" + shareLink!, '_blank')
  }

  const handleComplete = () => {
    onContinue()
    window.location.reload()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen}>
          <DialogContent>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="fade-in-scale"
            >
              <DialogHeader>
                <DialogTitle>
                  {error ? 'Error in uploading file' : 'File Uploaded'}
                </DialogTitle>
              </DialogHeader>
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="py-4"
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error!</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid gap-4 py-4"
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="flex-1"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      <Input value={"https://anon-files.tech" + shareLink || ''} readOnly />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button onClick={handleCopy} variant="outline">
                        {isCopied ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}
              <DialogFooter className="sm:justify-between">
                {!error && (
                  <>
                    <div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-block mr-2"
                      >
                        <Button onClick={handleShare}>
                          Share Your Link
                          <Share className="ml-2 h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-block"
                      >
                        <Button onClick={handleOpenLink}>
                          Open Link
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </motion.div>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button onClick={handleComplete}>
                        Complete
                        <Check className="ml-2 h-4 w-4" />
                      </Button>
                    </motion.div>
                  </>
                )}
                {error && (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button onClick={handleComplete}>
                      Try again
                      <AlertCircle className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </DialogFooter>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

