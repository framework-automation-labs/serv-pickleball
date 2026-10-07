import { useEffect, useRef, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout.jsx'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'

const emptyForm = { productName: '', caption: '', price: '', availability: 'in_stock' }

function AvailabilityBadge({ availability }) {
  if (!availability) return null
  const isPreOrder = availability === 'pre_order'
  return (
    <span
      className={`absolute top-2 left-2 text-xs font-semibold rounded-full px-2 py-0.5 ${
        isPreOrder ? 'bg-amber-500 text-white' : 'bg-court text-white'
      }`}
    >
      {isPreOrder ? 'Pre-Order' : 'In Stock'}
    </span>
  )
}

export default function ManageGallery() {
  const { session } = useAdminAuth()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload form
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Edit state — editing an existing item's text fields (no re-upload)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deletingId, setDeletingId] = useState(null)

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

    // Extension comes from the file's real MIME type, never its name
    // (a name like "x.html" or "x.svg" must not end up in a public bucket).
    const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
    const ext = EXT_BY_TYPE[file.type]
    if (!ext) {
      setError('Please choose a JPG, PNG, WebP, or GIF image.')
      setUploading(false)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large (max 5MB).')
      setUploading(false)
      return
    }
    if (form.price !== '' && !(Number(form.price) >= 0 && Number(form.price) < 1000000)) {
      setError('Please enter a valid price.')
      setUploading(false)
      return
    }
    const path = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('gallery').upload(path, file)

    if (uploadError) {
      setError(`Could not upload image: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('gallery').getPublicUrl(path)
    const hasPrice = form.price !== ''

    const { error: insertError } = await supabase.from('gallery_images').insert({
      image_url: publicUrlData.publicUrl,
      storage_path: path,
      caption: form.caption || null,
      product_name: hasPrice ? form.productName || null : null,
      price: hasPrice ? Number(form.price) : null,
      availability: hasPrice ? form.availability : null,
      created_by: session?.user?.id,
    })

    setUploading(false)

    if (insertError) {
      setError(`Image uploaded, but could not save it: ${insertError.message}`)
      return
    }

    setForm(emptyForm)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadImages()
  }

  function startEdit(image) {
    setEditingId(image.id)
    setEditForm({
      productName: image.product_name || '',
      caption: image.caption || '',
      price: image.price != null ? String(image.price) : '',
      availability: image.availability || 'in_stock',
    })
  }

  async function saveEdit(imageId) {
    setSavingEdit(true)
    setError('')
    const hasPrice = editForm.price !== ''

    const { error: updateError } = await supabase
      .from('gallery_images')
      .update({
        caption: editForm.caption || null,
        product_name: hasPrice ? editForm.productName || null : null,
        price: hasPrice ? Number(editForm.price) : null,
        availability: hasPrice ? editForm.availability : null,
      })
      .eq('id', imageId)

    setSavingEdit(false)

    if (updateError) {
      setError(`Could not save changes: ${updateError.message}`)
      return
    }

    setEditingId(null)
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
        className="bg-white rounded-2xl border border-line px-4 py-5 sm:px-6 sm:py-6 mb-6 space-y-4"
      >
        <div className="flex flex-wrap items-end gap-4">
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
            <label className="block text-xs font-medium text-ink/50 mb-1">Caption / Description</label>
            <input
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              placeholder="Saturday morning open play, or a product description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/50 mb-1">Price (₱, optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-32 rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              placeholder="For sale?"
            />
          </div>
        </div>

        {form.price !== '' && (
          <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-line">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-ink/50 mb-1">Product Name</label>
              <input
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
                placeholder="SERV Jersey V2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/50 mb-1">Availability</label>
              <select
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
                className="rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-court"
              >
                <option value="in_stock">For Sale (in stock)</option>
                <option value="pre_order">Pre-Order</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-lg bg-spark text-white text-sm font-medium px-4 py-2 hover:bg-spark/90 transition-colors disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <p className="text-xs text-ink/50 mb-4">
        Add a price to make a photo show up as an item for sale in the "Club Gear" section on the homepage — leave
        it blank for a regular gallery photo.
      </p>

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
              <div className="relative">
                <img src={image.image_url} alt={image.caption ?? ''} className="w-full h-36 object-cover" />
                <AvailabilityBadge availability={image.availability} />
                {image.price != null && (
                  <span className="absolute top-2 right-2 bg-spark text-white text-xs font-semibold rounded-full px-2 py-0.5">
                    ₱{Number(image.price).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="px-3 py-2">
                {editingId === image.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.caption}
                      onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                      placeholder="Caption / description"
                      className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-court"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      placeholder="Price (₱, optional)"
                      className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-court"
                    />
                    {editForm.price !== '' && (
                      <>
                        <input
                          value={editForm.productName}
                          onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                          placeholder="Product name"
                          className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-court"
                        />
                        <select
                          value={editForm.availability}
                          onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })}
                          className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-court"
                        >
                          <option value="in_stock">For Sale (in stock)</option>
                          <option value="pre_order">Pre-Order</option>
                        </select>
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg border border-line text-ink/70 text-xs font-medium px-2 py-1.5 hover:bg-mist transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(image.id)}
                        disabled={savingEdit}
                        className="flex-1 rounded-lg bg-spark text-white text-xs font-medium px-2 py-1.5 hover:bg-spark/90 transition-colors disabled:opacity-60"
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {image.product_name && <p className="text-xs text-ink font-medium">{image.product_name}</p>}
                    {image.caption && <p className="text-xs text-ink/70 mb-2 line-clamp-2">{image.caption}</p>}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => startEdit(image)}
                        className="flex-1 rounded-lg border border-line text-ink/70 text-xs font-medium px-3 py-1.5 hover:bg-mist transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteImage(image)}
                        disabled={deletingId === image.id}
                        className="flex-1 rounded-lg border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === image.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
