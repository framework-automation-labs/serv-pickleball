import { Link } from 'react-router-dom'

const logoUrl = `${import.meta.env.BASE_URL}serv-logo.png`
const IG_URL = 'https://www.instagram.com/serv_club?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=='
const FB_URL = 'https://www.facebook.com/share/1Birykpkaa/?mibextid=wwXIfr'
const ADDRESS = 'K. Kangleon St., Mambajao, Maasin City, Southern Leyte, Philippines'
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`

const linkCls =
  'inline-flex min-h-[44px] items-center text-sm text-court-light transition-colors hover:text-white sm:min-h-0 sm:py-1'
const headingCls = 'mb-3 font-display text-sm font-semibold text-white'
const iconBtn =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-court-light transition-all hover:-translate-y-0.5 hover:bg-spark hover:text-white active:scale-95'

export default function Footer() {
  return (
    <footer id="contact" className="bg-court-dark text-court-light">
      {/* Details */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1fr_1fr_1.4fr] lg:px-12">
        <div className="space-y-8">
          <div>
            <h3 className={headingCls}>Visit us</h3>
            <address className="text-sm not-italic leading-relaxed">
              K. Kangleon St., Mambajao
              <br />
              Maasin City, Southern Leyte
            </address>
            <p className="mt-3 text-sm">Open daily, 9:00 AM to 12:00 Midnight</p>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Get directions
            </a>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className={headingCls}>Explore</h3>
            <nav aria-label="Footer" className="flex flex-col">
              <Link to="/book" className={linkCls}>Book a court</Link>
            </nav>
          </div>
          <div>
            <h3 className={headingCls}>Follow us</h3>
            <div className="flex gap-3">
              <a href={IG_URL} target="_blank" rel="noreferrer" aria-label="Instagram" className={iconBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.2c3.2 0 3.6 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.25.07 1.63.07 4.81s-.01 3.56-.07 4.81c-.15 3.23-1.66 4.77-4.92 4.92-1.25.06-1.63.07-4.85.07s-3.6 0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.25-.07-1.63-.07-4.81s.01-3.56.07-4.81c.15-3.23 1.67-4.77 4.92-4.92C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.14 0-3.5.01-4.74.07-2.27.1-3.4 1.24-3.5 3.5-.06 1.24-.07 1.6-.07 4.5s.01 3.26.07 4.5c.1 2.26 1.23 3.4 3.5 3.5 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c2.26-.1 3.4-1.24 3.5-3.5.06-1.24.07-1.6.07-4.5s-.01-3.26-.07-4.5c-.1-2.26-1.24-3.4-3.5-3.5C15.5 4.01 15.14 4 12 4zm0 3.8a4.2 4.2 0 110 8.4 4.2 4.2 0 010-8.4zm0 1.8a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm5.3-2a1 1 0 110 2 1 1 0 010-2z" />
                </svg>
              </a>
              <a href={FB_URL} target="_blank" rel="noreferrer" aria-label="Facebook" className={iconBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.56V4.46C16.2 4.4 15.28 4.32 14.2 4.32c-2.24 0-3.77 1.37-3.77 3.87v2.25H7.87v2.96h2.56V21h3.07z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 sm:col-span-2 lg:col-span-1">
          <iframe
            title="SERV Pickleball Club location"
            src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`}
            width="100%"
            height="220"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-6 sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <img src={logoUrl} alt="SERV Pickleball Club" className="h-9" />
          <p className="text-xs text-court-light/80">
             © {new Date().getFullYear()} SERV Pickleball Club.
          </p>
        </div>
      </div>
    </footer>
  )
}
