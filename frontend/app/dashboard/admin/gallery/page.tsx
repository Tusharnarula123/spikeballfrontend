'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading } from '@/components/ui/dashboard-shell';
import { ImageIcon, Plus, Trash2, Loader2, Upload } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

interface GalleryImage {
  id: string;
  url: string;
  alt_text: string;
  display_order: number;
  created_at: string;
}

export default function AdminGalleryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    loadImages();
  }, [isLoaded, authLoaded, isAdmin]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/gallery');
      if (res.ok) setImages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) { setError('Please select an image first'); return; }
    setError(null);
    setSuccessMsg(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('altText', altText.trim() || selectedFile.name);

      const res = await fetchApi('/api/gallery', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return; }

      setSuccessMsg('Image uploaded successfully!');
      setSelectedFile(null);
      setPreview(null);
      setAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadImages();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetchApi(`/api/gallery/${id}`, { method: 'DELETE' });
      setImages(prev => prev.filter(img => img.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoaded && !isAdmin) return null;

  return (
    <DashboardShell
      title="Gallery Management"
      subtitle="Upload photos to the homepage gallery. Images are stored on Cloudinary."
      loading={!isLoaded || loading}
      width="wide"
    >
      {/* ── Upload Section ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <SectionHeading icon={<Upload />} title="Upload Image" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* File picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Image File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#FFB81C] transition-colors"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm">Click to select an image</span>
                  <span className="text-xs">JPG, PNG, WebP</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Alt text + upload button */}
          <div className="flex flex-col justify-between gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Caption / Alt Text
              </label>
              <input
                type="text"
                value={altText}
                onChange={e => setAltText(e.target.value)}
                placeholder="e.g. Team photo at spring tournament"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Shown as image description. Leave blank to use filename.</p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}

            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload to Gallery'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Current Gallery ── */}
      <section>
        <SectionHeading icon={<ImageIcon />} title={`Gallery (${images.length} image${images.length !== 1 ? 's' : ''})`} />

        {images.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <ImageIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No images yet — upload one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map(img => (
              <div key={img.id} className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <img
                  src={img.url}
                  alt={img.alt_text}
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="p-3">
                  <p className="text-xs text-gray-500 truncate">{img.alt_text || '—'}</p>
                </div>
                <button
                  onClick={() => handleDelete(img.id)}
                  disabled={deletingId === img.id}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                >
                  {deletingId === img.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
