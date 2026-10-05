import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../lib/supabaseClient.js'

const IG_URL = 'https://instagram.com/servpickleballclub'
const FB_URL = 'https://facebook.com/servpickleballclub'

export default function JerseySection() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('gallery_images')
        .select('*')
        .not('price', 'is', null)
        .order('created_at', { ascending: false })
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (items.length < 2) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [items.length])

  // Nothing for sale right now — don't show an empty/broken section.
  if (loading || items.length === 0) return null

  const current = items[index]

  return (
    <section className="bg-mist px-6 py-20">
      <div className="max-w-4xl mx-auto grid gap-10 sm:grid-cols-2 items-center">
        <div className="relative rounded-2xl overflow-hidden w-full max-w-xs mx-auto sm:mx-0 h-80">
          <AnimatePresence mode="wait">
            <motion.img
              key={current.id}
              src={current.image_url}
              alt={current.caption ?? 'Club gear'}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>

          {items.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Show item ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'bg-white w-4' : 'bg-white/50 w-1.5'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-center sm:text-left">
          <p className="text-court font-display font-semibold text-sm uppercase tracking-widest mb-2">
            {current.availability === 'pre_order' ? 'Pre-Order Now' : 'Now Available'}
          </p>
          <h2 className="font-display font-bold text-3xl text-ink mb-3">
            {current.product_name || current.caption || 'Club Gear'}
          </h2>
          {current.product_name && current.caption && (
            <p className="text-ink/60 mb-3 max-w-sm mx-auto sm:mx-0">{current.caption}</p>
          )}
          <p className="font-display font-bold text-2xl text-court-dark mb-5">
            ₱{Number(current.price).toLocaleString()}
          </p>
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
