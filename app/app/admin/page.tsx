'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/check-auth')
        if (!response.ok) {
          router.push('/admin/login')
        }
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Админ-панель</h1>
      <AdminPanel />
    </div>
  )
}

