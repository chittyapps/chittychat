import { useState } from "react";
import { motion } from "framer-motion";
import { Scale, Building, Users, Eye, Globe } from "lucide-react";

interface POVOption {
  id: string;
  label: string;
  icon: any;
  description: string;
  color: string;
}

interface POVSelectorProps {
  currentPOV: string;
  onPOVChange: (pov: string) => void;
}

export function POVSelector({ currentPOV, onPOVChange }: POVSelectorProps) {
  const povOptions: POVOption[] = [
    {
      id: 'aribia',
      label: 'ARIBIA LLC',
      icon: Building,
      description: 'Business Defense Perspective',
      color: 'var(--aribia-purple)'
    },
    {
      id: 'sharon',
      label: 'Sharon Jones',
      icon: Users,
      description: 'Lender & Interim President',
      color: 'var(--aribia-blue)'
    },
    {
      id: 'luisa',
      label: 'Luisa Arias',
      icon: Users,
      description: 'Former Member Claims',
      color: 'var(--aribia-amber)'
    },
    {
      id: 'legal',
      label: 'Legal Neutral',
      icon: Scale,
      description: 'Court & Legal Analysis',
      color: 'var(--aribia-green)'
    },
    {
      id: 'colombia',
      label: 'Colombian Legal',
      icon: Globe,
      description: 'International Compliance',
      color: 'var(--aribia-cyan)'
    }
  ];

  return (
    <div className="modern-card rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Point of View</h2>
          <p className="text-muted-foreground text-sm">Select perspective for analysis</p>
        </div>
        <Eye className="text-primary" size={20} />
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        {povOptions.map((option, index) => (
          <motion.button
            key={option.id}
            className={`p-4 rounded-xl border-2 smooth-hover text-center ${
              currentPOV === option.id 
                ? 'border-primary bg-primary/10' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onPOVChange(option.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
              style={{ backgroundColor: `${option.color}20` }}
            >
              <option.icon size={16} style={{ color: option.color }} />
            </div>
            <div className="text-sm font-semibold text-foreground mb-1">{option.label}</div>
            <div className="text-xs text-muted-foreground">{option.description}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}