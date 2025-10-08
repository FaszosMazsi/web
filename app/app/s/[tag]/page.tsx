import { FileDownload } from '@/components/FileDownload'

export default function FilePage({ params }: { params: { tag: string } }) {
  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <main className="flex-grow flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-8 text-primary">Anonymous File-Sharing</h1>
        <FileDownload fileTag={params.tag} />
      </main>
    </div>
  )
}

