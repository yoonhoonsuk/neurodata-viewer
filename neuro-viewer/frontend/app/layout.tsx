import type { Metadata } from 'next'

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
      <body style={{ margin: 0, padding: 0, backgroundColor: '#1a1a1a', color: '#ffffff' }}>
        {children}
      </body>
    </html>
  )
}
