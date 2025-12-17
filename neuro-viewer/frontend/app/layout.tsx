import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neuro Waveform Viewer',
  description: 'Real-time neuroscience waveform visualization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}