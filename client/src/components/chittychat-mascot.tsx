import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Sparkles, Heart, Zap, Coffee, Rocket } from 'lucide-react';

interface MascotProps {
  mood?: 'happy' | 'thinking' | 'celebrating' | 'working' | 'sleeping';
  message?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onInteract?: () => void;
}

const moodEmojis = {
  happy: '😊',
  thinking: '🤔',
  celebrating: '🎉',
  working: '💻',
  sleeping: '😴'
};

const moodColors = {
  happy: 'from-yellow-400 to-orange-400',
  thinking: 'from-blue-400 to-purple-400',
  celebrating: 'from-pink-400 to-red-400',
  working: 'from-green-400 to-teal-400',
  sleeping: 'from-indigo-400 to-purple-400'
};

export const ChittyChatMascot: React.FC<MascotProps> = ({
  mood = 'happy',
  message = "Hi! I'm Chitty, your AI collaboration assistant!",
  position = 'bottom-right',
  onInteract
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentMessage, setCurrentMessage] = useState(message);
  const [isTyping, setIsTyping] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  // Position classes based on prop
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4'
  };

  // Random helpful messages
  const helpfulMessages = [
    "Did you know? You can use blockchain tools to create immutable audit trails!",
    "Pro tip: Use templates to quickly scaffold new projects!",
    "Try our GitHub-like workflows for better collaboration!",
    "All your actions are cryptographically signed for security!",
    "Need help? Just ask me anything about ChittyChat!",
    "Your projects are automatically backed up and versioned!",
    "Use the performance dashboard to track your team's productivity!",
    "ChittyChat integrates seamlessly with Claude Code!"
  ];

  // Animate typing effect
  useEffect(() => {
    if (message !== currentMessage) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        setCurrentMessage(message);
        setIsTyping(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [message, currentMessage]);

  // Create sparkle effect on interaction
  const createSparkle = () => {
    const newSparkle = {
      id: Date.now(),
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50
    };
    setSparkles(prev => [...prev, newSparkle]);
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => s.id !== newSparkle.id));
    }, 1000);
  };

  const handleClick = () => {
    createSparkle();
    // Rotate through helpful messages
    const randomMessage = helpfulMessages[Math.floor(Math.random() * helpfulMessages.length)];
    setCurrentMessage(randomMessage);
    onInteract?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={`fixed ${positionClasses[position]} z-50 flex items-end gap-4`}
        >
          {/* Speech Bubble */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative max-w-xs"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 border-2 border-gray-200 dark:border-gray-700">
              {isTyping ? (
                <div className="flex gap-1">
                  <motion.span
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.span
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.span
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">{currentMessage}</p>
              )}
            </div>
            {/* Speech bubble tail */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-gray-800 transform rotate-45 border-r-2 border-b-2 border-gray-200 dark:border-gray-700" />
          </motion.div>

          {/* Mascot Character */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className="relative cursor-pointer"
          >
            {/* Sparkles Effect */}
            {sparkles.map(sparkle => (
              <motion.div
                key={sparkle.id}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{ 
                  scale: [0, 1, 0],
                  x: sparkle.x,
                  y: sparkle.y,
                  opacity: [1, 0]
                }}
                transition={{ duration: 1 }}
                className="absolute top-1/2 left-1/2 pointer-events-none"
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </motion.div>
            ))}

            {/* Main mascot body */}
            <motion.div
              animate={{
                y: [0, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`relative w-20 h-20 bg-gradient-to-br ${moodColors[mood]} rounded-full shadow-xl flex items-center justify-center`}
            >
              {/* Face */}
              <div className="text-3xl select-none">
                {moodEmojis[mood]}
              </div>

              {/* Status indicator */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"
              />

              {/* Mood indicators */}
              {mood === 'working' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute -bottom-2 -right-2"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                </motion.div>
              )}
              
              {mood === 'celebrating' && (
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="absolute -top-2 -left-2"
                >
                  <Heart className="w-4 h-4 text-red-400" />
                </motion.div>
              )}
            </motion.div>

            {/* Chitty label */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
              Chitty
            </div>
          </motion.div>

          {/* Action buttons */}
          <div className="absolute -top-12 right-0 flex gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsVisible(false)}
              className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              ×
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Reopen button when hidden */}
      {!isVisible && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsVisible(true)}
          className={`fixed ${positionClasses[position]} z-50 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-xl flex items-center justify-center`}
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};