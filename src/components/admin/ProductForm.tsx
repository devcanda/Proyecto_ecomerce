"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowDown, ArrowLeft, Layers, Loader2, Lock, Package } from "lucide-react"
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
import { VariantRow, VariantsEditor } from "@/components/admin/VariantsEditor"
import { SizeGuideField } from "@/components/admin/SizeGuideField"
import type { Gender, VariantType } from "@/types"
import { GENDERS, guessGender, normalizeSizeType } from "@/lib/category-type"
import { cn } from "@/lib/utils"

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
  // Referencia o codigo interno (opcional, unica)
  sku: z.string().trim().max(60, "Máximo 60 caracteres"),
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
  sku?: string
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
  sizeType?: VariantType
  gender?: Gender
  variants?: VariantRow[]
}

interface ProductFormProps {
  // Sin producto: crear uno nuevo. Con producto: editarlo
  product?: EditableProduct
}

interface Category {
  id: string
  name: string
  slug: string
  variantType?: VariantType
}

interface Brand {
  id: string
  name: string
  slug: string
  sizeGuide?: string
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
  const [variants, setVariants] = useState<VariantRow[]>(() => product?.variants ?? [])
  // Aviso del editor de tallas/colores si falta completar algo
  const [variantsProblem, setVariantsProblem] = useState<string | null>(null)
  // Producto simple (un precio y un stock) o variable (colores y/o tallas)
  const [isVariable, setIsVariable] = useState(() => Boolean(product?.variants?.length))
  // Los tipos antiguos "Ropa hombre/mujer" se convierten en "Ropa" + genero
  const initialType = normalizeSizeType(product?.sizeType ?? "NONE", product?.gender)
  const [sizeType, setSizeType] = useState<VariantType>(initialType.sizeType)
  // Para quien es el producto (undefined = no aplica)
  const [gender, setGender] = useState<Gender | undefined>(initialType.gender)
  const [genderTouched, setGenderTouched] = useState(Boolean(product))
  // Si el usuario ya eligio el tipo a mano, la categoria deja de sugerirlo
  const [typeTouched, setTypeTouched] = useState(Boolean(product))
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
          sku: product.sku ?? "",
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
          sku: "",
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
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) return null
    const created: Category = await response.json()
    setCategories((items) =>
      items.some((item) => item.id === created.id)
        ? items
        : [...items, created].sort((a, b) => a.name.localeCompare(b.name))
    )
    suggestFromCategory(created)
    return { value: created.id, label: created.name }
  }

  // La categoria sugiere si el producto es variable y su tipo de talla (ej. Calzado -> tallas de calzado)
  const suggestFromCategory = (category?: Category) => {
    if (!category) return
    // "Calzado mujer" -> Mujer
    const suggestedGender = guessGender(category.name)
    if (!genderTouched && suggestedGender) setGender(suggestedGender)
    if (typeTouched || !category.variantType || category.variantType === "NONE") return
    setIsVariable(true)
    setSizeType(normalizeSizeType(category.variantType).sizeType)
  }

  const handleCategoryChange = (value: string) => {
    setValue("categoryId", value, { shouldValidate: true })
    suggestFromCategory(categories.find((item) => item.id === value))
  }

  const chooseProductKind = (variable: boolean) => {
    setTypeTouched(true)
    setIsVariable(variable)
  }

  const handleSizeGuideChange = (sizeGuide: string | undefined) => {
    setBrands((items) => items.map((item) => (item.id === brandId ? { ...item, sizeGuide } : item)))
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

  const selectedBrand = brands.find((item) => item.id === brandId)
  const hasVariantFields = isVariable
  const variantStock = variants.reduce((total, row) => total + (row.stock || 0), 0)
  const basePrice = watch("price")
  const hasColorPhotos = hasVariantFields && variants.some((row) => row.images?.length)

  // Lleva a la seccion donde se escribe el stock de cada color/talla
  const goToVariants = () => {
    const section = document.getElementById("colores-y-tallas")
    section?.scrollIntoView({ behavior: "smooth", block: "start" })
    // Pone el cursor en la primera casilla de stock de esa seccion
    window.setTimeout(() => {
      section?.querySelector<HTMLInputElement>("input[aria-label^='Stock']")?.focus({ preventScroll: true })
    }, 500)
  }

  const onSubmit = async (data: ProductFormData) => {
    if (hasVariantFields && (variantsProblem || variants.length === 0)) {
      setSaveError(`Revisa la seccion "Colores y tallas": ${variantsProblem ?? "completa los colores o tallas."}`)
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
          // Si la categoria no usa tallas se envia vacio para quitar variantes anteriores
          variants: hasVariantFields ? variants : [],
          sizeType: hasVariantFields ? sizeType : "NONE",
          gender: gender ?? null,
          stock: hasVariantFields ? variantStock : data.stock,
        }),
      })

      if (!response.ok) throw new Error(isEdit ? "Error updating product" : "Error creating product")

      router.push("/admin/products")
      router.refresh()
    } catch (error) {
      console.error(error)
      setSaveError(
        "No se pudo guardar el producto. Revisa que no exista otro producto con el mismo slug o la misma referencia e intenta de nuevo."
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
            <CardTitle>Tipo de producto</CardTitle>
            <CardDescription>¿El producto tiene un solo precio y stock, o se vende en varios colores o tallas?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de producto">
              {(
                [
                  {
                    variable: false,
                    icon: Package,
                    title: "Producto simple",
                    hint: "Un solo precio y un solo stock. Ej. un teclado, unos audífonos",
                  },
                  {
                    variable: true,
                    icon: Layers,
                    title: "Producto variable",
                    hint: "Se vende en varios colores y/o tallas. Ej. tenis, ropa, bolsos de colores",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.title}
                  type="button"
                  role="radio"
                  aria-checked={isVariable === option.variable}
                  onClick={() => chooseProductKind(option.variable)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                    isVariable === option.variable
                      ? "border-brand-blue bg-brand-blue/10"
                      : "border-neutral-300 hover:border-brand-blue/60 dark:border-input"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      isVariable === option.variable ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <option.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {!isVariable && Boolean(product?.variants?.length) && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Este producto tiene colores o tallas. Si lo guardas como simple, se quitarán.
              </p>
            )}
          </CardContent>
        </Card>

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

            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="sku">
                Referencia <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="sku" className={FIELD_CLASS} placeholder="Ej. NIK-SHOX-R4" {...register("sku")} />
              <p className="text-xs text-muted-foreground">
                Código interno del producto. Sirve para actualizarlo desde la carga masiva en Excel.
              </p>
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
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
                  onChange={handleCategoryChange}
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

            {/* Genero */}
            <div className="space-y-2">
              <Label>
                ¿Para quién es? <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Para quién es el producto">
                {[{ value: undefined, label: "No aplica" }, ...GENDERS].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={gender === option.value}
                    onClick={() => {
                      setGenderTouched(true)
                      setGender(option.value)
                    }}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      gender === option.value
                        ? "border-brand-blue bg-brand-blue/10 text-brand-link"
                        : "border-neutral-300 text-muted-foreground hover:border-brand-blue/60 dark:border-input"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Sirve para el filtro de la tienda y para sugerir las tallas de ropa. Unisex aparece al filtrar Hombre o
                Mujer.
              </p>
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
                <Label htmlFor="stock" className="flex items-center gap-1.5">
                  Stock
                  {hasVariantFields && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Automático
                    </span>
                  )}
                </Label>
                {hasVariantFields ? (
                  <>
                    {/* En productos variables el stock se escribe por color/talla: al tocar aqui se lleva a esa seccion */}
                    <button
                      id="stock"
                      type="button"
                      onClick={goToVariants}
                      title="Este campo se calcula solo. Toca para ir a Colores y tallas"
                      className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed border-neutral-300 bg-muted/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-brand-blue/60 dark:border-input"
                    >
                      <span>
                        <b className="text-foreground">{variantStock}</b> {variantStock === 1 ? "unidad" : "unidades"}
                      </span>
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    </button>
                    <div className="flex items-start gap-2 rounded-md bg-brand-blue/10 px-2.5 py-2 text-xs text-brand-link">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        Esta casilla no se llena aquí. En un producto variable el stock se escribe en cada color o
                        talla, y aquí se suma solo.{" "}
                        <button
                          type="button"
                          onClick={goToVariants}
                          className="inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline"
                        >
                          Ir a Colores y tallas <ArrowDown className="h-3 w-3" />
                        </button>
                      </p>
                    </div>
                  </>
                ) : (
                  <Input
                    id="stock"
                    className={FIELD_CLASS}
                    type="number"
                    placeholder="0"
                    {...register("stock", { valueAsNumber: true })}
                  />
                )}
                {errors.stock && (
                  <p className="text-sm text-destructive">{errors.stock.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasVariantFields && (
          <Card id="colores-y-tallas" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Colores y tallas</CardTitle>
              <CardDescription>Variantes del producto con su precio y stock</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <VariantsEditor
                sizeType={sizeType}
                gender={gender}
                onSizeTypeChange={(type) => {
                  setTypeTouched(true)
                  setSizeType(type)
                }}
                value={variants}
                onChange={(rows, problem) => {
                  setVariants(rows)
                  setVariantsProblem(problem)
                }}
                basePrice={basePrice}
                fieldClassName={FIELD_CLASS}
              />
              {sizeType === "NONE" ? null : selectedBrand ? (
                <SizeGuideField
                  key={selectedBrand.id}
                  brandId={selectedBrand.id}
                  brandName={selectedBrand.name}
                  value={selectedBrand.sizeGuide}
                  onChange={handleSizeGuideChange}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Elige la marca para poder subir su guía de tallas.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Imagenes</CardTitle>
            <CardDescription>
              Fotos generales del producto (máximo 5). Opcional si subiste fotos en los colores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              value={images}
              onChange={setImages}
              maxImages={5}
            />
            {images.length === 0 && (
              <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {hasColorPhotos
                  ? "No es obligatorio: la tienda usará las fotos de los colores."
                  : "Puedes guardar sin fotos y subirlas después. Mientras tanto la tienda mostrará una imagen de \"Foto próximamente\"."}
              </p>
            )}
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
