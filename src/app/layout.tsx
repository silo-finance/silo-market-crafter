import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import AlphaDisclaimer from '@/components/AlphaDisclaimer'
import NetworkWarning from '@/components/NetworkWarning'
import { WizardProvider } from '@/contexts/WizardContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Silo Market Crafter',
  description: 'UI for market creation for Silo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem('market-crafter-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = (saved === 'dark' || saved === 'light') ? saved : (prefersDark ? 'dark' : 'light');
                  document.documentElement.classList.remove('theme-light', 'theme-dark');
                  document.documentElement.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <WizardProvider>
            <NetworkWarning />
            <Header />
            <AlphaDisclaimer>
              {children}
            </AlphaDisclaimer>
          </WizardProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
