import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const logoUrl = `${import.meta.env.BASE_URL}serv-logo.png`
const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function Navbar() {
  const [solid, setSolid] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu if the screen grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const onChange = (e) => e.matches && setMenuOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const link = 'hidden rounded-full px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white sm:inline-block'
  const mobileLink =
    'block w-full rounded-xl px-4 py-3 text-left text-base font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white'
  const goMobile = (id) => {
    setMenuOpen(false)
    go(id)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-all duration-300 ${
        solid || menuOpen ? 'bg-court-dark/90 shadow-lg shadow-court-dark/20 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8 lg:px-12" aria-label="Main">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
          <img src={logoUrl} alt="SERV Pickleball Club" className="h-8" />
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go('about')} className={link}>About</button>
          <button type="button" onClick={() => go('contact')} className={link}>Contact</button>
          <Link
            to="/book"
            className="ml-2 inline-flex min-h-[44px] items-center rounded-full bg-spark px-4 text-sm font-semibold text-white transition-transform active:scale-95 hover:brightness-110 sm:px-5"
          >
            Book a court
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 sm:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-white/10 px-4 pb-4 pt-2 sm:hidden">
          <button type="button" onClick={() => goMobile('about')} className={mobileLink}>About</button>
          <button type="button" onClick={() => goMobile('contact')} className={mobileLink}>Contact</button>
        </div>
      )}
    </header>
  )
}
