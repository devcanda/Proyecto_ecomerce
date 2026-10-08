import ExcelJS from "exceljs"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/slug"
import { CLOTHING_SIZES, compareSizes, guessVariantType } from "@/lib/category-type"
import { syncVariants, type VariantInput } from "@/lib/variants"
import type { Gender, VariantType } from "@/types"
import type { Availability } from "@/lib/availability"

// ---------------------------------------------------------------------------
// Columnas de la plantilla
// ---------------------------------------------------------------------------

export type ColumnKey =
  | "sku"
  | "name"
  | "description"
  | "category"
  | "brand"
  | "model"
  | "gender"
  | "sizeType"
  | "price"
  | "comparePrice"
  | "color"
  | "size"
  | "stock"
  | "variantPrice"
  | "featured"
  | "isNew"
  | "supplier"
  | "photos"

interface ColumnDef {
  key: ColumnKey
  header: string
  required: string
  help: string
  example: string
  width: number
}

export const COLUMNS: ColumnDef[] = [
  { key: "sku", header: "Referencia", required: "Sí", width: 16, example: "NIK-SHOX-R4", help: "Código único del producto. Las filas con la misma referencia son el mismo producto (una fila por cada color, con sus tallas juntas en la celda Talla). Si ya existe, el producto se actualiza." },
  { key: "name", header: "Nombre", required: "Sí (productos nuevos)", width: 32, example: "Nike Shox R4", help: "Nombre del producto. En un producto variable basta con escribirlo en la primera fila." },
  { key: "description", header: "Descripción", required: "No", width: 40, example: "Tenis con amortiguación de resortes", help: "Texto que ve el cliente." },
  { key: "category", header: "Categoría", required: "Sí (productos nuevos)", width: 18, example: "Calzado", help: "Si no existe, se crea." },
  { key: "brand", header: "Marca", required: "Sí (productos nuevos)", width: 16, example: "Nike", help: "Si no existe, se crea." },
  { key: "model", header: "Modelo", required: "No", width: 16, example: "Shox R4", help: "Modelo dentro de la marca. Si no existe, se crea." },
  { key: "gender", header: "Género", required: "No", width: 12, example: "Hombre", help: "Hombre, Mujer, Unisex o vacío (no aplica)." },
  { key: "sizeType", header: "Tipo de talla", required: "Solo si tiene tallas", width: 14, example: "Calzado", help: "Sin talla, Calzado o Ropa. Si lo dejas vacío y hay tallas, se deduce." },
  { key: "price", header: "Precio", required: "Sí (productos nuevos)", width: 13, example: "450000", help: "Precio en COP, sin símbolos. Ej. 450000 o 450.000" },
  { key: "comparePrice", header: "Precio anterior", required: "No", width: 15, example: "520000", help: "Precio tachado (oferta). Vacío si no aplica." },
  { key: "color", header: "Color", required: "Solo productos variables", width: 16, example: "Rosado/Blanco", help: "Color de esta fila (puede ser combinado, ej. Rosado/Blanco). Vacío si el producto no maneja colores." },
  { key: "size", header: "Talla", required: "Solo productos variables", width: 12, example: "36-43", help: "Una talla (40), un rango (36-43 = de la 36 a la 43) o una lista (37,39,41 = solo esas). Medias tallas con punto: 37.5. Ropa: S-XL o S,M,L. Vacío si no maneja tallas." },
  { key: "stock", header: "Stock", required: "No (vacío = Proveedor)", width: 12, example: "2", help: "Vacío = Proveedor / dropshipping (sin stock propio; la tienda muestra \"Disponible\"). \"Bajo pedido\" = producto comprado que aún no llega (la tienda muestra \"Disponible bajo pedido\"). Un número = unidades de CADA talla de la fila. Lista = unidades por talla en el mismo orden (Talla 37,39,41 y Stock 2,0,5)." },
  { key: "variantPrice", header: "Precio variante", required: "No", width: 15, example: "470000", help: "Precio solo para este color/talla. Vacío = usa el Precio del producto." },
  { key: "featured", header: "Destacado", required: "No", width: 11, example: "No", help: "Sí o No. Muestra el producto en destacados." },
  { key: "isNew", header: "Nuevo", required: "No", width: 9, example: "Sí", help: "Sí o No. Muestra la etiqueta \"Nuevo\"." },
  { key: "supplier", header: "Proveedor", required: "No", width: 20, example: "Distribuidora El Paso", help: "Nombre del proveedor del producto. Solo lo ve el panel (no los clientes)." },
  { key: "photos", header: "Fotos", required: "No", width: 40, example: "https://proveedor.com/foto1.jpg, https://proveedor.com/foto2.jpg", help: "Enlaces (https://...) de las fotos de este producto, o de este color si la fila tiene Color, separados por coma. La primera es la portada. Se descargan y se guardan en tu servidor, reemplazando las fotos actuales de ese producto o color." },
]

const SIZE_TYPE_OPTIONS = ["Sin talla", "Calzado", "Ropa"]
const GENDER_OPTIONS = ["Hombre", "Mujer", "Unisex"]
const YES_NO = ["Sí", "No"]

export const MAX_IMPORT_ROWS = 3000

type TemplateRow = Partial<Record<ColumnKey, string | number>>

// Filas de ejemplo (hoja "Ejemplo" y guia para IA)
const EXAMPLE_ROWS: TemplateRow[] = [
  { sku: "CAT-001", name: "NIKE P-6000 (ROSADO/BLANCO)", description: "El estilo retro-running está de vuelta, con malla transpirable.", category: "Zapatillas", brand: "Nike", model: "P-6000", gender: "Unisex", sizeType: "Calzado", price: 340000, comparePrice: 425000, color: "Rosado/Blanco", size: "36-43", featured: "Sí", isNew: "Sí", supplier: "Distribuidora El Paso" },
  { sku: "CAT-002", name: "ADIDAS SUPERSTAR (BLANCO/AZUL)", description: "Un clásico con la icónica punta de concha.", category: "Zapatillas", brand: "Adidas", model: "SUPERSTAR", gender: "Unisex", sizeType: "Calzado", price: 310000, comparePrice: 387500, color: "Blanco/Azul", size: "37,39,41", stock: "2,1,3", featured: "Sí", isNew: "No" },
  { sku: "NIK-AF1", name: "NIKE AIR FORCE 1", description: "El clásico de siempre.", category: "Zapatillas", brand: "Nike", model: "AIR FORCE 1", gender: "Hombre", sizeType: "Calzado", price: 360000, color: "Blanco", size: "38-42", stock: "2", featured: "No", isNew: "No" },
  { sku: "NIK-AF1", color: "Negro", size: "40,41", stock: "1,4", variantPrice: 380000 },
  { sku: "COR-K100", name: "Teclado Corsair K100", description: "Teclado mecánico RGB.", category: "Teclados", brand: "Corsair", price: 459900, stock: "12", featured: "No", isNew: "No" },
  { sku: "TER-ACERO", name: "Termo de acero 1L", description: "Mantiene la temperatura 12 horas.", category: "Hogar", brand: "Genérica", sizeType: "Sin talla", price: 45000, stock: "Bajo pedido" },
]

