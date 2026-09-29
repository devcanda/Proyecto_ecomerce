"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ImageUpload } from "@/components/admin/ImageUpload"
import { PriceInput } from "@/components/admin/PriceInput"
import { SearchableSelect, SelectOption } from "@/components/admin/SearchableSelect"
import { slugify } from "@/lib/slug"

// Bordes mas marcados en modo claro para distinguir bien los campos del formulario
const FIELD_CLASS = "border-neutral-300 dark:border-input"
const CHECKBOX_CLASS = "border-neutral-400 dark:border-input"

interface UploadedImage {
  url: string
  publicId: string
}

const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  // Opcional: si se deja vacio se genera a partir del nombre al guardar
  slug: z.string().trim(),
  description: z.string().min(1, "La descripcion es requerida"),
  price: z.number({ error: "El precio es requerido" }).positive("El precio debe ser mayor a 0"),
  // Opcional: si se deja vacio el producto no muestra precio tachado
  comparePrice: z.number().positive("El precio anterior debe ser mayor a 0").optional(),
  stock: z.number().min(0, "El stock debe ser mayor o igual a 0"),
  categoryId: z.string().min(1, "La categoria es requerida"),
  brandId: z.string().min(1, "La marca es requerida"),
  // Opcional: no todos los productos tienen modelo
  modelId: z.string().optional(),
  isNew: z.boolean(),
  isFeatured: z.boolean(),
})

type ProductFormData = z.infer<typeof productSchema>

// Datos de un producto existente para el modo edicion
export interface EditableProduct {
  id: string
  name: string
  slug: string
  description: string
  price: number
  comparePrice?: number
  stock: number
  images: string[]
  isNew: boolean
  isFeatured: boolean
  categoryId: string
  brandId: string
  modelId?: string
}

interface ProductFormProps {
  // Sin producto: crear uno nuevo. Con producto: editarlo
  product?: EditableProduct
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Brand {
  id: string
  name: string
  slug: string
}

interface ProductModel {
  id: string
  name: string
}

// Crea una categoria, marca o modelo desde el buscador y la devuelve como opcion
async function createOption(url: string, body: Record<string, string>): Promise<SelectOption | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) return null
  const item = await response.json()
  return { value: item.id, label: item.name }
}

