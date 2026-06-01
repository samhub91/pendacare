import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pendacare — Caregiving Management',
  description: 'Secure caregiving management system for elderly, disability, and childcare.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-gray-900 bg-gray-50">
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