const PHOTOS_EXAMPLE_NOTE =
  "Fotos (opcional): pega los enlaces de las fotos del proveedor separados por coma, por ejemplo: https://proveedor.com/cat-001-1.jpg, https://proveedor.com/cat-001-2.jpg. La primera es la portada. En una fila con Color, las fotos van a ese color."

const EXAMPLE_NOTES = [
  "CAT-001: producto de proveedor. Talla 36-43 crea las tallas 36, 37, 38, 39, 40, 41, 42 y 43. Stock vacío = Proveedor / dropshipping (la tienda muestra \"Disponible\").",
  "CAT-002: con inventario. Solo tallas 37, 39 y 41, con 2, 1 y 3 unidades respectivamente.",
  "NIK-AF1: un producto con dos colores (misma Referencia). Blanco: 2 unidades en cada talla de la 38 a la 42. Negro: tallas 40 y 41, con otro precio.",
  "COR-K100: producto simple (sin tallas ni colores) con 12 unidades. TER-ACERO: producto comprado que aún no llega (Bajo pedido: la tienda muestra \"Disponible bajo pedido\").",
]

// Texto que se le pega a una IA para que llene la plantilla
function aiGuideLines(categories: string[], brands: string[]): { text: string; title?: 1 | 2 }[] {
  const column = (key: ColumnKey) => COLUMNS.find((item) => item.key === key)!.header
  const tsv = (row: TemplateRow) => COLUMNS.map((item) => String(row[item.key] ?? "")).join("\t")
  return [
    { text: "Guía para llenar la plantilla con inteligencia artificial", title: 1 },
    { text: "Cómo usarla: copia todo el texto de esta hoja (desde \"INSTRUCCIONES PARA LA IA\" hasta el final) y pégalo en la IA (ChatGPT, Claude, Gemini...) junto con la lista, fotos o catálogo del proveedor. Luego copia la tabla que te entregue y pégala en la hoja \"Productos\" desde la celda A2. Revisa siempre el resultado en la vista previa de la importación antes de importar." },
    { text: "" },
    { text: "INSTRUCCIONES PARA LA IA", title: 1 },
    { text: "Eres un asistente que convierte listas de productos en filas para importar a la tienda en línea \"Compra En Linea\" (Colombia, precios en pesos colombianos COP)." },
    { text: `Entrega una tabla con exactamente estas ${COLUMNS.length} columnas, en este orden y con estos encabezados: ${COLUMNS.map((item) => item.header).join(" | ")}.` },
    { text: "Entrega la tabla con las columnas separadas por tabuladores (para pegarla directo en Excel), sin texto adicional y sin repetir los encabezados. No agregues ni quites columnas: si un dato no se conoce, deja la celda vacía. Nunca inventes precios, stock, modelos ni tallas." },
    { text: "" },
    { text: "Reglas por columna", title: 2 },
    { text: `- ${column("sku")} (obligatorio): código único del producto, sin espacios. Todas las filas de un mismo producto llevan la misma Referencia. Productos distintos llevan Referencias distintas.` },
    { text: `- ${column("name")} (obligatorio): nombre comercial del producto. En las filas extra de un mismo producto (otros colores) puede ir vacío.` },
    { text: `- ${column("description")}: texto de venta en español, de 1 a 3 frases. Vacío si no hay información.` },
    { text: `- ${column("category")} (obligatorio): usa una de las categorías existentes si corresponde: ${categories.length ? categories.join(", ") : "(aún no hay categorías)"}. Si ninguna corresponde, escribe una nueva.` },
    { text: `- ${column("brand")} (obligatorio): usa una de las marcas existentes si corresponde: ${brands.length ? brands.join(", ") : "(aún no hay marcas)"}. Si no está, escribe la marca nueva.` },
    { text: `- ${column("model")}: modelo dentro de la marca (ej. AIR FORCE 1, P-6000). Vacío si no aplica.` },
    { text: `- ${column("gender")}: exactamente uno de: Hombre, Mujer, Unisex. Vacío si no aplica (ej. tecnología).` },
    { text: `- ${column("sizeType")}: exactamente uno de: Calzado, Ropa, Sin talla. Calzado para zapatos y tenis, Ropa para prendas, Sin talla para lo demás.` },
    { text: `- ${column("price")} (obligatorio): número entero en pesos, sin símbolo $ ni puntos de miles. Ej. 340000.` },
    { text: `- ${column("comparePrice")}: precio anterior (tachado) con el mismo formato que Precio y mayor que él. Vacío si no hay oferta.` },
    { text: `- ${column("color")}: color de la fila; si es combinado usa barra: Rosado/Blanco. Vacío si el producto no maneja colores.` },
    { text: `- ${column("size")}: tallas de la fila. Rango con guion = todas las tallas entre ambas (36-43). Lista con comas = solo esas tallas (37,39,41). Medias tallas con punto (37.5). Ropa: S-XL o S,M,L. Vacío si no maneja tallas.` },
    { text: `- ${column("stock")}: vacío = Proveedor / dropshipping (no se sabe cuántas unidades hay; úsalo para catálogos de proveedor). Escribe "Bajo pedido" solo si el usuario dice que el producto ya fue comprado y viene en camino. Un número = unidades de CADA talla de la fila. Lista con comas = unidades por talla en el mismo orden de la columna Talla (Talla 37,39,41 y Stock 2,1,3). Dentro de un mismo producto no mezcles estas opciones.` },
    { text: `- ${column("variantPrice")}: solo si un color o talla cuesta distinto al Precio. Vacío en los demás casos.` },
    { text: `- ${column("featured")}: Sí o No (mostrar en destacados). ${column("isNew")}: Sí o No (etiqueta \"Nuevo\").` },
    { text: `- ${column("supplier")}: nombre del proveedor si el usuario lo indica. Vacío si no se sabe.` },
    { text: `- ${column("photos")}: solo enlaces directos a fotos que el usuario te haya dado (catálogo o página del proveedor), separados por coma. Si no te dieron enlaces, deja la celda vacía: nunca inventes ni adivines enlaces.` },
    { text: "" },
    { text: "Reglas generales", title: 2 },
    { text: "- Una fila por producto y color. Las tallas de ese color van juntas en la celda Talla (no hagas una fila por talla)." },
    { text: "- Si el mismo modelo viene en varios colores, puedes usar la misma Referencia (un solo producto con varios colores) o una Referencia por color (productos separados). Respeta lo que pida el usuario; si no dice nada, usa una Referencia por color." },
    { text: "- No uses fórmulas, celdas combinadas, emojis ni comillas alrededor de los valores." },
    { text: "" },
    { text: "Ejemplo de salida (columnas separadas por tabuladores)", title: 2 },
    { text: COLUMNS.map((item) => item.header).join("\t") },
    ...EXAMPLE_ROWS.map((row) => ({ text: tsv(row) })),
    { text: "" },
    { text: "Explicación del ejemplo", title: 2 },
    ...EXAMPLE_NOTES.map((text) => ({ text: `- ${text}` })),
  ]
}

