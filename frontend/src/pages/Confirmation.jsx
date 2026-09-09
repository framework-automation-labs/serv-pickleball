import { useParams } from 'react-router-dom'

export default function Confirmation() {
  const { bookingId } = useParams()
  // TODO: fetch booking details by id and show confirmed court/date/time
  return (
    <div className="min-h-screen bg-white px-6 py-10 text-center">
      <h1 className="text-2xl font-bold text-serv-dark mb-4">Booking Confirmed!</h1>
      <p className="text-gray-500">Booking reference: {bookingId}</p>
    </div>
  )
}