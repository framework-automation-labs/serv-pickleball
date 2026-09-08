import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import AboutSection from '../components/AboutSection.jsx'
import JerseySection from '../components/JerseySection.jsx'
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

        <motion.img
          src="/serv-logo.png"
          alt="SERV Pickleball Club"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative w-64 sm:w-45 mb-4"
        />

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
          className="relative flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0px 0px rgba(232,115,92,0.5)',
                '0 0 32px 10px rgba(232,115,92,0.45)',
                '0 0 0px 0px rgba(232,115,92,0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="rounded-full inline-block"
          >
            <Link
              to="/book"
              className="inline-block bg-spark text-white font-display font-semibold px-10 py-4 rounded-full hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Book a Court
            </Link>
          </motion.div>

          <button
            onClick={scrollToAbout}
            className="border border-white/40 text-white/80 font-display text-sm px-6 py-2 rounded-full hover:bg-white/10 hover:text-white transition-colors"
          >
            About Us
          </button>
        </motion.div>
      </section>

      <AboutSection />
      <JerseySection />
      <Footer />
    </div>
  )
}