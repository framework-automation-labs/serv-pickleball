import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Booking from './pages/Booking.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Checkout from './pages/Checkout.jsx'
import Details from './pages/Details.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Booking />} />
      <Route path="/details" element={<Details />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/confirmation/:bookingId" element={<Confirmation />} />
    </Routes>
  )
}
