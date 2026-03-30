import { format, addMonths, getDaysInMonth, endOfMonth, parseISO } from 'date-fns'

/**
 * 入金予定日の自動計算
 * Streamlitのcalc_scheduled_date()を移植
 */
export function calcScheduledDate(
  baseDate: Date,
  closeDay: number,
  payMonths: number,
  payDay: number
): Date | null {
  try {
    let closingDate: Date

    if (closeDay === 99) {
      // 月末締め
      closingDate = endOfMonth(baseDate)
    } else {
      if (baseDate.getDate() <= closeDay) {
        closingDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), closeDay)
      } else {
        const next = addMonths(baseDate, 1)
        closingDate = new Date(next.getFullYear(), next.getMonth(), closeDay)
      }
    }

    const targetMonthFirst = addMonths(
      new Date(closingDate.getFullYear(), closingDate.getMonth(), 1),
      payMonths
    )

    if (payDay === 99) {
      return endOfMonth(targetMonthFirst)
    } else {
      const daysInMonth = getDaysInMonth(targetMonthFirst)
      const day = Math.min(payDay, daysInMonth)
      return new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth(), day)
    }
  } catch {
    return null
  }
}

/**
 * 会計年度の計算
 */
export function getFiscalYear(date: Date, startMonth: number = 4): number {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  return month >= startMonth ? year : year - 1
}

/**
 * 会計年度の開始日・終了日
 */
export function getFiscalYearRange(
  fiscalYear: number,
  startMonth: number = 4
): { start: Date; end: Date } {
  const start = new Date(fiscalYear, startMonth - 1, 1)
  const end = addMonths(new Date(fiscalYear + 1, startMonth - 1, 1), 0)
  end.setDate(end.getDate() - 1)
  return { start, end }
}

/**
 * 金額フォーマット
 */
export function formatYen(amount: number): string {
  if (!amount && amount !== 0) return '¥0'
  const abs = Math.abs(amount)
  if (abs >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(2)} 億円`
  if (abs >= 10_000) return `¥${Math.round(amount / 10_000).toLocaleString()} 万円`
  return `¥${amount.toLocaleString()}`
}

export function formatYenFull(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '¥0'
  return `¥${Math.round(amount).toLocaleString()}`
}

/**
 * YYYY-MM-DD形式で今日の日付
 */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * 年月フォーマット (YYYY-MM-01)
 */
export function toMonthString(date: Date): string {
  return format(date, 'yyyy-MM') + '-01'
}
