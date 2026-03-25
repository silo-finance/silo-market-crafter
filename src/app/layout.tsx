import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Suspense } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AnimatedCirclesBackground from '@/components/AnimatedCirclesBackground'
import AlphaDisclaimer from '@/components/AlphaDisclaimer'
import NetworkWarning from '@/components/NetworkWarning'
import { WizardProvider } from '@/contexts/WizardContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || ''
const patternCirclesUrl = `${basePath}/pattern-circles.svg`

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
        <style>{`:root{--pattern-circles-url:url(${patternCirclesUrl});--pattern-circles-static-url:url(${patternCirclesUrl})}`}</style>
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
        <AnimatedCirclesBackground />
        <ThemeProvider>
          <WizardProvider>
            <div className="relative z-[1]">
            <NetworkWarning />
            <Suspense fallback={null}>
              <Header />
            </Suspense>
            <div className="pt-5 sm:pt-7">
              <AlphaDisclaimer>
                {children}
              </AlphaDisclaimer>
            </div>
            <Footer />
            </div>
          </WizardProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
