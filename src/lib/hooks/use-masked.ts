'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'nexus_masked'
const EVENT_KEY = 'nexus_masked_change'

export function useMasked(): [boolean, () => void] {
  const [masked, setMasked] = useState(false)

  // 初期値をlocalStorageから読み込み（SSR対応でuseEffect内）
  useEffect(() => {
    setMasked(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  // 他コンポーネントからの変更を検知
  useEffect(() => {
    function onCustomEvent() {
      setMasked(localStorage.getItem(STORAGE_KEY) === '1')
    }
    // 同タブ内の同期用カスタムイベント
    window.addEventListener(EVENT_KEY, onCustomEvent)
    // 別タブ同期用
    window.addEventListener('storage', onCustomEvent)
    return () => {
      window.removeEventListener(EVENT_KEY, onCustomEvent)
      window.removeEventListener('storage', onCustomEvent)
    }
  }, [])

  const toggle = useCallback(() => {
    const next = localStorage.getItem(STORAGE_KEY) !== '1'
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    window.dispatchEvent(new Event(EVENT_KEY))
  }, [])

  return [masked, toggle]
}

/** masked が true のとき ¥ **** を返す表示用ヘルパー */
export function maskYen(value: string, masked: boolean): string {
  return masked ? '¥ ****' : value
}
