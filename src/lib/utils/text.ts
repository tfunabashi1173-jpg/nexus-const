/**
 * 会社名の正規化（法人格・スペース除去）
 * Streamlitのnormalize_company_name()を移植
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return ''
  let result = name
  const removePatterns = [
    /株式会社/g, /有限会社/g, /合同会社/g, /合資会社/g, /一般社団法人/g,
    /\(株\)/g, /\(有\)/g, /（株）/g, /（有）/g, /㍿/g,
    /\s+/g, /　/g,
  ]
  for (const pattern of removePatterns) {
    result = result.replace(pattern, '')
  }
  return result.trim()
}

/**
 * 文字列の類似度計算（SequenceMatcher相当）
 * Streamlitのfind_similar_match()を移植
 */
export function calcSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1.0

  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  // 部分一致チェック
  if (longer.includes(shorter) && shorter.length > 1) {
    return Math.max(0.9, (2 * shorter.length) / (a.length + b.length))
  }

  // LCS近似
  const len = longestCommonSubsequenceLength(a, b)
  return (2.0 * len) / (a.length + b.length)
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * 候補リストから最も類似した会社を見つける
 */
export function findSimilarMatch(
  target: string,
  candidates: { id: string; name: string }[],
  threshold: number = 0.6
): { id: string; name: string; score: number } | null {
  const targetNorm = normalizeCompanyName(target)
  let best: { id: string; name: string; score: number } | null = null

  for (const candidate of candidates) {
    const nameNorm = normalizeCompanyName(candidate.name)
    if (targetNorm === nameNorm && targetNorm !== '') {
      return { ...candidate, score: 1.0 }
    }
    const score = calcSimilarity(targetNorm, nameNorm)
    if (score >= threshold && (!best || score > best.score)) {
      best = { ...candidate, score }
    }
  }
  return best
}
