import { useState, useEffect } from 'react';

// Konami code sequence
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

export function useKonami(): boolean {
  const [konamiSequence, setKonamiSequence] = useState<string[]>([]);
  const [showSecretDiscount, setShowSecretDiscount] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Add the current key to the sequence
      const newSequence = [...konamiSequence, e.key];
      
      // Limit sequence to length of Konami code
      if (newSequence.length > KONAMI_CODE.length) {
        newSequence.shift();
      }
      
      setKonamiSequence(newSequence);
      
      // Check if the sequence matches the Konami code
      const isKonamiCode = KONAMI_CODE.every(
        (key, index) => newSequence[index] === key
      );
      
      if (isKonamiCode && newSequence.length === KONAMI_CODE.length) {
        setShowSecretDiscount(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [konamiSequence]);

  const resetKonami = () => {
    setShowSecretDiscount(false);
    setKonamiSequence([]);
  };

  return showSecretDiscount;
}
