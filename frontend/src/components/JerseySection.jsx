import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../lib/supabaseClient.js'

const IG_URL = 'https://instagram.com/servpickleballclub'
const FB_URL = 'https://facebook.com/servpickleballclub'

export default function JerseySection() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

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
    if (items.length < 2 || paused) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [items.length, paused])

  // Nothing for sale right now: don't show an empty/broken section.
  if (loading || items.length === 0) return null

  const current = items[index]
  const isPreOrder = current.availability === 'pre_order'

  return (
    <section className="px-6 pb-16 sm:px-8 lg:px-12 lg:pb-24">
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-court-dark"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {/* Court-line detail */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden="true">
          <div className="absolute right-[18%] top-0 h-full w-px bg-white" />
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white" />
        </div>

        <div className="relative grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[260px_1fr] md:gap-10">
          {/* Photo + thumbnails */}
          <div className="mx-auto w-full max-w-[260px]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black/20">
              <AnimatePresence mode="wait">
                <motion.img
                  key={current.id}
                  src={current.image_url}
                  alt={current.caption ?? 'Club gear'}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
            </div>

            {items.length > 1 && (
              <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Choose an item">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show ${item.product_name || item.caption || `item ${i + 1}`}`}
                    onClick={() => setIndex(i)}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      i === index ? 'border-spark opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img src={item.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="text-center md:text-left">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                isPreOrder ? 'bg-spark text-white' : 'bg-white/10 text-white'
              }`}
            >
              {isPreOrder ? 'Pre-order' : 'Available now'}
            </span>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                  {current.product_name || current.caption || 'Club gear'}
                </h2>
                {current.product_name && current.caption && (
                  <p className="mt-2 text-court-light">{current.caption}</p>
                )}
                <p className="mt-4 font-display text-3xl font-bold text-spark">
                  ₱{Number(current.price).toLocaleString()}
                </p>
              </motion.div>
            </AnimatePresence>

            <p className="mt-5 text-sm text-court-light">Send us a message to order.</p>

            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row md:items-center">
              <a
                href={IG_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-spark px-7 font-display font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-95 sm:w-auto"
              >
                Order on Instagram
              </a>
              <a
                href={FB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-white/25 px-7 font-display font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Order on Facebook
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}