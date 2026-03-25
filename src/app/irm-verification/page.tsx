import { Suspense } from 'react'
import IrmUpdateVerificationPage from '@/components/IrmUpdateVerificationPage'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="silo-page flex items-center justify-center">
          <div className="silo-text-main">Loading...</div>
        </div>
      }
    >
      <IrmUpdateVerificationPage />
    </Suspense>
  )
}
