import type { ReactNode } from 'react'
import Navigation from '@/components/Navigation'

export default function AdminDocumentsLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <>
      <div style={{ paddingBottom: '104px' }}>{children}</div>
      <Navigation />
    </>
  )
}
