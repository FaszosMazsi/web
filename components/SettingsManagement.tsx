'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Settings {
  maxFileSize: number
  maxTotalSize: number
  allowForeverStorage: boolean
}

export default function SettingsManagement() {
  const [settings, setSettings] = useState<Settings>({
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    maxTotalSize: 1024 * 1024 * 1024, // 1GB
    allowForeverStorage: true,
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const response = await fetch('/api/admin/settings')
    if (response.ok) {
      const data = await response.json()
      setSettings(data)
    }
  }

  const updateSettings = async () => {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    })
    if (response.ok) {
      alert('Settings updated successfully')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Settings Management</h2>
      <div className="space-y-2">
        <Label htmlFor="maxFileSize">Maximum File Size (bytes)</Label>
        <Input
          id="maxFileSize"
          type="number"
          value={settings.maxFileSize}
          onChange={(e) => setSettings({ ...settings, maxFileSize: parseInt(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxTotalSize">Maximum Total Size (bytes)</Label>
        <Input
          id="maxTotalSize"
          type="number"
          value={settings.maxTotalSize}
          onChange={(e) => setSettings({ ...settings, maxTotalSize: parseInt(e.target.value) })}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="allowForeverStorage"
          checked={settings.allowForeverStorage}
          onCheckedChange={(checked) => setSettings({ ...settings, allowForeverStorage: checked })}
        />
        <Label htmlFor="allowForeverStorage">Allow Forever Storage</Label>
      </div>
      <Button onClick={updateSettings}>Save Settings</Button>
    </div>
  )
}

