import { motion } from 'motion/react'

export default function AboutSection() {
  return (
    <section id="about" className="bg-white px-6 py-20">
      <div className="max-w-5xl mx-auto grid gap-10 sm:grid-cols-2 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl overflow-hidden aspect-[4/3]"
        >
          <img
            src="/serv-about.jpg"
            alt="Players on SERV pickleball courts"
            className="w-full h-full object-cover"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <p className="text-court font-display font-semibold text-sm uppercase tracking-widest mb-2">
            About SERV
          </p>
          <h2 className="font-display font-bold text-3xl text-ink mb-4">Built for real play.</h2>
          <p className="text-ink/60 mb-6 leading-relaxed">
            Three indoor courts, professionally built with high-grade silica sand and River
            nets — covered and lit day to night, so the game never stops for weather or sunset.
          </p>
          <ul className="space-y-2 text-sm text-ink/70">
            <li className="flex gap-2">
              <span className="text-spark font-bold">•</span> 3 indoor courts, professionally built
            </li>
            <li className="flex gap-2">
              <span className="text-spark font-bold">•</span> Open daily, 9:00 AM – 12:00 Midnight
            </li>
            <li className="flex gap-2">
              <span className="text-spark font-bold">•</span> Walk-ins welcome 1PM–12MN, subject to availability
            </li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}