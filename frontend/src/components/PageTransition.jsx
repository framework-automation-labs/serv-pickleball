import { motion } from 'motion/react'

// Soft fade-in between booking-flow pages.
// Opacity only on purpose: a transform on this wrapper would break the
// `position: fixed` sticky bar on the Booking page while it animates.
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