// ---------------------------------------------------------------------------
// Plantilla de Excel
// ---------------------------------------------------------------------------

export async function buildTemplate(): Promise<Buffer> {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Compra En Linea"

  const headerStyle = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } }
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF04ADBF" } }
    row.alignment = { vertical: "middle" }
    row.height = 22
  }

  // Hoja donde se llenan los productos
  const sheet = workbook.addWorksheet("Productos", { views: [{ state: "frozen", ySplit: 1 }] })
  sheet.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }))
  headerStyle(sheet.getRow(1))
  COLUMNS.forEach((column, index) => {
    sheet.getCell(1, index + 1).note = `${column.help}\nObligatorio: ${column.required}`
  })
  sheet.getColumn("size").numFmt = "@"
  sheet.getColumn("stock").numFmt = "@"

  // Hoja de listas (opciones de las celdas desplegables)
  const lists = workbook.addWorksheet("Listas")
  lists.columns = [
    { header: "Categorías existentes", key: "category", width: 26 },
    { header: "Marcas existentes", key: "brand", width: 22 },
    { header: "Género", key: "gender", width: 12 },
    { header: "Tipo de talla", key: "sizeType", width: 14 },
    { header: "Sí / No", key: "yesNo", width: 9 },
  ]
  headerStyle(lists.getRow(1))
  const longest = Math.max(categories.length, brands.length, 3)
  for (let i = 0; i < longest; i++) {
    lists.addRow({
      category: categories[i]?.name,
      brand: brands[i]?.name,
      gender: GENDER_OPTIONS[i],
      sizeType: SIZE_TYPE_OPTIONS[i],
      yesNo: YES_NO[i],
    })
  }

  const columnLetter = (key: ColumnKey) => sheet.getColumn(key).letter
  const lastRow = MAX_IMPORT_ROWS + 1
  const listValidation = (key: ColumnKey, formula: string, strict: boolean) => {
    const letter = columnLetter(key)
    for (let row = 2; row <= lastRow; row++) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        // Categoria y marca permiten escribir una nueva; el resto solo acepta la lista
        showErrorMessage: strict,
        errorStyle: "stop",
        errorTitle: "Valor no válido",
        error: "Elige una opción de la lista.",
      }
    }
  }
  if (categories.length) listValidation("category", `Listas!$A$2:$A$${categories.length + 1}`, false)
  if (brands.length) listValidation("brand", `Listas!$B$2:$B$${brands.length + 1}`, false)
  listValidation("gender", `Listas!$C$2:$C$4`, true)
  listValidation("sizeType", `Listas!$D$2:$D$4`, true)
  listValidation("featured", `Listas!$E$2:$E$3`, true)
  listValidation("isNew", `Listas!$E$2:$E$3`, true)

  // Hoja de ejemplo (no se importa)
  const example = workbook.addWorksheet("Ejemplo")
  example.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }))
  headerStyle(example.getRow(1))
  EXAMPLE_ROWS.forEach((row) => example.addRow(row))
  example.addRow({})
  // La nota de Fotos solo va en esta hoja (en la Guia IA un enlace de ejemplo podria copiarse como real)
  ;[...EXAMPLE_NOTES, PHOTOS_EXAMPLE_NOTE].forEach((text) => {
    const row = example.addRow({ sku: text })
    example.mergeCells(row.number, 1, row.number, COLUMNS.length)
    row.font = { italic: true }
  })

  // Instrucciones
  const help = workbook.addWorksheet("Instrucciones")
  help.columns = [
    { header: "Columna", key: "header", width: 18 },
    { header: "Obligatorio", key: "required", width: 22 },
    { header: "Qué escribir", key: "help", width: 80 },
    { header: "Ejemplo", key: "example", width: 18 },
  ]
  headerStyle(help.getRow(1))
  COLUMNS.forEach((column) => help.addRow(column))
  help.addRow({})
  ;[
    "Cómo llenar la hoja \"Productos\":",
    "• Producto simple (un precio y un stock): una sola fila.",
    "• Producto con tallas: en Talla escribe un rango (36-43 = todas de la 36 a la 43) o una lista (37,39,41 = solo esas).",
    "• Stock vacío = Proveedor / dropshipping: se vende en todas sus tallas sin stock propio y la tienda muestra \"Disponible\".",
    "• Stock \"Bajo pedido\" = producto que ya compraste y viene en camino (ej. de China o EE. UU.): la tienda muestra \"Disponible bajo pedido\".",
    "• Stock con un número = unidades de CADA talla de la fila. Con una lista (2,0,5) = unidades por talla, en el mismo orden.",
    "• Varios colores de un mismo producto: una fila por color, todas con la misma Referencia (basta Referencia, Color, Talla y Stock).",
    "• Fotos: pega en la columna Fotos los enlaces de las fotos del proveedor (separados por coma). Se descargan a tu servidor al importar.",
    "• ¿Tienes las fotos en tu computador? Nómbralas con la Referencia (CAT-001.jpg, CAT-001-2.jpg; por color: NIK-AF1_Negro.jpg) y súbelas todas juntas en Productos > Fotos masivas.",
    "• ¿Vas a llenar el archivo con ayuda de una IA? Usa la hoja \"Guía IA\".",
    "• Sin fotos, la tienda muestra \"Foto próximamente\". Puedes agregarlas después en Productos > Fotos masivas (por nombre de archivo o con IA).",
    "• Si subes de nuevo una Referencia que ya existe, se actualiza ese producto. Las celdas vacías no borran datos.",
    "• Mira la hoja \"Ejemplo\" para ver un archivo lleno. Esa hoja no se importa.",
  ].forEach((text) => {
    const row = help.addRow({ header: text })
    help.mergeCells(`A${row.number}:D${row.number}`)
  })
  help.getColumn("help").alignment = { wrapText: true, vertical: "top" }

  // Guia para llenar la plantilla con una IA (ChatGPT, Claude, Gemini...)
  const ai = workbook.addWorksheet("Guía IA")
  ai.getColumn(1).width = 130
  ai.getColumn(1).alignment = { wrapText: true, vertical: "top" }
  aiGuideLines(
    categories.map((item) => item.name),
    brands.map((item) => item.name)
  ).forEach((line) => {
    const row = ai.addRow([line.text])
    if (line.title) {
      row.font = { bold: true, size: line.title === 1 ? 14 : 11, color: { argb: line.title === 1 ? "FF04ADBF" : "FF000000" } }
    }
  })

  // La hoja Productos queda como la primera que se abre
  workbook.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }]

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

