import FileUploadForm from '@/components/FileUploadForm'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen text-foreground">
      <main className="flex-grow flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-8 text-primary">Anonymous File-Sharing</h1>
        <FileUploadForm />
      </main>
    </div>
  )
}

