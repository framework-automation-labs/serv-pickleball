export default function Footer() {
  return (
    <footer className="bg-court-dark text-court-light px-6 py-12">
      <div className="max-w-5xl mx-auto grid gap-10 sm:grid-cols-3">
        <div>
          <p className="font-display font-bold text-2xl text-white mb-2">
            SE<span className="text-spark">.</span>RV
          </p>
          <p className="text-sm">Pickleball Club</p>
        </div>

        <div className="text-sm space-y-1">
          <p className="text-white font-semibold mb-1">Visit Us</p>
          <p>K. Kangleon St., Mambajao</p>
          <p>Maasin City, Southern Leyte</p>
          <p className="pt-2">9:00 AM – 12:00 Midnight, Daily</p>
        </div>

        <div>
          <p className="text-white font-semibold mb-3 text-sm">Follow Us</p>
          <div className="flex gap-3">
            <a
              href="https://instagram.com/servpickleballclub"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-spark hover:text-white flex items-center justify-center transition-colors"
              aria-label="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.2c3.2 0 3.6 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.25.07 1.63.07 4.81s-.01 3.56-.07 4.81c-.15 3.23-1.66 4.77-4.92 4.92-1.25.06-1.63.07-4.85.07s-3.6 0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.25-.07-1.63-.07-4.81s.01-3.56.07-4.81c.15-3.23 1.67-4.77 4.92-4.92C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.14 0-3.5.01-4.74.07-2.27.1-3.4 1.24-3.5 3.5-.06 1.24-.07 1.6-.07 4.5s.01 3.26.07 4.5c.1 2.26 1.23 3.4 3.5 3.5 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c2.26-.1 3.4-1.24 3.5-3.5.06-1.24.07-1.6.07-4.5s-.01-3.26-.07-4.5c-.1-2.26-1.24-3.4-3.5-3.5C15.5 4.01 15.14 4 12 4zm0 3.8a4.2 4.2 0 110 8.4 4.2 4.2 0 010-8.4zm0 1.8a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm5.3-2a1 1 0 110 2 1 1 0 010-2z" />
              </svg>
            </a>

            <a
              href="https://facebook.com/servpickleballclub"
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-spark hover:text-white flex items-center justify-center transition-colors"
              aria-label="Facebook"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.56V4.46C16.2 4.4 15.28 4.32 14.2 4.32c-2.24 0-3.77 1.37-3.77 3.87v2.25H7.87v2.96h2.56V21h3.07z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-court-light/50 mt-10">
        © {new Date().getFullYear()} SERV Pickleball Club. All rights reserved.
      </p>
    </footer>
  )
}