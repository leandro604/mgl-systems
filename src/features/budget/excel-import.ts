import type { BudgetImportParseResult, BudgetImportRow } from './import-types'

const headerAliases = {
  code: new Set(['codigo', 'cod', 'partida', 'item', 'item codigo', 'codigo partida']),
  description: new Set(['descripcion', 'detalle', 'nombre', 'descripcion partida', 'partida descripcion']),
  unit: new Set(['unidad', 'und', 'um', 'u m', 'unidad medida']),
  quantity: new Set(['cantidad', 'cant', 'metrado', 'qty', 'cantidad cotizada']),
  unitPrice: new Set(['precio unitario', 'precio', 'pu', 'p u', 'unit price', 'precio cotizado']),
  stage: new Set(['etapa', 'stage', 'codigo etapa', 'etapa codigo']),
  type: new Set(['tipo', 'item type', 'tipo partida']),
} as const

export function normalizeBudgetHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function parseLocalizedNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const cleaned = raw.replace(/\s/g, '').replace(/[Ss]\/?\.?/g, '').replace(/[$€]/g, '')
  const comma = cleaned.lastIndexOf(',')
  const dot = cleaned.lastIndexOf('.')
  let canonical = cleaned

  if (comma > dot) canonical = cleaned.replace(/\./g, '').replace(',', '.')
  else if (dot > comma && comma >= 0) canonical = cleaned.replace(/,/g, '')
  else if (comma >= 0) canonical = cleaned.replace(',', '.')

  const parsed = Number(canonical)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function isAlias(value: string, aliases: Set<string>): boolean {
  return aliases.has(value)
}

function cellValue(cell: { value: unknown; text?: string }): unknown {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()

  const object = value as Record<string, unknown>
  if ('result' in object && object.result !== undefined) return object.result
  if ('text' in object && typeof object.text === 'string') return object.text
  if ('richText' in object && Array.isArray(object.richText)) {
    return object.richText
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text) : ''))
      .join('')
  }
  return cell.text ?? String(value)
}

function resolveHeaderIndex(values: string[], aliases: Set<string>): number {
  return values.findIndex((value) => isAlias(value, aliases))
}

/** Reads the first useful worksheet from an .xlsx file entirely in the browser. */
export async function parseBudgetWorkbook(file: File): Promise<BudgetImportParseResult> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Selecciona un archivo .xlsx.')
  if (file.size > 15 * 1024 * 1024) throw new Error('El archivo supera el límite de 15 MB.')

  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const bytes = await file.arrayBuffer()
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0)
  if (!worksheet) throw new Error('El Excel no contiene hojas con datos.')

  let headerRow = 0
  let headers: string[] = []
  const scanLimit = Math.min(worksheet.actualRowCount, 15)

  for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const candidate: string[] = []
    for (let col = 1; col <= Math.max(row.cellCount, 12); col += 1) {
      candidate.push(normalizeBudgetHeader(cellValue(row.getCell(col))))
    }
    const hasCode = resolveHeaderIndex(candidate, headerAliases.code) >= 0
    const hasDescription = resolveHeaderIndex(candidate, headerAliases.description) >= 0
    if (hasCode && hasDescription) {
      headerRow = rowNumber
      headers = candidate
      break
    }
  }

  if (!headerRow) {
    throw new Error('No se encontraron las columnas Código y Descripción en las primeras 15 filas.')
  }

  const indexes = {
    code: resolveHeaderIndex(headers, headerAliases.code),
    description: resolveHeaderIndex(headers, headerAliases.description),
    unit: resolveHeaderIndex(headers, headerAliases.unit),
    quantity: resolveHeaderIndex(headers, headerAliases.quantity),
    unitPrice: resolveHeaderIndex(headers, headerAliases.unitPrice),
    stage: resolveHeaderIndex(headers, headerAliases.stage),
    type: resolveHeaderIndex(headers, headerAliases.type),
  }

  const rows: BudgetImportRow[] = []
  const errors: string[] = []

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const read = (zeroBasedIndex: number): unknown => zeroBasedIndex < 0 ? '' : cellValue(row.getCell(zeroBasedIndex + 1))
    const code = String(read(indexes.code) ?? '').trim()
    const description = String(read(indexes.description) ?? '').trim()

    if (!code && !description) continue
    if (!code || !description) {
      errors.push(`Fila ${rowNumber}: Código y Descripción son obligatorios.`)
      continue
    }

    const typeRaw = normalizeBudgetHeader(read(indexes.type))
    const itemType = ['grupo', 'group', 'capitulo', 'subcapitulo'].includes(typeRaw) ? 'group' : 'item'
    const quantity = itemType === 'group' ? 0 : parseLocalizedNumber(read(indexes.quantity))
    const unitPrice = itemType === 'group' ? 0 : parseLocalizedNumber(read(indexes.unitPrice))

    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push(`Fila ${rowNumber}: cantidad/metrado inválido.`)
      continue
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`Fila ${rowNumber}: precio unitario inválido.`)
      continue
    }
    if (itemType === 'item' && quantity <= 0) {
      errors.push(`Fila ${rowNumber}: una partida ejecutable necesita metrado mayor a cero.`)
      continue
    }

    rows.push({
      code,
      description,
      unit_code: String(read(indexes.unit) ?? 'NIU').trim() || 'NIU',
      quantity,
      unit_price: unitPrice,
      stage_code: indexes.stage >= 0 ? (String(read(indexes.stage) ?? '').trim() || null) : null,
      item_type: itemType,
      source_row: rowNumber,
    })
  }

  if (!rows.length && !errors.length) errors.push('No se encontraron partidas debajo de la cabecera.')
  if (rows.length > 2000) throw new Error('La importación admite hasta 2,000 filas por archivo.')

  return { rows, errors, sheetName: worksheet.name }
}
