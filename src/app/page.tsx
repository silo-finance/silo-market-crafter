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
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Create Markets in 4 Simple Steps
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Our intuitive wizard guides you through the entire process of creating a new Silo market
            </p>
          </div>

          {/* Steps Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-blue-500/50 transition-all duration-300 group">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  1
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Select Assets</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Choose the two tokens for your market. We'll automatically fetch metadata and validate addresses.
                </p>
              </div>
              {/* Connecting Line */}
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transform -translate-y-1/2"></div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 group">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  2
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Configure Silo 1</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Set up the first silo with your preferred parameters and risk settings.
                </p>
              </div>
              {/* Connecting Line */}
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 transform -translate-y-1/2"></div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-pink-500/50 transition-all duration-300 group">
                <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  3
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Configure Silo 2</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Configure the second silo to complete your market setup.
                </p>
              </div>
              {/* Connecting Line */}
              <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-pink-600 to-green-600 transform -translate-y-1/2"></div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-green-500/50 transition-all duration-300 group">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  4
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Deploy Market</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Deploy your complete market and start trading immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Animated Elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-purple-400 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse delay-2000"></div>
            <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-pulse delay-500"></div>
          </div>
        </div>
      </section>

    </main>
  )
}
