import AdminSidebar from './AdminSidebar.jsx'
import AdminHeader from './AdminHeader.jsx'

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-mist">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title={title} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
