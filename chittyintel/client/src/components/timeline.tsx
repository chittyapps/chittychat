import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building, Users, DollarSign, Scale, Gavel } from "lucide-react";

interface TimelineEvent {
  id: number;
  title: string;
  date: Date;
  description: string;
  type: string;
  color: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  const getIcon = (type: string) => {
    switch (type) {
      case 'formation': return Building;
      case 'member': return Users;
      case 'financial': return DollarSign;
      case 'ownership': return Scale;
      default: return Gavel;
    }
  };

  const getColorVar = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'var(--chitty-primary)',
      amber: 'var(--chitty-amber)',
      blue: 'var(--chitty-blue)',
      purple: 'var(--chitty-primary)',
      red: 'var(--chitty-red)'
    };
    return colorMap[color] || 'var(--chitty-primary)';
  };

  return (
    <div className="modern-card rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">ChittyIntel Legal Timeline</h2>
          <p className="text-muted-foreground">Corporate evolution and key legal events • 2022-2025</p>
        </div>
        <div className="text-gradient text-sm font-semibold">Interactive Timeline</div>
      </div>
      
      {/* Desktop Horizontal Timeline */}
      <div className="relative overflow-hidden">
        {/* Timeline Base Line */}
        <div className="timeline-gradient h-1 rounded-full mb-8"></div>
        
        {/* Timeline Events */}
        <div className="flex justify-between items-start relative -mt-10">
          {events.map((event, index) => {
            const Icon = getIcon(event.type);
            const color = getColorVar(event.color);
            
            return (
              <motion.div
                key={event.id}
                className="timeline-marker group cursor-pointer relative flex flex-col items-center"
                onHoverStart={() => setHoveredEvent(event.id)}
                onHoverEnd={() => setHoveredEvent(null)}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.15 }}
              >
                {/* Event Icon */}
                <motion.div
                  className="w-8 h-8 rounded-xl border-2 border-background flex items-center justify-center mb-3 shadow-lg"
                  style={{ backgroundColor: color }}
                  whileHover={{ scale: 1.2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon size={14} className="text-background" />
                </motion.div>
                
                {/* Event Date */}
                <div className="text-xs text-muted-foreground font-medium mb-1">
                  {event.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </div>
                
                {/* Event Title */}
                <div className="text-sm font-semibold text-foreground text-center max-w-20">
                  {event.title.split(' ').slice(0, 2).join(' ')}
                </div>
                
                {/* Hover Tooltip */}
                <AnimatePresence>
                  {hoveredEvent === event.id && (
                    <motion.div
                      className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20"
                      initial={{ opacity: 0, y: -10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="glass-card rounded-xl p-4 min-w-64 max-w-80">
                        <div className="flex items-center space-x-3 mb-2">
                          <div 
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: color }}
                          >
                            <Icon size={12} className="text-background" />
                          </div>
                          <h4 className="font-semibold text-foreground">{event.title}</h4>
                        </div>
                        <p className="text-sm text-primary mb-2">{event.date.toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
