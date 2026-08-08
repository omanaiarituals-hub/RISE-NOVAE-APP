import type { ReactNode, SVGProps } from 'react'

export type PremiumIconName =
  | 'home'
  | 'calendar'
  | 'document'
  | 'meal'
  | 'notes'
  | 'family'
  | 'routine'
  | 'tracker'
  | 'idea'
  | 'book'
  | 'wallet'
  | 'cart'
  | 'grid'
  | 'clock'
  | 'flag'
  | 'check'
  | 'user'
  | 'sparkle'
  | 'pen'
  | 'voice'
  | 'upload'
  | 'sliders'
  | 'shield'
  | 'chevron'

type PremiumIconProps = SVGProps<SVGSVGElement> & {
  name: PremiumIconName
}

export default function PremiumIcon({
  name,
  width = 24,
  height = 24,
  ...props
}: PremiumIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.65,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const paths: Record<PremiumIconName, ReactNode> = {
    home: (
      <>
        <path {...common} d="M3.5 10.5 12 3.8l8.5 6.7" />
        <path {...common} d="M5.5 9.3V20h13V9.3" />
        <path {...common} d="M9.6 20v-6.1h4.8V20" />
      </>
    ),
    calendar: (
      <>
        <rect {...common} x="3.5" y="5.5" width="17" height="15" rx="2.5" />
        <path {...common} d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" />
        <path {...common} d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
      </>
    ),
    document: (
      <>
        <path {...common} d="M6 2.8h8.3L19 7.5V21H6z" />
        <path {...common} d="M14 2.8v5h5" />
        <path {...common} d="M9 12h6M9 15.5h6M9 19h4" />
      </>
    ),
    meal: (
      <>
        <path {...common} d="M4 16.5h16" />
        <path {...common} d="M6 16.5a6 6 0 0 1 12 0" />
        <path {...common} d="M12 7.5V5" />
        <path {...common} d="M9.7 5h4.6" />
        <path {...common} d="M4.5 20h15" />
      </>
    ),
    notes: (
      <>
        <rect {...common} x="5" y="3.5" width="14" height="17" rx="2" />
        <path {...common} d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4.5" />
        <path {...common} d="m14.5 17.5 4-4" />
      </>
    ),
    family: (
      <>
        <circle {...common} cx="8" cy="8" r="2.5" />
        <circle {...common} cx="16.5" cy="9" r="2.2" />
        <path {...common} d="M3.5 19c.3-4 2.1-6 4.5-6s4.2 2 4.5 6" />
        <path {...common} d="M13.2 18.5c.2-3.2 1.5-4.8 3.4-4.8s3.2 1.6 3.4 4.8" />
      </>
    ),
    routine: (
      <>
        <path {...common} d="M20 7v5h-5" />
        <path {...common} d="M4 17v-5h5" />
        <path {...common} d="M6.2 8.2A7 7 0 0 1 18.6 7L20 12" />
        <path {...common} d="M17.8 15.8A7 7 0 0 1 5.4 17L4 12" />
      </>
    ),
    tracker: (
      <>
        <path {...common} d="M4 19V5" />
        <path {...common} d="M4 19h16" />
        <path {...common} d="m7 15 3-4 3 2 4-6" />
        <circle {...common} cx="7" cy="15" r=".8" />
        <circle {...common} cx="10" cy="11" r=".8" />
        <circle {...common} cx="13" cy="13" r=".8" />
        <circle {...common} cx="17" cy="7" r=".8" />
      </>
    ),
    idea: (
      <>
        <path {...common} d="M8.5 15.5c-1.5-1.2-2.5-3-2.5-5a6 6 0 0 1 12 0c0 2-1 3.8-2.5 5" />
        <path {...common} d="M9 18h6M10 21h4M10 15.5h4" />
      </>
    ),
    book: (
      <>
        <path {...common} d="M4 5.5c3-1 5.7-.6 8 1.2v13c-2.3-1.8-5-2.2-8-1.2z" />
        <path {...common} d="M20 5.5c-3-1-5.7-.6-8 1.2v13c2.3-1.8 5-2.2 8-1.2z" />
      </>
    ),
    wallet: (
      <>
        <rect {...common} x="3.5" y="6" width="17" height="13" rx="2.5" />
        <path {...common} d="M3.5 9h17" />
        <path {...common} d="M15.5 12h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    cart: (
      <>
        <path {...common} d="M3.5 5h2l2 10.2h9.7l2.1-7.1H7" />
        <circle {...common} cx="9.2" cy="19" r="1.2" />
        <circle {...common} cx="17.2" cy="19" r="1.2" />
      </>
    ),
    grid: (
      <>
        <rect {...common} x="4" y="4" width="6" height="6" rx="1.3" />
        <rect {...common} x="14" y="4" width="6" height="6" rx="1.3" />
        <rect {...common} x="4" y="14" width="6" height="6" rx="1.3" />
        <rect {...common} x="14" y="14" width="6" height="6" rx="1.3" />
      </>
    ),
    clock: (
      <>
        <circle {...common} cx="12" cy="12" r="8.5" />
        <path {...common} d="M12 7.5V12l3.2 2" />
      </>
    ),
    flag: (
      <>
        <path {...common} d="M6 21V4" />
        <path {...common} d="M6 5c4-2 7 2 12 0v9c-5 2-8-2-12 0" />
      </>
    ),
    check: (
      <>
        <circle {...common} cx="12" cy="12" r="8.5" />
        <path {...common} d="m8.2 12.2 2.4 2.4 5.4-5.4" />
      </>
    ),
    user: (
      <>
        <circle {...common} cx="12" cy="7.5" r="3.5" />
        <path {...common} d="M5.5 21c.4-5 2.8-7.5 6.5-7.5s6.1 2.5 6.5 7.5" />
      </>
    ),
    sparkle: (
      <>
        <path {...common} d="M12 2.8c.8 4.7 2.5 6.4 7.2 7.2-4.7.8-6.4 2.5-7.2 7.2-.8-4.7-2.5-6.4-7.2-7.2 4.7-.8 6.4-2.5 7.2-7.2Z" />
        <path {...common} d="M18.5 16.8c.3 1.7.9 2.3 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.4 2.4-1 2.7-2.7Z" />
      </>
    ),
    pen: (
      <>
        <path {...common} d="M4 20c4.8-.8 8.2-3.5 10.4-8.2L18.8 4l1.2 1.2-7.8 4.4C7.5 11.8 4.8 15.2 4 20Z" />
        <path {...common} d="m12.2 9.6 2.2 2.2" />
        <path {...common} d="M4 20h6" />
      </>
    ),
    voice: (
      <>
        <path {...common} d="M4 12v2M7 8v8M10 5v14M13 7v10M16 4v16M19 8v8M22 11v3" />
      </>
    ),
    upload: (
      <>
        <path {...common} d="M12 15V4" />
        <path {...common} d="m8 8 4-4 4 4" />
        <path {...common} d="M5 12v7h14v-7" />
      </>
    ),
    sliders: (
      <>
        <path {...common} d="M4 6h16M4 12h16M4 18h16" />
        <circle {...common} cx="9" cy="6" r="1.8" />
        <circle {...common} cx="15" cy="12" r="1.8" />
        <circle {...common} cx="11" cy="18" r="1.8" />
      </>
    ),
    shield: (
      <>
        <path {...common} d="M12 3 19 6v5c0 5-2.6 8.2-7 10-4.4-1.8-7-5-7-10V6z" />
        <path {...common} d="m9 12 2 2 4-4" />
      </>
    ),
    chevron: <path {...common} d="m9 5 7 7-7 7" />,
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
