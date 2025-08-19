import { Button } from "@/components/ui/button";

export default function Welcome() {
  return (
    <div className="flex-grow flex flex-col">
      {/* Hero Section */}
      <div className="bg-dark text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="text-secondary">ChittyCan™</span> Static IPs
            </h1>
            <p className="text-lg md:text-xl mb-8">
              The easiest way to connect your Replit apps to banking APIs
            </p>
            <a 
              href="/api/login" 
              className="inline-block bg-secondary text-white px-6 py-3 rounded-lg font-medium hover:bg-secondary/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-white dark:bg-gray-900 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            <span className="text-secondary">Simple.</span> <span className="dark:text-white">Reliable.</span> <span className="text-secondary">Secure.</span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <div className="text-secondary text-3xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold mb-2 dark:text-white">Static IPs</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Dedicated static IPs that won't change, perfect for banking API whitelists.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <div className="text-secondary text-3xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2 dark:text-white">One-Click Setup</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Create and configure your tunnel in seconds with our simple interface.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <div className="text-secondary text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2 dark:text-white">Real-time Monitoring</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Track performance, uptime, and bandwidth usage with our intuitive dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to Action */}
      <div className="bg-secondary/10 dark:bg-secondary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 dark:text-white">
            Ready to connect securely?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Built for Us, Built for You, Built in Chicago.
          </p>
          <a 
            href="/api/login" 
            className="inline-block bg-secondary text-white px-6 py-3 rounded-lg font-medium hover:bg-secondary/90 transition-colors"
          >
            Login with Replit
          </a>
        </div>
      </div>
    </div>
  );
}