// ---------------------------------------------------------------------------
// Lectura del archivo
// ---------------------------------------------------------------------------

interface RawRow {
  row: number
  values: Partial<Record<ColumnKey, string>>
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

// Encabezados aceptados (tambien sin tildes o en minusculas)
const HEADER_ALIASES: Record<string, ColumnKey> = Object.fromEntries(
  COLUMNS.flatMap((column) => [
    [normalize(column.header), column.key],
    ...(column.key === "sku" ? [["sku", column.key], ["codigo", column.key], ["ref", column.key]] : []),
  ])
)

const cellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return String(value)
  if (value instanceof Date) return value.toISOString()
  return (cell.text ?? "").trim()
}

// Quita las notas/comentarios de celda del archivo antes de leerlo. Algunos programas (Python, IA, Google Sheets)
// los guardan de una forma que ExcelJS no entiende, y para importar no se necesitan.
async function withoutCellComments(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const isCommentPart = (path: string) =>
    /^xl\/(comments[^/]*\.xml|comments\/.*|threadedComments\/.*|persons\/.*|drawings\/[^/]*\.vml)$/i.test(path)
  const removed = Object.keys(zip.files).filter(isCommentPart)
  if (!removed.length) return buffer
  removed.forEach((path) => zip.remove(path))

  const COMMENT_RELS = /<Relationship\b[^>]*Type="[^"]*\/(comments|vmlDrawing|threadedComment|person)"[^>]*\/>/gi
  for (const path of Object.keys(zip.files)) {
    const file = zip.file(path)
    if (!file) continue
    if (/^xl\/worksheets\/_rels\/.*\.rels$/i.test(path) || path === "xl/_rels/workbook.xml.rels") {
      zip.file(path, (await file.async("string")).replace(COMMENT_RELS, ""))
    } else if (/^xl\/worksheets\/[^/]+\.xml$/i.test(path)) {
      zip.file(path, (await file.async("string")).replace(/<legacyDrawing\b[^>]*\/>/gi, ""))
    }
  }
  const types = zip.file("[Content_Types].xml")
  if (types) {
    const xml = (await types.async("string")).replace(/<Override\b[^>]*PartName="\/?([^"]+)"[^>]*\/>/gi, (tag, part: string) =>
      isCommentPart(part) ? "" : tag
    )
    zip.file("[Content_Types].xml", xml)
  }
  return zip.generateAsync({ type: "nodebuffer" })
}

async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await withoutCellComments(buffer)) as unknown as ArrayBuffer)
  const sheet = workbook.getWorksheet("Productos") ?? workbook.worksheets[0]
  if (!sheet) return []
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = []
    for (let col = 1; col <= Math.max(sheet.columnCount, COLUMNS.length); col++) {
      cells.push(cellText(row.getCell(col)))
    }
    rows[rowNumber - 1] = cells
  })
  return Array.from(rows, (row) => row ?? [])
}

// CSV con coma o punto y coma (Excel en español suele usar ";")
function readCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "")
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ""
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(field.trim())
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  if (field || row.length) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}

export async function readImportFile(buffer: Buffer, fileName: string): Promise<{ rows: RawRow[]; missingHeaders: string[] }> {
  const grid = fileName.toLowerCase().endsWith(".csv") ? readCsv(buffer.toString("utf8")) : await readXlsx(buffer)
  const headerIndex = grid.findIndex((cells) => cells.some((cell) => HEADER_ALIASES[normalize(cell)] === "sku"))
  if (headerIndex === -1) return { rows: [], missingHeaders: ["Referencia"] }

  const headerMap = new Map<number, ColumnKey>()
  grid[headerIndex].forEach((cell, index) => {
    const key = HEADER_ALIASES[normalize(cell)]
    if (key && ![...headerMap.values()].includes(key)) headerMap.set(index, key)
  })
  const present = new Set(headerMap.values())
  const missingHeaders = COLUMNS.filter((column) => ["sku", "name", "category", "brand", "price"].includes(column.key))
    .filter((column) => !present.has(column.key))
    .map((column) => column.header)

  const rows: RawRow[] = []
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const values: Partial<Record<ColumnKey, string>> = {}
    headerMap.forEach((key, index) => {
      const value = (cells[index] ?? "").trim()
      if (value) values[key] = value
    })
    if (Object.keys(values).length) rows.push({ row: headerIndex + offset + 2, values })
  })
  return { rows, missingHeaders }
}

// ---------------------------------------------------------------------------
// Conversion de valores
// ---------------------------------------------------------------------------

// Acepta 450000, 450.000, 450,000.50, 450.000,50 y $ 450.000
export function parseMoney(raw?: string): number | undefined | null {
  if (!raw) return undefined
  let text = raw.replace(/cop/i, "").replace(/[$\s]/g, "")
  if (!text) return undefined
  const hasDot = text.includes(".")
  const hasComma = text.includes(",")
  if (hasDot && hasComma) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "")
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "")
  } else if (hasComma) {
    text = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".")
  }
  const value = Number(text)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function parseStock(raw?: string): number | undefined | null {
  if (!raw) return undefined
  const value = Number(raw.replace(/[.\s]/g, "").replace(",", "."))
  return Number.isInteger(value) && value >= 0 ? value : null
}

function parseYesNo(raw?: string): boolean | undefined {
  if (!raw) return undefined
  return /^(si|s|x|1|true|verdadero)$/.test(normalize(raw))
}

function parseGenderText(raw?: string): Gender | null | undefined | "invalid" {
  if (!raw) return undefined
  const text = normalize(raw)
  if (/^(no aplica|ninguno|n a)$/.test(text)) return null
  if (/^(hombre|masculino|caballero|h)$/.test(text)) return "MEN"
  if (/^(mujer|femenino|dama|m)$/.test(text)) return "WOMEN"
  if (text === "unisex") return "UNISEX"
  return "invalid"
}

function parseSizeTypeText(raw?: string): VariantType | undefined | "invalid" {
  if (!raw) return undefined
  const text = normalize(raw)
  if (/^(sin talla|ninguna|no aplica|solo color|solo colores)$/.test(text)) return "NONE"
  if (/^(calzado|zapatos|tenis)$/.test(text)) return "FOOTWEAR"
  if (/^(ropa|prenda|prendas)$/.test(text)) return "CLOTHING"
  return "invalid"
}

