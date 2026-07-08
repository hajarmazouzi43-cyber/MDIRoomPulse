'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimatedWrapperProps {
  children: ReactNode
  className?: string
  delay?: number
}

export default function AnimatedWrapper({ children, className = '', delay = 0 }: AnimatedWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}