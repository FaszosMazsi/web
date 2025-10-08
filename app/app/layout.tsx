import './globals.css'
import 'react-datepicker/dist/react-datepicker.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import DynamicBackground from '@/components/DynamicBackground'
import { ThemeToggle } from '@/components/ThemeToggle'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'Anonymous File-Sharing',
  description: 'Secure file sharing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="dark" 
          enableSystem={true}
        >
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <DynamicBackground />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

