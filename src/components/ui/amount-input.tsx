'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AmountInputProps {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * カンマ区切り金額入力フィールド
 * value/onChange はカンマなしの数値文字列でやりとりする
 */
export function AmountInput({ value, onChange, placeholder = '0', className, disabled }: AmountInputProps) {
  const toDisplay = (raw: string) => {
    const num = parseInt(raw.replace(/,/g, ''), 10)
    return isNaN(num) ? '' : num.toLocaleString()
  }

  const [display, setDisplay] = useState(toDisplay(value))

  useEffect(() => {
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')
    const num = parseInt(raw, 10)
    setDisplay(isNaN(num) ? '' : num.toLocaleString())
    onChange(isNaN(num) ? '' : String(num))
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
    />
  )
}
