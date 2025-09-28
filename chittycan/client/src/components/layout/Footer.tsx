import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-dark text-white py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-2">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <span className="font-bold text-sm">CHITTY</span>
              <span className="text-secondary font-bold text-sm">CAN</span>
            </div>
          </Link>
        </div>
        
        <p className="text-slate-400 text-xs text-center mb-3">
          <span className="text-secondary">Never Sh*tty™</span> - Static IPs made simple
        </p>
        
        <div className="border-t border-slate-800 pt-3 flex flex-col items-center">
          <p className="text-slate-500 text-xs">© 2025 Chitty Services. Built in Chi City.</p>
        </div>
      </div>
    </footer>
  );
}
