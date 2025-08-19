import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export function NavBar() {
  // Check if user is authenticated
  const { data: user, isLoading } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  return (
    <nav className="bg-dark text-white px-4 py-2 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center space-x-1 cursor-pointer">
            <span className="font-bold text-lg">CHITTY</span>
            <span className="text-secondary font-bold text-lg">CAN</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {!user ? (
            <a href="/api/login" className="bg-secondary text-white text-xs px-3 py-1.5 rounded-full shadow-sm hover:bg-secondary/90 transition-colors">
              Login
            </a>
          ) : (
            <div className="flex items-center gap-2">
              {user.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <a href="/api/logout" className="text-xs text-white/70 hover:text-white">
                Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
