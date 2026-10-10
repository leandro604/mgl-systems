import type { CostStatus } from '@/lib/db/schema'

export type CostThresholds = {
  minorMaxPct: number
  majorMaxPct: number
}

export const DEFAULT_COST_THRESHOLDS: Readonly<CostThresholds> = {
  minorMaxPct: 10,
  majorMaxPct: 25,
}

export type CostInputs = {
  qtyQuoted: number
  unitPriceQuoted: number
  qtyActual: number
  unitPriceActual: number
}

export type BudgetItemCostLike = {
  quantity: number
  unit_price: number
  qty_actual: number
  unit_price_actual: number
}

export type CostCalculation = {
  quotedTotal: number
  actualTotal: number
  deviationAmount: number
  deviationPct: number | null
  status: CostStatus
}

/** PostgreSQL numeric round(x, scale): ties are rounded away from zero. */
export function roundSqlNumeric(value: number, decimals = 2): number {
  assertFinite(value, 'value')
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 8) {
    throw new RangeError('decimals must be an integer between 0 and 8')
  }
  const factor = 10 ** decimals
  const scaled = value * factor
  const sign = scaled < 0 ? -1 : 1
  const absolute = Math.abs(scaled)
  const epsilon = Number.EPSILON * Math.max(1, absolute) * 4
  return (sign * Math.floor(absolute + 0.5 + epsilon)) / factor
}

export function validateCostThresholds(thresholds: CostThresholds): CostThresholds {
  assertNonNegative(thresholds.minorMaxPct, 'minorMaxPct')
  assertNonNegative(thresholds.majorMaxPct, 'majorMaxPct')
  if (thresholds.majorMaxPct < thresholds.minorMaxPct) {
    throw new RangeError('majorMaxPct must be greater than or equal to minorMaxPct')
  }
  return thresholds
}

/**
 * Mirrors Task 1 PostgreSQL exactly:
 * - displayed/generated amounts use raw multiplication rounded to 2 decimals;
 * - deviation_pct returns null when quoted amount rounds to zero;
 * - status classification uses the rounded totals, just like
 *   mgl_private.recalculate_budget_cost_status().
 */
export function calculateCostDeviation(
  input: CostInputs,
  thresholds: CostThresholds = DEFAULT_COST_THRESHOLDS,
): CostCalculation {
  assertNonNegative(input.qtyQuoted, 'qtyQuoted')
  assertNonNegative(input.unitPriceQuoted, 'unitPriceQuoted')
  assertNonNegative(input.qtyActual, 'qtyActual')
  assertNonNegative(input.unitPriceActual, 'unitPriceActual')
  validateCostThresholds(thresholds)

  const quotedRaw = input.qtyQuoted * input.unitPriceQuoted
  const actualRaw = input.qtyActual * input.unitPriceActual
  const quotedTotal = roundSqlNumeric(quotedRaw, 2)
  const actualTotal = roundSqlNumeric(actualRaw, 2)
  const deviationAmount = roundSqlNumeric(actualRaw - quotedRaw, 2)

  const deviationPct = quotedTotal === 0
    ? null
    : roundSqlNumeric(((actualRaw - quotedRaw) / quotedRaw) * 100, 2)

  let status: CostStatus
  if (actualTotal <= quotedTotal) {
    status = 'dentro_presupuesto'
  } else if (quotedTotal === 0) {
    status = 'critico'
  } else {
    const statusPct = ((actualTotal - quotedTotal) / quotedTotal) * 100
    if (statusPct <= thresholds.minorMaxPct) status = 'alerta_menor'
    else if (statusPct <= thresholds.majorMaxPct) status = 'alerta_mayor'
    else status = 'critico'
  }

  return {
    quotedTotal,
    actualTotal,
    deviationAmount,
    deviationPct,
    status,
  }
}

export function calculateBudgetItemCost(
  item: BudgetItemCostLike,
  thresholds: CostThresholds = DEFAULT_COST_THRESHOLDS,
): CostCalculation {
  return calculateCostDeviation(
    {
      qtyQuoted: item.quantity,
      unitPriceQuoted: item.unit_price,
      qtyActual: item.qty_actual,
      unitPriceActual: item.unit_price_actual,
    },
    thresholds,
  )
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`)
}

function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new RangeError(`${label} cannot be negative`)
}
