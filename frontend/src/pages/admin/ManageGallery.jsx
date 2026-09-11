import { useEffect, useRef, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'

export default function ManageGallery() {
  const { session } = useAdminAuth()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const fileInputRef = useRef(null)

  async function loadImages() {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError('Could not load gallery images.')
    } else {
      setImages(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadImages()
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage.from('gallery').upload(path, file)

    if (uploadError) {
      setError(`Could not upload image: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('gallery').getPublicUrl(path)

    const { error: insertError } = await supabase.from('gallery_images').insert({
      image_url: publicUrlData.publicUrl,
      storage_path: path,
      caption: caption || null,
      created_by: session?.user?.id,
    })

    setUploading(false)

    if (insertError) {
      setError(`Image uploaded, but could not save it: ${insertError.message}`)
      return
    }

    setCaption('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadImages()
  }

  async function deleteImage(image) {
    if (!window.confirm('Delete this photo? This can\'t be undone.')) return

    setDeletingId(image.id)
    setError('')

    const { error: storageError } = await supabase.storage.from('gallery').remove([image.storage_path])
    if (storageError) {
      setError(`Could not delete file: ${storageError.message}`)
      setDeletingId(null)
      return
    }

    const { error: deleteError } = await supabase.from('gallery_images').delete().eq('id', image.id)

    if (deleteError) {
      setError(`Could not delete image record: ${deleteError.message}`)
      setDeletingId(null)
    } else {
      setImages((prev) => prev.filter((i) => i.id !== image.id))
    }
  }

  return (
    <AdminLayout title="Gallery">
      <form
        onSubmit={handleUpload}
        className="bg-white rounded-2xl border border-line px-6 py-6 mb-6 flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-1">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-ink"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-ink/50 mb-1">Caption (optional)</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
            placeholder="Saturday morning open play"
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <p className="bg-white rounded-2xl border border-line px-6 py-10 text-center text-ink/50 text-sm">
          Loading gallery…
        </p>
      ) : images.length === 0 ? (
        <p className="bg-white rounded-2xl border border-line px-6 py-10 text-center text-ink/50 text-sm">
          No photos yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="bg-white rounded-2xl border border-line overflow-hidden">
              <img src={image.image_url} alt={image.caption ?? ''} className="w-full h-36 object-cover" />
              <div className="px-3 py-2">
                {image.caption && <p className="text-xs text-ink/70 mb-2 line-clamp-2">{image.caption}</p>}
                <button
                  onClick={() => deleteImage(image)}
                  disabled={deletingId === image.id}
                  className="w-full rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === image.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
