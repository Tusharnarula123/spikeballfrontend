'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading } from '@/components/ui/dashboard-shell';
import { FileText, BarChart3, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

interface AboutStat {
  value: string;
  label: string;
}

interface AboutContent {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  stats: AboutStat[];
}

export default function AdminAboutPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [eyebrow, setEyebrow] = useState('');
  const [heading, setHeading] = useState('');
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [stats, setStats] = useState<AboutStat[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    loadContent();
  }, [isLoaded, authLoaded, isAdmin]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/about');
      if (res.ok) {
        const data: AboutContent = await res.json();
        setEyebrow(data.eyebrow ?? '');
        setHeading(data.heading ?? '');
        setParagraphs(Array.isArray(data.paragraphs) ? data.paragraphs : []);
        setStats(Array.isArray(data.stats) ? data.stats : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateParagraph = (i: number, value: string) => {
    setParagraphs(prev => prev.map((p, idx) => (idx === i ? value : p)));
  };
  const addParagraph = () => setParagraphs(prev => [...prev, '']);
  const removeParagraph = (i: number) => setParagraphs(prev => prev.filter((_, idx) => idx !== i));

  const updateStat = (i: number, field: keyof AboutStat, value: string) => {
    setStats(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };
  const addStat = () => setStats(prev => [...prev, { value: '', label: '' }]);
  const removeStat = (i: number) => setStats(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setError(null);
    setSaved(false);

    const cleanParagraphs = paragraphs.map(p => p.trim()).filter(Boolean);
    const cleanStats = stats
      .map(s => ({ value: s.value.trim(), label: s.label.trim() }))
      .filter(s => s.value && s.label);

    if (!eyebrow.trim()) { setError('Eyebrow text cannot be empty.'); return; }
    if (!heading.trim()) { setError('Heading cannot be empty.'); return; }
    if (cleanParagraphs.length === 0) { setError('Add at least one paragraph.'); return; }
    if (cleanStats.length === 0) { setError('Add at least one stat.'); return; }

    setSaving(true);
    try {
      const res = await fetchApi('/api/about', {
        method: 'PATCH',
        body: JSON.stringify({
          eyebrow: eyebrow.trim(),
          heading: heading.trim(),
          paragraphs: cleanParagraphs,
          stats: cleanStats,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }

      setParagraphs(cleanParagraphs);
      setStats(cleanStats);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoaded && !isAdmin) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all';

  return (
    <DashboardShell
      title="About Page"
      subtitle="Edit the “About Us” section shown on the public homepage."
      loading={!isLoaded || loading}
      width="wide"
    >
      {/* ── Heading / Eyebrow ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <SectionHeading icon={<FileText />} title="Section Heading" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Eyebrow Text
            </label>
            <input
              type="text"
              value={eyebrow}
              onChange={e => setEyebrow(e.target.value)}
              placeholder="e.g. Who We Are"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Heading
            </label>
            <input
              type="text"
              value={heading}
              onChange={e => setHeading(e.target.value)}
              placeholder="e.g. About Us"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* ── Paragraphs ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <SectionHeading icon={<FileText />} title={`Paragraphs (${paragraphs.length})`} />
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <div key={i} className="flex gap-2 items-start">
              <textarea
                value={p}
                onChange={e => updateParagraph(i, e.target.value)}
                rows={3}
                className={`${inputCls} resize-none flex-1`}
                placeholder={`Paragraph ${i + 1}`}
              />
              <button
                onClick={() => removeParagraph(i)}
                title="Remove paragraph"
                className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addParagraph}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#0a0a0a] hover:text-[#c98a00] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Paragraph
        </button>
      </section>

      {/* ── Stats ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <SectionHeading icon={<BarChart3 />} title={`Stats (${stats.length})`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="flex gap-2 items-center border border-gray-100 rounded-xl p-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={s.value}
                  onChange={e => updateStat(i, 'value', e.target.value)}
                  placeholder="Value (e.g. 40+)"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={s.label}
                  onChange={e => updateStat(i, 'label', e.target.value)}
                  placeholder="Label (e.g. Members)"
                  className={inputCls}
                />
              </div>
              <button
                onClick={() => removeStat(i)}
                title="Remove stat"
                className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addStat}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#0a0a0a] hover:text-[#c98a00] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Stat
        </button>
      </section>

      {/* ── Save ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        {saved && (
          <p className="text-xs text-green-600 mb-3 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved! Changes are now live on the homepage.
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </section>
    </DashboardShell>
  );
}