// Tallas de una celda: "40", rango "36-43" (todas las tallas), lista "37,39,41" (solo esas) o "S-XL" en ropa
const CLOTHING_ALIASES: Record<string, string> = { XXXL: "3XL", XXXXL: "4XL" }
const clothingSize = (text: string) => CLOTHING_ALIASES[text.toUpperCase()] ?? text.toUpperCase()

export function expandSizes(raw?: string): string[] | { error: string } {
  if (!raw) return []
  const text = raw
    .trim()
    .replace(/(\d),5(?!\d)/g, "$1.5") // 37,5 = media talla
    .replace(/\s+y\s+/gi, ",")
    .replace(/\s*(?:-|–|—|\s(?:a|al|hasta)\s)\s*/gi, "-")
  const sizes: string[] = []
  for (const token of text.split(/[,;\s]+/).filter(Boolean)) {
    const numbers = token.match(/^(\d+(?:\.5)?)-(\d+(?:\.5)?)$/)
    if (numbers) {
      const from = Number(numbers[1])
      const to = Number(numbers[2])
      if (from > to) return { error: `El rango de tallas "${token}" está al revés: escríbelo de menor a mayor.` }
      if (to - from > 30) return { error: `El rango de tallas "${token}" es demasiado amplio.` }
      for (let value = from; value <= to; value++) sizes.push(String(value))
      continue
    }
    const letters = token.match(/^([a-z0-9]+)-([a-z0-9]+)$/i)
    if (letters) {
      const from = CLOTHING_SIZES.indexOf(clothingSize(letters[1]))
      const to = CLOTHING_SIZES.indexOf(clothingSize(letters[2]))
      if (from === -1 || to === -1 || from > to) return { error: `No se entiende el rango de tallas "${token}". Ej. 36-43 o S-XL.` }
      sizes.push(...CLOTHING_SIZES.slice(from, to + 1))
      continue
    }
    if (token.includes("-")) return { error: `No se entiende la talla "${token}". Ej. 36-43 o 37,39,41.` }
    sizes.push(CLOTHING_SIZES.includes(clothingSize(token)) ? clothingSize(token) : token)
  }
  return [...new Set(sizes)].sort(compareSizes)
}

// Celda Stock: vacia (proveedor), "proveedor"/"dropshipping", "bajo pedido", un numero o una lista (uno por talla)
type StockCell =
  | { kind: "empty" }
  | { kind: "supplier" }
  | { kind: "preorder" }
  | { kind: "numbers"; values: number[] }
  | { kind: "invalid" }

function parseStockCell(raw?: string): StockCell {
  if (!raw) return { kind: "empty" }
  const text = normalize(raw)
  if (/^(proveedor|dropshipping|drop shipping|catalogo|disponible)$/.test(text)) return { kind: "supplier" }
  if (/^(bajo pedido|sobre pedido|por pedido|pedido|preventa|pre venta|en camino|importacion|por encargo|encargo)$/.test(text)) return { kind: "preorder" }
  const values = raw.split(/[,;\s]+/).filter(Boolean).map((part) => parseStock(part))
  if (!values.length || values.some((value) => value === null || value === undefined)) return { kind: "invalid" }
  return { kind: "numbers", values: values as number[] }
}

const moneyText = (value: number) => new Intl.NumberFormat("es-CO").format(value)

// ---------------------------------------------------------------------------
// Analisis (vista previa): no escribe nada en la base de datos
// ---------------------------------------------------------------------------

export interface ImportMessage {
  type: "error" | "warning" | "info"
  text: string
  row?: number
}

interface PlannedVariant {
  row: number
  color?: string
  size?: string
  stock?: number
  price?: number | null
}

export interface ImportItem {
  sku: string
  name: string
  action: "create" | "update"
  rows: number[]
  status: "ok" | "warning" | "error"
  messages: ImportMessage[]
  variantCount: number
  stock: number
  price?: number
  category?: string
  brand?: string
  isVariable: boolean
  // undefined = no cambia (al actualizar)
  availability?: Availability
  // Enlaces de fotos que se descargaran despues de importar
  photoCount: number
}

interface PlannedProduct extends ImportItem {
  existingId?: string
  description?: string
  model?: string
  gender?: Gender | null
  sizeType?: VariantType
  comparePrice?: number | null
  featured?: boolean
  isNew?: boolean
  // El archivo trae un numero de stock para un producto simple
  stockGiven?: boolean
  supplierName?: string
  photoLinks: PhotoLinks[]
  variants: PlannedVariant[]
}

// Fotos por enlace de un producto o de uno de sus colores
export interface PhotoLinks {
  color?: string
  urls: string[]
}

// Enlaces separados por coma, punto y coma, espacio o salto de linea
function parsePhotoLinks(raw?: string): { urls: string[]; invalid: string[] } {
  const parts = (raw ?? "").split(/[\s,;|]+/).filter(Boolean)
  return {
    urls: parts.filter((part) => /^https?:\/\/\S+$/i.test(part)),
    invalid: parts.filter((part) => !/^https?:\/\/\S+$/i.test(part)),
  }
}

export interface ImportPreview {
  summary: {
    rows: number
    products: number
    create: number
    update: number
    withErrors: number
    newCategories: string[]
    newBrands: string[]
    newModels: string[]
  }
  items: ImportItem[]
  fileErrors: string[]
}

interface Lookups {
  categories: Map<string, { id: string; name: string }>
  brands: Map<string, { id: string; name: string }>
  models: Map<string, { id: string; name: string }>
  products: Map<
    string,
    { id: string; name: string; sizeType: VariantType; variants: { id: string; size: string | null; color: string | null; price: unknown; stock: number; images: string[] }[] }
  >
  slugs: Set<string>
}

const variantKey = (color?: string | null, size?: string | null) =>
  `${normalize(color ?? "")}|${normalize(size ?? "")}`

async function loadLookups(skus: string[]): Promise<Lookups> {
  const [categories, brands, models, products, slugs] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.productModel.findMany({ select: { id: true, name: true, brandId: true } }),
    prisma.product.findMany({
      where: { sku: { in: skus } },
      select: {
        id: true,
        sku: true,
        name: true,
        sizeType: true,
        variants: { orderBy: { position: "asc" }, select: { id: true, size: true, color: true, price: true, stock: true, images: true } },
      },
    }),
    prisma.product.findMany({ select: { slug: true } }),
  ])
  return {
    categories: new Map(categories.map((item) => [normalize(item.name), item])),
    brands: new Map(brands.map((item) => [normalize(item.name), item])),
    models: new Map(models.map((item) => [`${item.brandId}|${normalize(item.name)}`, item])),
    products: new Map(products.map((item) => [normalize(item.sku ?? ""), item])),
    slugs: new Set(slugs.map((item) => item.slug)),
  }
}

