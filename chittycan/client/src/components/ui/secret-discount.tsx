import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SecretDiscount() {
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText("KONAMI20")
      .then(() => {
        toast({
          title: "Copied to clipboard!",
          description: "Discount code KONAMI20 has been copied",
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Please copy the code manually: KONAMI20",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsOpen(false);
      });
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-md w-full">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-2xl font-bold mb-2 text-primary">You Found a Secret Discount!</div>
            <p className="mb-4">Use code <span className="font-mono font-bold">KONAMI20</span> for 20% off your next service call!</p>
            <Button
              onClick={handleCopyCode}
              className="bg-secondary hover:bg-secondary/80 text-white font-bold py-2 px-4 rounded-lg transition-colors mb-4"
            >
              Copy Code & Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
