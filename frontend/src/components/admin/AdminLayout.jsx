import AdminSidebar from './AdminSidebar.jsx'
import AdminHeader from './AdminHeader.jsx'

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen flex bg-mist">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminHeader title={title} />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
