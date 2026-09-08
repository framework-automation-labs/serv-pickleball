import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const IG_URL = 'https://instagram.com/servpickleballclub'
const FB_URL = 'https://facebook.com/servpickleballclub'
const images = ['/jersey-1.jpg', '/jersey-2.jpg', '/jersey-3.jpg']

export default function JerseySection() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="bg-mist px-6 py-20">
      <div className="max-w-4xl mx-auto grid gap-10 sm:grid-cols-2 items-center">
        <div className="relative rounded-2xl overflow-hidden w-full max-w-xs mx-auto sm:mx-0 h-80">
          <AnimatePresence mode="wait">
            <motion.img
              key={images[index]}
              src={images[index]}
              alt="SERV Jersey V1"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
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
        </div>

        <div className="text-center sm:text-left">
          <p className="text-court font-display font-semibold text-sm uppercase tracking-widest mb-2">
            Pre-Order Now
          </p>
          <h2 className="font-display font-bold text-3xl text-ink mb-3">SERV Jersey V1</h2>
          <p className="text-ink/60 mb-6 max-w-sm mx-auto sm:mx-0">
            Rep the club on and off the court. Limited pre-order batch, ₱750 per jersey.
          </p>
          <p className="font-display font-bold text-2xl text-court-dark mb-5">₱750</p>
          <div className="flex gap-3 flex-wrap justify-center sm:justify-start">
            <a
              href={IG_URL}
              target="_blank"
              rel="noreferrer"
              className="bg-spark text-white font-display font-semibold px-6 py-3 rounded-full hover:brightness-110 transition-all"
            >
              Order via Instagram
            </a>

            <a
              href={FB_URL}
              target="_blank"
              rel="noreferrer"
              className="bg-court text-white font-display font-semibold px-6 py-3 rounded-full hover:bg-court-dark transition-all"
            >
              Order via Facebook
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}