import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import { PAGE_TRANSITION } from '@/lib/constants';

import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      initial={PAGE_TRANSITION.initial}
      animate={PAGE_TRANSITION.animate}
      transition={PAGE_TRANSITION.transition}
    >
      {children}
    </motion.div>
  );
};