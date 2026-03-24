import { Suspense } from 'react'
import IrmUpdateVerificationPage from '@/components/IrmUpdateVerificationPage'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="light-market-theme min-h-screen text-emerald-900 flex items-center justify-center">
          <div className="text-emerald-900">Loading...</div>
        </div>
      }
    >
      <IrmUpdateVerificationPage />
    </Suspense>
  )
}
