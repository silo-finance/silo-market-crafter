'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const startWizard = () => {
    router.push('/wizard')
  }

  return (
    <main className="light-market-theme min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-emerald-950 mb-6">
              Silo Market Crafter
            </h1>
            <p className="text-xl md:text-2xl text-emerald-800 max-w-4xl mx-auto leading-relaxed mb-12">
              Create and manage markets on Silo with ease. 
              Your gateway to decentralized market creation.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={startWizard}
                className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create New Market</span>
              </button>
              <button className="border border-lime-700/60 hover:border-lime-700 text-emerald-800 hover:text-emerald-900 font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
                Learn More
              </button>
            </div>
          </div>
        </div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-80 h-80 bg-lime-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-emerald-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-green-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
        </div>
      </section>

    </main>
  )
}
