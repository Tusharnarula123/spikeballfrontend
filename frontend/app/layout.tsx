// @ts-ignore: allow global CSS import without type declarations
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'

export const metadata = {
  title: 'OU Roundnet Club',
  description: 'Oakland University Roundnet Club — Est. 2020',
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  )
}
