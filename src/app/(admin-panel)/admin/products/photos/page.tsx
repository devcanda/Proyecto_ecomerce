import { PhotosManager } from "@/components/admin/photos/PhotosManager"

interface PhotosPageProps {
  searchParams: Promise<{ tab?: string; ids?: string }>
}

// Carga masiva de fotos: por nombre de archivo, productos sin foto y busqueda con IA
export default async function ProductPhotosPage({ searchParams }: PhotosPageProps) {
  const { tab, ids } = await searchParams
  return <PhotosManager initialTab={tab} productIds={ids ? ids.split(",").filter(Boolean) : []} />
}
