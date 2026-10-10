export type BudgetImportItemType = 'group' | 'item'

export type BudgetImportRow = {
  code: string
  description: string
  unit_code: string
  quantity: number
  unit_price: number
  stage_code: string | null
  item_type: BudgetImportItemType
  source_row: number
}

export type BudgetImportParseResult = {
  rows: BudgetImportRow[]
  errors: string[]
  sheetName: string
}
