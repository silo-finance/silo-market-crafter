'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const startWizard = () => {
    router.push('/wizard')
  }

  return (
    <main className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Silo Market Crafter
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12">
              Create and manage markets on Silo with ease. 
              Your gateway to decentralized market creation.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={startWizard}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create New Market</span>
              </button>
              <button className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
                Learn More
              </button>
            </div>
          </div>
        </div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-900/20 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
        </div>
      </section>

      {/* Market Creation Graphics Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Create Markets in 4 Simple Steps
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Our intuitive wizard guides you through the entire process
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">1. Select Assets</h3>
              <p className="text-gray-300 text-sm">Choose the two tokens for your market</p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">2. Configure</h3>
              <p className="text-gray-300 text-sm">Set up market parameters and rules</p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">3. Deploy</h3>
              <p className="text-gray-300 text-sm">Deploy your market contract to blockchain</p>
            </div>
            
            {/* Step 4 */}
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-yellow-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">4. Finalize</h3>
              <p className="text-gray-300 text-sm">Complete setup and start trading</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
