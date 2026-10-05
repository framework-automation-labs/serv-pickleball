import { useEffect, useRef } from 'react'
import anime from 'animejs/lib/anime.es.js'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import AboutSection from '../components/AboutSection.jsx'
import JerseySection from '../components/JerseySection.jsx'
import Footer from '../components/Footer.jsx'

const assetUrl = (name) => `${import.meta.env.BASE_URL}${name}`
const stats = [
  { value: 3, suffix: '', label: 'Courts' },
  { value: 9, suffix: 'AM–12MN', label: 'Open Daily', textOnly: true },
  { value: 300, suffix: '', label: 'Per Hour', prefix: '₱' },
]

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

export default function Home() {
  const statsRef = useRef(null)
  const statsAnimatedRef = useRef(false)

  useEffect(() => {
    const section = statsRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || statsAnimatedRef.current) return

        statsAnimatedRef.current = true
        section.querySelectorAll('[data-stat-counter]').forEach((counter) => {
          const state = { value: 0 }

          anime({
            targets: state,
            value: Number(counter.dataset.value),
            duration: 1200,
            easing: 'easeOutExpo',
            round: 1,
            update: () => {
              counter.textContent = state.value
            },
          })
        })

        observer.disconnect()
      },
      { threshold: 0.35 },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="bg-mist text-ink overflow-hidden">
      {/* HERO */}
      <section className="relative min-h-[88vh] lg:min-h-[92vh] overflow-hidden flex items-end">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${assetUrl('serv-hero.jpg')})`,
          }}
        />

        <div className="absolute inset-0 bg-[#16324F]/70" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#16324F] via-[#16324F]/30 to-transparent" />

        {/* Decorative court lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-10 pt-24 lg:pb-16 lg:pt-28">
          <div className="max-w-5xl">

            {/* LOCATION */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-[#E8735C]"
            >
              Mambajao · Maasin City
            </motion.p>

            {/* SERV LOGO */}
            <motion.button
              type="button"
              onClick={() => scrollToSection('about')}
              aria-label="Scroll to About SERV"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              whileHover={{
                scale: 1.03,
                y: -3,
              }}
              whileTap={{
                scale: 0.97,
              }}
              className="group mb-4 block cursor-pointer border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8735C] focus-visible:ring-offset-4 focus-visible:ring-offset-[#16324F]"
            >
              <img
                src={assetUrl('serv-logo.png')}
                alt="SERV Pickleball Club"
                className="w-48 sm:w-56 lg:w-64 transition-opacity duration-300 group-hover:opacity-90"
              />

              <span className="mt-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 transition-colors duration-300 group-hover:text-[#E8735C]">
                Discover SERV ↓
              </span>
            </motion.button>

            {/* PRIMARY ACTIONS */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16 }}
              className="mb-6 flex flex-col gap-2.5 sm:flex-row"
            >
              <Link
                to="/book"
                className="inline-flex items-center justify-center bg-[#E8735C] px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
              >
                Book a Court
              </Link>
            </motion.div>

            {/* STATS */}
            <section ref={statsRef} className="mb-6 overflow-hidden bg-[#16324F]/80 text-white">
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="relative px-2 py-3 sm:px-4 sm:py-4"
                  >
                    <span className="absolute left-2 top-2 text-[8px] font-bold tracking-[0.2em] text-white/30 sm:left-4 sm:text-[10px] sm:tracking-[0.3em]">
                      0{index + 1}
                    </span>

                    <div className="pt-3 sm:pt-4">
                      {stat.textOnly ? (
                        <div className="font-display text-[clamp(1rem,4vw,2rem)] font-black tracking-tight whitespace-nowrap">
                          {stat.value}
                          <span className="ml-0.5 text-[clamp(0.55rem,2vw,1rem)] text-[#E8735C] sm:ml-1">
                            {stat.suffix}
                          </span>
                        </div>
                      ) : (
                        <div className="font-display text-[clamp(1.75rem,7vw,3.5rem)] font-black tracking-tight whitespace-nowrap">
                          {stat.prefix}
                          <span data-stat-counter data-value={stat.value}>0</span>
                        </div>
                      )}

                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#E8735C] sm:text-xs sm:tracking-[0.22em]">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* HERO TITLE */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.22 }}
              className="font-display font-black uppercase leading-[0.82] tracking-tight text-white"
            >
              <span className="block text-[clamp(3.25rem,8vw,7rem)]">
                Play.
              </span>

              <span className="block text-[clamp(3.25rem,8vw,7rem)]">
                Compete.
              </span>

              <span className="block text-[clamp(3.25rem,8vw,7rem)] text-[#E8735C]">
                Connect.
              </span>
            </motion.h1>

            {/* DESCRIPTION + BUTTONS */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-5"
            >
              <div>
                <p className="max-w-xl text-base sm:text-lg leading-relaxed text-white/85">
                  Indoor pickleball built for the community.
                </p>

                <p className="mt-1 text-xs sm:text-sm text-white/60">
                  Play more. Compete harder. Meet your people.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="absolute bottom-5 right-6 hidden lg:block"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
            SERV PICKLEBALL CLUB
          </span>
        </motion.div>
      </section>

      {/* ABOUT */}
      <AboutSection />

      {/* MERCH */}
      <section id="merch" className="scroll-mt-20">
        <JerseySection />
      </section>

      {/* FOOTER */}
      <Footer />
    </main>
  )
}