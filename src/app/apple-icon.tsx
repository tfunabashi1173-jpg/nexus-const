import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0f172a',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      <span
        style={{
          color: '#3b82f6',
          fontSize: 108,
          fontWeight: 800,
          fontFamily: 'sans-serif',
          letterSpacing: '-4px',
          lineHeight: 1,
        }}
      >
        N
      </span>
      <span
        style={{
          color: '#475569',
          fontSize: 20,
          fontFamily: 'sans-serif',
          letterSpacing: '6px',
          marginTop: 2,
        }}
      >
        NEXUS
      </span>
    </div>,
    { ...size }
  )
}