const toOptions = (items: { id: string; name: string }[]): SelectOption[] =>
  items.map((item) => ({ value: item.id, label: item.name }))

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const isEdit = Boolean(product)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  // Las imagenes ya guardadas no tienen publicId: al quitarlas no se borran del almacenamiento
  // (asi "Cancelar" no deja el producto sin fotos)
  const [images, setImages] = useState<UploadedImage[]>(
    () => product?.images.map((url) => ({ url, publicId: "" })) ?? []
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [models, setModels] = useState<ProductModel[]>([])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          comparePrice: product.comparePrice,
          stock: product.stock,
          categoryId: product.categoryId,
          brandId: product.brandId,
          modelId: product.modelId,
          isNew: product.isNew,
          isFeatured: product.isFeatured,
        }
      : {
          isNew: false,
          isFeatured: false,
          stock: 0,
        },
  })

  const categoryId = watch("categoryId")
  const brandId = watch("brandId")
  const modelId = watch("modelId")

  // Los modelos dependen de la marca elegida
  useEffect(() => {
    if (!brandId) return
    let cancelled = false
    fetch(`/api/models?brandId=${brandId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ProductModel[]) => {
        if (!cancelled) setModels(data)
      })
      .catch(() => {
        if (!cancelled) setModels([])
      })
    return () => {
      cancelled = true
    }
  }, [brandId])

  const handleBrandChange = (value: string) => {
    if (value === brandId) return
    setValue("brandId", value, { shouldValidate: true })
    // Al cambiar de marca el modelo anterior ya no aplica
    setValue("modelId", undefined)
    setModels([])
  }

  const handleCreateCategory = async (name: string) => {
    const option = await createOption("/api/categories", { name })
    if (option) {
      setCategories((items) =>
        items.some((item) => item.id === option.value)
          ? items
          : [...items, { id: option.value, name: option.label, slug: "" }].sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    return option
  }

  const handleCreateBrand = async (name: string) => {
    const option = await createOption("/api/brands", { name })
    if (option) {
      setBrands((items) =>
        items.some((item) => item.id === option.value)
          ? items
          : [...items, { id: option.value, name: option.label, slug: "" }].sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    return option
  }

  const handleCreateModel = async (name: string) => {
    if (!brandId) return null
    const option = await createOption("/api/models", { name, brandId })
    if (option) {
      setModels((items) =>
        items.some((item) => item.id === option.value)
          ? items
          : [...items, { id: option.value, name: option.label }].sort((a, b) => a.name.localeCompare(b.name))
      )
    }
    return option
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/brands"),
        ])

        const categoriesData = await categoriesRes.json()
        const brandsData = await brandsRes.json()

        setCategories(categoriesData || [])
        setBrands(brandsData || [])
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const onSubmit = async (data: ProductFormData) => {
    if (images.length === 0) {
      alert("Debes subir al menos una imagen")
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(isEdit ? `/api/products/${product!.id}` : "/api/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slug: data.slug || slugify(data.name),
          // null para poder quitar el precio anterior o el modelo al editar
          comparePrice: data.comparePrice ?? null,
          modelId: data.modelId ?? null,
          images: images.map((img) => img.url),
        }),
      })

      if (!response.ok) throw new Error(isEdit ? "Error updating product" : "Error creating product")

      router.push("/admin/products")
      router.refresh()
    } catch (error) {
      console.error(error)
      setSaveError(
        "No se pudo guardar el producto. Revisa que no exista otro producto con el mismo slug e intenta de nuevo."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "Editar Producto" : "Nuevo Producto"}</h1>
          <p className="text-muted-foreground">
            {isEdit ? "Actualiza la informacion del producto" : "Agrega un nuevo producto al catalogo"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informacion Basica</CardTitle>
            <CardDescription>
              Datos principales del producto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  className={FIELD_CLASS}
                  placeholder="Nombre del producto"
                  {...register("name", {
                    onChange: (e) => {
                      // Al editar no se cambia el slug solo, para no romper enlaces ya compartidos
                      if (!isEdit) setValue("slug", slugify(e.target.value))
                    },
                  })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  className={FIELD_CLASS}
                  placeholder="Se genera automaticamente si lo dejas vacio"
                  {...register("slug")}
                />
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                className={FIELD_CLASS}
                placeholder="Descripcion detallada del producto"
                rows={4}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <SearchableSelect
                  id="categoryId"
                  options={toOptions(categories)}
                  value={categoryId}
                  onChange={(value) => setValue("categoryId", value, { shouldValidate: true })}
                  placeholder="Seleccionar categoria"
                  searchPlaceholder="Buscar o añadir categoria..."
                  onCreate={handleCreateCategory}
                  invalid={Boolean(errors.categoryId)}
                />
                {errors.categoryId && (
                  <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandId">Marca</Label>
                <SearchableSelect
                  id="brandId"
                  options={toOptions(brands)}
                  value={brandId}
                  onChange={handleBrandChange}
                  placeholder="Seleccionar marca"
                  searchPlaceholder="Buscar o añadir marca..."
                  onCreate={handleCreateBrand}
                  invalid={Boolean(errors.brandId)}
                />
                {errors.brandId && (
                  <p className="text-sm text-destructive">{errors.brandId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelId">
                  Modelo <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <SearchableSelect
                  id="modelId"
                  options={toOptions(models)}
                  value={modelId}
                  onChange={(value) => setValue("modelId", value)}
                  placeholder={brandId ? "Seleccionar modelo" : "Primero elige una marca"}
                  searchPlaceholder="Buscar o añadir modelo..."
                  onCreate={handleCreateModel}
                  disabled={!brandId}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precio e Inventario</CardTitle>
            <CardDescription>
              Configura precio y disponibilidad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (COP)</Label>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <PriceInput
                      id="price"
                      className={FIELD_CLASS}
                      placeholder="Ej: 159.990"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="comparePrice">Precio anterior (opcional)</Label>
                <Controller
                  name="comparePrice"
                  control={control}
                  render={({ field }) => (
                    <PriceInput
                      id="comparePrice"
                      className={FIELD_CLASS}
                      placeholder="Dejalo vacio si no aplica"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.comparePrice && (
                  <p className="text-sm text-destructive">{errors.comparePrice.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  className={FIELD_CLASS}
                  type="number"
                  placeholder="0"
                  {...register("stock", { valueAsNumber: true })}
                />
                {errors.stock && (
                  <p className="text-sm text-destructive">{errors.stock.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imagenes</CardTitle>
            <CardDescription>
              Sube las imagenes del producto (máximo 5)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              value={images}
              onChange={setImages}
              maxImages={5}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opciones</CardTitle>
            <CardDescription>
              Configuraciones adicionales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isNew"
                className={CHECKBOX_CLASS}
                checked={watch("isNew")}
                onCheckedChange={(checked) => setValue("isNew", !!checked)}
              />
              <Label htmlFor="isNew" className="font-normal">
                Marcar como producto nuevo
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isFeatured"
                className={CHECKBOX_CLASS}
                checked={watch("isFeatured")}
                onCheckedChange={(checked) => setValue("isFeatured", !!checked)}
              />
              <Label htmlFor="isFeatured" className="font-normal">
                Mostrar en productos destacados
              </Label>
            </div>
          </CardContent>
        </Card>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/products">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar Cambios"
            ) : (
              "Guardar Producto"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
