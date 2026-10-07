import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const assetUrl = (name) => `${import.meta.env.BASE_URL}${name}`
const images = ['serv-about.jpg', 'serv-about-2.jpg', 'serv-gallery-1.jpg', 'serv-gallery-2.jpg'].map(assetUrl)
const experiences = [
  {
    number: '01',
    title: 'Play',
    description: 'Professional indoor pickleball courts built for real play.',
    image: 'serv-about.jpg',
  },
  {
    number: '02',
    title: 'Compete',
    description: 'Tournaments, events, and challenges that keep the game moving.',
    image: 'serv-about-2.jpg',
  },
  {
    number: '03',
    title: 'Connect',
    description: 'A community built around the game and the people who play it.',
    image: 'serv-hero.jpg',
  },
]

export default function AboutSection() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
    <section id="about" className="bg-mist px-6 pt-20 sm:px-8 lg:px-12 lg:pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-10 pb-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl"
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={images[index]}
                src={images[index]}
                alt="SERV Pickleball Club"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>

            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Show photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'bg-white w-4' : 'bg-white/50 w-1.5'
                  }`}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-link">
              About SERV
            </p>
            <h2 className="mb-4 font-display text-4xl font-black uppercase leading-none tracking-tight text-ink sm:text-5xl">
              Built for
              <span className="block text-[#E8735C]">real play.</span>
            </h2>
            <p className="mb-6 leading-relaxed text-ink/60">
              Four indoor courts, including our Champion's Court, professionally built with high-grade silica sand and River
              nets — covered and lit day to night, so the game never stops for weather or sunset.
            </p>
            <ul className="space-y-2 text-sm text-ink/70">
              <li className="flex gap-2">
                <span className="font-bold text-[#E8735C]">•</span> 4 indoor courts, including the Champion's Court
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#E8735C]">•</span> Open daily, 9:00 AM – 12:00 Midnight
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#E8735C]">•</span> Walk-ins welcome 1PM–12MN, subject to availability
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>

    <section id="experience" className="bg-sand px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-5 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-link">
                The SERV Experience
              </p>

              <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-none tracking-tight text-ink sm:text-5xl lg:text-7xl">
                More than
                <span className="block text-[#E8735C]">a place to play.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-ink/60 lg:text-base">
              More than a place to play. SERV brings courts, competition, and
              community together under one roof.
            </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {experiences.map((experience) => (
            <motion.article
              key={experience.number}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="group relative min-h-[420px] overflow-hidden bg-[#16324F]"
            >
              <img
                src={assetUrl(experience.image)}
                alt={experience.title}
                className="absolute inset-0 h-full w-full object-cover opacity-65 transition-transform duration-700 ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-[#16324F]/55 transition-colors duration-300 group-hover:bg-[#16324F]/45" />

              <div className="relative flex min-h-[420px] flex-col justify-between p-7 sm:p-8">
                <div className="flex items-start justify-between"><span />

                  <motion.div
                    whileHover={{ rotate: 45 }}
                    className="flex h-10 w-10 items-center justify-center border border-white/30 text-white"
                  >
                    <span className="text-lg leading-none">↗</span>
                  </motion.div>
                </div>

                <div>
                  <h3 className="font-display text-5xl font-black uppercase tracking-tight text-white sm:text-6xl">
                    {experience.title}
                  </h3>
                  <div className="mt-4 h-px w-12 bg-[#E8735C] transition-all duration-300 group-hover:w-20" />
                  <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
                    {experience.description}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
    </>
  )
}