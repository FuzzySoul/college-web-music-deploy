'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`py-3 px-6 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'text-white shadow-md' 
          : 'text-gray-500 bg-white shadow-sm hover:bg-gray-50'
      }`}
      style={active ? { backgroundColor: 'var(--primary)' } : {}}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {icon}
      {label}
    </motion.button>
  );
}