// Deduce el tipo de talla si no se escribio: numeros de 30 a 50 = calzado; letras = ropa
function inferSizeType(sizes: string[]): VariantType | undefined {
  if (!sizes.length) return undefined
  const numeric = sizes.every((size) => {
    const value = Number(size.replace(",", "."))
    return Number.isFinite(value) && value >= 30 && value <= 50
  })
  if (numeric) return "FOOTWEAR"
  const letters = sizes.every((size) => /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl)$/i.test(size))
  return letters ? "CLOTHING" : undefined
}

async function planImport(rows: RawRow[]): Promise<{ products: PlannedProduct[]; lookups: Lookups }> {
  // Agrupar filas por referencia
  const groups = new Map<string, RawRow[]>()
  const noSku: RawRow[] = []
  for (const row of rows) {
    const sku = row.values.sku?.trim()
    if (!sku) {
      noSku.push(row)
      continue
    }
    const key = normalize(sku)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const lookups = await loadLookups([...groups.values()].map((group) => group[0].values.sku!.trim()))
  const plannedSlugs = new Set<string>()
  const products: PlannedProduct[] = []

  for (const [key, group] of groups) {
    const messages: ImportMessage[] = []
    const error = (text: string, row?: number) => messages.push({ type: "error", text, row })
    const warning = (text: string, row?: number) => messages.push({ type: "warning", text, row })
    const info = (text: string, row?: number) => messages.push({ type: "info", text, row })

    // Datos del producto: el primer valor escrito en cualquiera de sus filas
    const first = (column: ColumnKey) => group.find((row) => row.values[column])?.values[column]
    const conflict = (column: ColumnKey, label: string) => {
      const values = group.filter((row) => row.values[column])
      const distinct = new Set(values.map((row) => normalize(row.values[column]!)))
      if (distinct.size > 1) error(`${label} distinto entre las filas ${values.map((row) => row.row).join(", ")} de la misma referencia.`)
    }
    ;(["name", "category", "brand", "price"] as const).forEach((column) =>
      conflict(column, { name: "Nombre", category: "Categoría", brand: "Marca", price: "Precio" }[column])
    )

    const sku = group[0].values.sku!.trim()
    const existing = lookups.products.get(key)
    const action = existing ? "update" : "create"
    const name = first("name") ?? existing?.name ?? ""
    const category = first("category")
    const brand = first("brand")
    const model = first("model")

    if (action === "create") {
      if (!name) error("Falta el Nombre.", group[0].row)
      if (!category) error("Falta la Categoría.", group[0].row)
      if (!brand) error("Falta la Marca.", group[0].row)
    }
    if (model && !brand && action === "create") error("El Modelo necesita una Marca.", group[0].row)

    const price = parseMoney(first("price"))
    if (price === null || (price !== undefined && price <= 0)) error("El Precio no es un número válido mayor a 0.", group.find((row) => row.values.price)?.row)
    if (price === undefined && action === "create") error("Falta el Precio.", group[0].row)

    const comparePrice = parseMoney(first("comparePrice"))
    if (comparePrice === null) error("El Precio anterior no es un número válido.")

    const genderValue = parseGenderText(first("gender"))
    if (genderValue === "invalid") error(`Género "${first("gender")}" no válido. Usa Hombre, Mujer o Unisex.`)

    let sizeType = parseSizeTypeText(first("sizeType"))
    if (sizeType === "invalid") {
      error(`Tipo de talla "${first("sizeType")}" no válido. Usa Sin talla, Calzado o Ropa.`)
      sizeType = undefined
    }

    // Stock de cada fila: cantidades, "bajo pedido" o vacio
    const stockCells = group.map((row) => parseStockCell(row.values.stock))
    stockCells.forEach((cell, index) => {
      if (cell.kind === "invalid") {
        error(`Stock "${group[index].values.stock}" no válido. Escribe un número, una lista (2,1,3), "Bajo pedido" o déjalo vacío (proveedor).`, group[index].row)
      }
    })

    // Variantes: filas con color y/o talla (una fila puede traer varias tallas)
    const isVariable = group.some((row) => row.values.color || row.values.size)
    const variants: PlannedVariant[] = []
    if (isVariable) {
      const seen = new Map<string, number>()
      for (const [index, row] of group.entries()) {
        const color = row.values.color?.trim()
        const expanded = expandSizes(row.values.size)
        if (!Array.isArray(expanded)) {
          error(expanded.error, row.row)
          continue
        }
        if (!color && !expanded.length) {
          error("En un producto variable cada fila necesita Color o Talla.", row.row)
          continue
        }
        const sizes: (string | undefined)[] = expanded.length ? expanded : [undefined]
        const cell = stockCells[index]
        let stocks: (number | undefined)[] = sizes.map(() => undefined)
        if (cell.kind === "numbers") {
          if (cell.values.length === 1) {
            stocks = sizes.map(() => cell.values[0])
            if (sizes.length > 1) info(`${cell.values[0]} unidades en cada una de las ${sizes.length} tallas.`, row.row)
          } else if (cell.values.length === sizes.length) {
            stocks = cell.values
          } else {
            error(`Hay ${sizes.length} tallas pero ${cell.values.length} cantidades en Stock. Escribe una cantidad por talla, en el mismo orden.`, row.row)
            continue
          }
        }
        const variantPrice = parseMoney(row.values.variantPrice)
        if (variantPrice === null || (typeof variantPrice === "number" && variantPrice <= 0)) error("Precio variante no válido.", row.row)
        sizes.forEach((size, i) => {
          const vKey = variantKey(color, size)
          if (seen.has(vKey)) {
            error(`${[color, size && `talla ${size}`].filter(Boolean).join(" ")} repetido (también en la fila ${seen.get(vKey)}).`, row.row)
            return
          }
          seen.set(vKey, row.row)
          variants.push({ row: row.row, color, size, stock: stocks[i], price: variantPrice ?? undefined })
        })
      }

      const sizes = variants.flatMap((variant) => (variant.size ? [variant.size] : []))
      if (sizeType === "NONE" && sizes.length) error("El Tipo de talla es \"Sin talla\" pero hay tallas escritas.")
      if ((sizeType === "FOOTWEAR" || sizeType === "CLOTHING") && sizes.length === 0) error("El Tipo de talla pide tallas, pero no hay ninguna.")
      if (sizes.length && sizes.length !== variants.length) error("Si el producto usa tallas, todas sus filas deben tener Talla.")
      if (!sizeType) {
        if (sizes.length === 0) sizeType = "NONE"
        else if (existing && existing.sizeType !== "NONE") sizeType = existing.sizeType
        else {
          sizeType = inferSizeType(sizes)
          if (sizeType) info(`Tipo de talla deducido: ${sizeType === "FOOTWEAR" ? "Calzado" : "Ropa"}.`)
          else error("No se pudo deducir el Tipo de talla. Escribe Calzado o Ropa.")
        }
      }
    } else {
      if (group.length > 1) error(`La referencia está en varias filas (${group.map((row) => row.row).join(", ")}) sin Color ni Talla. Si es variable, agrega Color/Talla.`)
      if (group[0].values.variantPrice) warning("Precio variante se ignora en productos simples.", group[0].row)
      if (sizeType && sizeType !== "NONE") error("El Tipo de talla indica tallas, pero no hay ninguna Talla escrita.")
    }

    // Fotos por enlace: las de una fila con Color van a ese color; las demas son generales
    const photoMap = new Map<string, PhotoLinks>()
    for (const row of group) {
      const { urls, invalid } = parsePhotoLinks(row.values.photos)
      if (invalid.length) warning(`En Fotos hay texto que no es un enlace (${invalid.slice(0, 2).join(", ")}): se ignora.`, row.row)
      if (!urls.length) continue
      const color = isVariable ? row.values.color?.trim() : undefined
      const key = normalize(color ?? "")
      const entry = photoMap.get(key) ?? { color, urls: [] }
      entry.urls = [...new Set([...entry.urls, ...urls])].slice(0, 10)
      photoMap.set(key, entry)
    }
    const photoLinks = [...photoMap.values()]
    const photoCount = photoLinks.reduce((total, item) => total + item.urls.length, 0)
    if (photoCount) info(photoCount === 1 ? "Se descargará 1 foto del enlace." : `Se descargarán ${photoCount} fotos de los enlaces.`)

    const simpleCell = isVariable ? undefined : stockCells[0]
    if (simpleCell?.kind === "numbers" && simpleCell.values.length > 1) error("En un producto sin tallas el Stock es un solo número.", group[0].row)
    const simpleStock = simpleCell?.kind === "numbers" ? simpleCell.values[0] : undefined

    // Disponibilidad: inventario propio (numeros), proveedor/dropshipping o bajo pedido
    const kinds = new Set(stockCells.map((cell) => cell.kind))
    const modes = ["numbers", "supplier", "preorder"].filter((kind) => kinds.has(kind as StockCell["kind"]))
    let availability: Availability | undefined
    if (modes.length > 1) {
      error("El Stock mezcla cantidades, \"Proveedor\" y/o \"Bajo pedido\" en el mismo producto. Usa solo una opción.")
    } else if (kinds.has("preorder")) {
      availability = "PREORDER"
    } else if (kinds.has("supplier")) {
      availability = "SUPPLIER"
    } else if (kinds.has("numbers")) {
      availability = "STOCK"
      if (kinds.has("empty") && action === "create") warning("Algunas filas no tienen Stock: esas tallas quedan agotadas (0).")
    } else if (action === "create" && !kinds.has("invalid")) {
      // Sin ningun stock escrito: catalogo de proveedor
      availability = "SUPPLIER"
    }
    if (availability === "SUPPLIER") info("Proveedor / dropshipping: se vende sin stock propio y la tienda muestra \"Disponible\".")
    if (availability === "PREORDER") info("Bajo pedido: se vende sin stock propio y la tienda muestra \"Disponible bajo pedido\".")
    const onDemand = availability === "SUPPLIER" || availability === "PREORDER"

    // Productos existentes que pasan de simple a variable o al reves
    if (existing && isVariable && existing.variants.length === 0) info("Se convertirá en producto variable.")
    if (existing && !isVariable && existing.variants.length > 0) {
      error("Este producto es variable en la tienda: incluye su Color/Talla en cada fila para actualizarlo.")
    }

    // Avisos de lo que se va a crear
    if (category && !lookups.categories.has(normalize(category))) info(`Categoría nueva: "${category}".`)
    if (brand && !lookups.brands.has(normalize(brand))) info(`Marca nueva: "${brand}".`)

    // Slug unico para productos nuevos
    let slug = ""
    if (action === "create" && name) {
      const base = slugify(name) || slugify(sku) || "producto"
      slug = base
      for (let n = 2; lookups.slugs.has(slug) || plannedSlugs.has(slug); n++) slug = `${base}-${n}`
      plannedSlugs.add(slug)
    }

    const stock = onDemand
      ? 0
      : isVariable
        ? variants.reduce((total, variant) => total + (variant.stock ?? 0), 0)
        : simpleStock ?? 0
    const hasError = messages.some((message) => message.type === "error")
    products.push({
      sku,
      name: name || sku,
      action,
      rows: group.map((row) => row.row),
      status: hasError ? "error" : messages.some((message) => message.type === "warning") ? "warning" : "ok",
      messages,
      variantCount: variants.length,
      stock,
      price: price ?? undefined,
      category,
      brand,
      isVariable,
      availability,
      supplierName: first("supplier")?.slice(0, 80),
      photoCount,
      photoLinks,
      stockGiven: simpleStock !== undefined,
      existingId: existing?.id,
      description: first("description"),
      model,
      gender: genderValue === "invalid" ? undefined : genderValue,
      sizeType,
      comparePrice: comparePrice === null ? undefined : comparePrice,
      featured: parseYesNo(first("featured")),
      isNew: parseYesNo(first("isNew")),
      variants,
      ...(slug ? { slug } : {}),
    } as PlannedProduct & { slug?: string })
  }

  // Filas sin referencia
  for (const row of noSku) {
    products.push({
      sku: "",
      name: row.values.name ?? "(sin nombre)",
      action: "create",
      rows: [row.row],
      status: "error",
      messages: [{ type: "error", text: "Falta la Referencia.", row: row.row }],
      variantCount: 0,
      stock: 0,
      isVariable: false,
      photoCount: 0,
      photoLinks: [],
      variants: [],
    })
  }

  return { products, lookups }
}

export async function previewImport(rows: RawRow[], fileErrors: string[] = []): Promise<ImportPreview> {
  const { products, lookups } = await planImport(rows)
  const valid = products.filter((item) => item.status !== "error")
  const unique = (values: (string | undefined)[], existing: Map<string, unknown>) => {
    const seen = new Map<string, string>()
    values.forEach((value) => {
      if (value && !existing.has(normalize(value)) && !seen.has(normalize(value))) seen.set(normalize(value), value)
    })
    return [...seen.values()]
  }
  return {
    summary: {
      rows: rows.length,
      products: products.length,
      create: valid.filter((item) => item.action === "create").length,
      update: valid.filter((item) => item.action === "update").length,
      withErrors: products.filter((item) => item.status === "error").length,
      newCategories: unique(valid.map((item) => item.category), lookups.categories),
      newBrands: unique(valid.map((item) => item.brand), lookups.brands),
      newModels: [],
    },
    // Solo los datos que necesita la pantalla
    items: products.map((item) => ({
      sku: item.sku,
      name: item.name,
      action: item.action,
      rows: item.rows,
      status: item.status,
      messages: item.messages,
      variantCount: item.variantCount,
      stock: item.stock,
      price: item.price,
      category: item.category,
      brand: item.brand,
      isVariable: item.isVariable,
      availability: item.availability,
      photoCount: item.photoCount,
    })),
    fileErrors,
  }
}

// ---------------------------------------------------------------------------
// Importacion
// ---------------------------------------------------------------------------

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  failed: { sku: string; name: string; error: string }[]
  newCategories: number
  newBrands: number
  // Productos nuevos (para buscarles fotos despues)
  createdIds: string[]
  // Fotos por enlace que el navegador descarga despues de importar
  photoJobs: { productId: string; sku: string; name: string; color?: string; urls: string[] }[]
}

