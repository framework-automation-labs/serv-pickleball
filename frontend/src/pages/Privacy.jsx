  import { useEffect } from 'react'
import BackButton from '../components/BackButton.jsx'
import Footer from '../components/Footer.jsx'

const assetUrl = (name) => `${import.meta.env.BASE_URL}${name}`
const UPDATED = 'October 28, 2026'

const sections = [
  {
    title: 'Information we collect',
    body: (
      <>
        <p>When you book a court, we collect only what we need to confirm and run your reservation:</p>
        <ul>
          <li>Your full name, mobile number and email address.</li>
          <li>Your booking details: court, date, time and amount paid.</li>
          <li>A screenshot of your GCash payment receipt, which you upload as proof of payment.</li>
        </ul>
        <p>We do not ask for passwords, card numbers or any account login to make a booking.</p>
      </>
    ),
  },
  {
    title: 'How we use it',
    body: (
      <ul>
        <li>To confirm your payment and reserve your court.</li>
        <li>To contact you about your booking, such as confirmations, changes or rescheduling.</li>
        <li>To keep records of bookings and payments, and to prevent fraud or double bookings.</li>
      </ul>
    ),
  },
  {
    title: 'Who can see it',
    body: (
      <>
        <p>
          Your details are visible only to SERV Pickleball Club staff who manage bookings. We do not sell or rent your
          personal information, and we do not use it for advertising.
        </p>
        <p>
          Your data is stored with our service providers that host the website, database and file storage. They only
          process it on our behalf to run the booking system. The public availability view shows which hours are taken, never
          who booked them.
        </p>
      </>
    ),
  },
  {
    title: 'How long we keep it',
    body: (
      <p>
        We keep booking and payment records for as long as needed to run the club, handle disputes and meet our
        accounting obligations. Payment receipts and contact details are not kept longer than necessary.
      </p>
    ),
  },
  {
    title: 'Cookies and local storage',
    body: (
      <p>
        We do not use advertising or tracking cookies. Your browser may store a small setting on your device, such as your
        light or dark theme choice.
      </p>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <>
        <p>
          Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to be informed about, access,
          correct, and object to the processing of your personal data, and to request its erasure or blocking where
          the law allows.
        </p>
        <p>
          To use any of these rights, contact us through our Facebook or Instagram page, or visit us at the club. Please
          note that confirmed bookings remain subject to our no-refund policy.
        </p>
      </>
    ),
  },
  {
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy from time to time. The latest version will always be on this page, with the date it was
        last updated.
      </p>
    ),
  },
  {
    title: 'Contact us',
    body: (
      <p>
        SERV Pickleball Club
        <br />
        K. Kangleon St., Mambajao, Maasin City, Southern Leyte, Philippines
      </p>
    ),
  },
]

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-mist">
      <div className="relative bg-court-dark px-6 py-8 sm:px-10">
        <BackButton variant="light" className="mb-4" to="/" />
        <img
          src={assetUrl('serv-logo.png')}
          alt="SERV Pickleball Club"
          className="absolute right-4 top-4 h-8 sm:right-8 sm:top-6 sm:h-10"
        />
        <h1 className="mb-1 font-display text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-court-light">Last updated {UPDATED}</p>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-8">
          <p className="mb-8 leading-relaxed text-ink/70">
            SERV Pickleball Club respects your privacy. This page explains what personal information we collect when you
            book a court on this website, why we collect it, and how we look after it.
          </p>
          <div className="space-y-8">
            {sections.map((s, i) => (
              <section key={s.title}>
                <h2 className="mb-3 font-display text-lg font-semibold text-heading">
                  {i + 1}. {s.title}
                </h2>
                <div className="space-y-3 text-sm leading-relaxed text-ink/70 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
