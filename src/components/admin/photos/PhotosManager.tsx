"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, FileImage, ImageOff, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BulkByName } from "@/components/admin/photos/BulkByName"
import { MissingPhotosGrid } from "@/components/admin/photos/MissingPhotosGrid"
import { AiPhotoFinder } from "@/components/admin/photos/AiPhotoFinder"
import { usePhotoTargets } from "@/components/admin/photos/usePhotoTargets"

const TABS = ["nombre", "sin-foto", "ia"] as const

export function PhotosManager({ initialTab, productIds }: { initialTab?: string; productIds: string[] }) {
  const { targets, loading, error, refresh, updateTarget } = usePhotoTargets()
  const [tab, setTab] = useState<string>(TABS.includes(initialTab as (typeof TABS)[number]) ? initialTab! : "nombre")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Fotos masivas</h1>
          <p className="text-muted-foreground">Sube las fotos de muchos productos a la vez</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="nombre">
              <FileImage className="mr-1.5 h-4 w-4" />
              Por nombre de archivo
            </TabsTrigger>
            <TabsTrigger value="sin-foto">
              <ImageOff className="mr-1.5 h-4 w-4" />
              Productos sin foto
            </TabsTrigger>
            <TabsTrigger value="ia">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Buscar con IA
            </TabsTrigger>
          </TabsList>
          <TabsContent value="nombre">
            <BulkByName targets={targets} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="sin-foto">
            <MissingPhotosGrid targets={targets} updateTarget={updateTarget} />
          </TabsContent>
          <TabsContent value="ia">
            <AiPhotoFinder targets={targets} initialIds={productIds} onSaved={refresh} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
