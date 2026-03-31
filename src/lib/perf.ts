export function perfStart(label: string) {
  const start = Date.now()
  return () => console.log(`[PERF] ${label}: ${Date.now() - start}ms`)
}