export async function runImport(rows: RawRow[]): Promise<ImportResult> {
  const { products, lookups } = await planImport(rows)
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: [], newCategories: 0, newBrands: 0, createdIds: [], photoJobs: [] }

  const ensureCategory = async (name: string) => {
    const found = lookups.categories.get(normalize(name))
    if (found) return found.id
    const slugBase = slugify(name) || "categoria"
    let slug = slugBase
    for (let n = 2; await prisma.category.findUnique({ where: { slug } }); n++) slug = `${slugBase}-${n}`
    const created = await prisma.category.create({ data: { name, slug, variantType: guessVariantType(name) } })
    lookups.categories.set(normalize(name), created)
    result.newCategories++
    return created.id
  }
  const ensureBrand = async (name: string) => {
    const found = lookups.brands.get(normalize(name))
    if (found) return found.id
    const slugBase = slugify(name) || "marca"
    let slug = slugBase
    for (let n = 2; await prisma.brand.findUnique({ where: { slug } }); n++) slug = `${slugBase}-${n}`
    const created = await prisma.brand.create({ data: { name, slug } })
    lookups.brands.set(normalize(name), created)
    result.newBrands++
    return created.id
  }
  const ensureModel = async (name: string, brandId: string) => {
    const key = `${brandId}|${normalize(name)}`
    const found = lookups.models.get(key)
    if (found) return found.id
    const created = await prisma.productModel.upsert({
      where: { brandId_slug: { brandId, slug: slugify(name) } },
      update: {},
      create: { name, slug: slugify(name), brandId },
    })
    lookups.models.set(key, created)
    return created.id
  }

  for (const item of products as (PlannedProduct & { slug?: string })[]) {
    if (item.status === "error") {
      result.skipped++
      continue
    }
    try {
      const categoryId = item.category ? await ensureCategory(item.category) : undefined
      const brandId = item.brand ? await ensureBrand(item.brand) : undefined
      const existing = item.existingId ? lookups.products.get(normalize(item.sku)) : undefined
      const modelBrandId = brandId ?? (existing ? (await prisma.product.findUnique({ where: { id: existing.id }, select: { brandId: true } }))?.brandId : undefined)
      const modelId = item.model && modelBrandId ? await ensureModel(item.model, modelBrandId) : undefined

      // Variantes: se actualizan las que coinciden (conservando sus fotos) y se agregan las nuevas
      const fileVariants = new Map(item.variants.map((variant) => [variantKey(variant.color, variant.size), variant]))
      const merged: VariantInput[] = []
      for (const current of existing?.variants ?? []) {
        const incoming = fileVariants.get(variantKey(current.color, current.size))
        if (incoming) fileVariants.delete(variantKey(current.color, current.size))
        merged.push({
          id: current.id,
          size: current.size ?? undefined,
          color: current.color ?? undefined,
          price: incoming?.price !== undefined ? incoming.price : current.price === null ? null : Number(current.price),
          stock: incoming?.stock !== undefined ? incoming.stock : current.stock,
          images: current.images,
        })
      }
      for (const variant of item.variants) {
        if (!fileVariants.has(variantKey(variant.color, variant.size))) continue
        const colorImages =
          merged.find((current) => normalize(current.color ?? "") === normalize(variant.color ?? "") && current.images.length)
            ?.images ?? []
        merged.push({ size: variant.size, color: variant.color, price: variant.price ?? null, stock: variant.stock ?? 0, images: colorImages })
      }
      // Tallas en orden y colores en el orden del archivo
      const colorOrder = [...new Set(merged.map((variant) => normalize(variant.color ?? "")))]
      merged.sort(
        (a, b) =>
          colorOrder.indexOf(normalize(a.color ?? "")) - colorOrder.indexOf(normalize(b.color ?? "")) ||
          compareSizes(a.size ?? "", b.size ?? "")
      )
      const variantStock = merged.reduce((total, variant) => total + variant.stock, 0)

      const productId = await prisma.$transaction(async (tx) => {
        if (!existing) {
          const created = await tx.product.create({
            data: {
              name: item.name,
              slug: item.slug!,
              sku: item.sku,
              description: item.description ?? "",
              price: item.price!,
              comparePrice: item.comparePrice ?? null,
              stock: item.isVariable ? variantStock : item.stock,
              images: [],
              isNew: item.isNew ?? false,
              isFeatured: item.featured ?? false,
              availability: item.availability ?? "STOCK",
              supplierName: item.supplierName ?? null,
              categoryId: categoryId!,
              brandId: brandId!,
              modelId: modelId ?? null,
              gender: item.gender ?? null,
              sizeType: item.isVariable ? item.sizeType ?? "NONE" : "NONE",
            },
          })
          if (item.isVariable) await syncVariants(tx, created.id, merged)
          return created.id
        } else {
          if (item.isVariable) await syncVariants(tx, existing.id, merged)
          await tx.product.update({
            where: { id: existing.id },
            data: {
              // Las celdas vacias no cambian el dato actual
              name: item.name || undefined,
              description: item.description,
              price: item.price,
              comparePrice: item.comparePrice,
              stock: item.isVariable ? variantStock : item.stockGiven ? item.stock : undefined,
              isNew: item.isNew,
              isFeatured: item.featured,
              availability: item.availability,
              // Celda vacia = no cambia el proveedor guardado
              supplierName: item.supplierName,
              categoryId,
              brandId,
              modelId,
              gender: item.gender,
              sizeType: item.isVariable ? item.sizeType : undefined,
            },
          })
          return existing.id
        }
      })
      if (existing) result.updated++
      else {
        result.created++
        result.createdIds.push(productId)
      }
      for (const links of item.photoLinks) {
        result.photoJobs.push({ productId, sku: item.sku, name: item.name, color: links.color, urls: links.urls })
      }
    } catch (error) {
      console.error("Error importing product", item.sku, error)
      result.failed.push({ sku: item.sku, name: item.name, error: "No se pudo guardar este producto." })
    }
  }

  return result
}

export { moneyText }
