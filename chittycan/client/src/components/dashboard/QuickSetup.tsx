import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function QuickSetup() {
  const { toast } = useToast();
  const [selectedService, setSelectedService] = useState("mercury-bank");
  
  const handleCopyCode = () => {
    const code = `npm install @chitty/can && const staticIP = require('@chitty/can').connect('${selectedService}');`;
    
    navigator.clipboard.writeText(code)
      .then(() => {
        toast({
          title: "Code copied to clipboard!",
          description: "You can now paste it in your Replit app",
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Please copy the code manually",
          variant: "destructive",
        });
      });
  };
  
  return (
    <div className="max-w-6xl mx-auto mb-8">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold mb-1">Quick Setup</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Configure your Replit app to use a static IP in minutes</p>
        
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-4">
              <i className="fas fa-plug text-xl"></i>
            </div>
            <h3 className="font-bold text-lg mb-1">1. Connect</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Choose from our supported services - Cloudflare, Google Cloud, GitHub, or custom configurations.</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-4">
              <i className="fas fa-cog text-xl"></i>
            </div>
            <h3 className="font-bold text-lg mb-1">2. Configure</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Set your API endpoint and desired tunnel settings with our simple configuration tool.</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-4">
              <i className="fas fa-code text-xl"></i>
            </div>
            <h3 className="font-bold text-lg mb-1">3. Integrate</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Copy our one-line setup to your Replit app and start making secure API calls instantly.</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-slate-300 text-sm">Integration Code for Replit</p>
            <button 
              className="text-slate-400 hover:text-primary"
              aria-label="Copy code"
              onClick={handleCopyCode}
            >
              <i className="fas fa-copy"></i>
            </button>
          </div>
          <pre className="font-mono text-sm text-slate-300 overflow-x-auto">
            <code>npm install @chitty/can && const staticIP = require('@chitty/can').connect('{selectedService}');</code>
          </pre>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 text-green-700 dark:text-green-400">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-info-circle mt-0.5"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm">Once connected, all your API requests will go through your dedicated static IP, allowing banking APIs to securely recognize your app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
