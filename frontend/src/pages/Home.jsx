import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import AboutSection from '../components/AboutSection.jsx'
import Footer from '../components/Footer.jsx'

function scrollToAbout() {
  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
}

export default function Home() {
  return (
    <div>
      <section className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 text-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/serv-hero.jpg)' }}
        />
        <div className="absolute inset-0 bg-court-dark/80" />

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-spark font-display font-semibold tracking-widest text-sm uppercase mb-4"
        >
          Mambajao · Maasin City
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative font-display font-bold text-5xl sm:text-7xl text-white leading-[0.95] mb-6"
        >
          SE<span className="text-spark">.</span>RV
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative text-court-light text-lg mb-10 max-w-md"
        >
          Book an indoor court — ₱300/hr, open daily 9AM–12MN.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative"
        >
          <Link
            to="/book"
            className="inline-block bg-spark text-white font-display font-semibold px-10 py-4 rounded-full hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-spark/20"
          >
            Book a Court
          </Link>
        </motion.div>

        <motion.button
          onClick={scrollToAbout}
          aria-label="Scroll to learn more"
          className="relative mt-14 text-white/70 hover:text-white transition-colors"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </section>

      <AboutSection />
      <Footer />
    </div>
  )
}