import { NextRequest, NextResponse } from "next/server"
import { MAX_IMPORT_ROWS, readImportFile } from "@/lib/product-import"

const MAX_FILE_BYTES = 5 * 1024 * 1024

// Lee el archivo subido (Excel o CSV) y devuelve sus filas, o una respuesta de error
export async function readUploadedImport(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { error: NextResponse.json({ error: "Selecciona un archivo." }, { status: 400 }) }
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
    return { error: NextResponse.json({ error: "El archivo debe ser Excel (.xlsx) o CSV (.csv)." }, { status: 400 }) }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: NextResponse.json({ error: "El archivo es muy grande (máximo 5 MB)." }, { status: 400 }) }
  }

  try {
    const { rows, missingHeaders } = await readImportFile(Buffer.from(await file.arrayBuffer()), file.name)
    if (missingHeaders.includes("Referencia")) {
      return {
        error: NextResponse.json(
          { error: 'No se encontró la columna "Referencia". Usa la plantilla descargada desde esta página.' },
          { status: 400 }
        ),
      }
    }
    if (rows.length === 0) {
      return { error: NextResponse.json({ error: 'La hoja "Productos" no tiene filas con datos.' }, { status: 400 }) }
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        error: NextResponse.json(
          { error: `El archivo tiene ${rows.length} filas. El máximo por carga es ${MAX_IMPORT_ROWS}.` },
          { status: 400 }
        ),
      }
    }
    const fileErrors = missingHeaders.map((header) => `Falta la columna "${header}" en el archivo.`)
    return { rows, fileErrors }
  } catch (error) {
    console.error("Error reading import file:", error)
    return {
      error: NextResponse.json(
        { error: "No se pudo leer el archivo. Verifica que sea un Excel o CSV válido." },
        { status: 400 }
      ),
    }
  }
}
