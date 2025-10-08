'use client'

import { useState, useEffect } from 'react'
import LinkManagement from './LinkManagement'
import SettingsManagement from './SettingsManagement'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminPanel() {
  return (
    <Tabs defaultValue="links" className="w-full">
      <TabsList>
        <TabsTrigger value="links">Link Management</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="links">
        <LinkManagement />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsManagement />
      </TabsContent>
    </Tabs>
  )
}

