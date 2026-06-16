'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, Check, Loader2, User, GraduationCap, FileText } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

const BIO_MAX = 200;

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh anything it shows. */
  onSaved?: () => void;
}

/**
 * Edit Profile modal — first/last name (synced to Clerk + players table),
 * university, and bio. Loads fresh data every time it opens and auto-creates
 * the player record server-side if one doesn't exist yet.
 */
export function EditProfileModal({ open, onClose, onSaved }: EditProfileModalProps) {
  const { user } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [university, setUniversity] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load fresh values every time the modal opens
  useEffect(() => {
    if (!open || !authLoaded) return;
    setError(null);
    setSaved(false);
    setLoading(true);

    // Seed from Clerk immediately so the form is never blank…
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');

    // …then overlay whatever is stored in the players table.
    fetchApi('/api/players/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return; // no player row yet — server will create it on save
        if (data.first_name) setFirstName(data.first_name);
        if (typeof data.last_name === 'string') setLastName(data.last_name);
        setUniversity(data.university ?? '');
        setBio(data.bio ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, authLoaded, user, fetchApi]);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchApi('/api/players/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          university,
          bio,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to save profile');
        return;
      }
      // Refresh Clerk's cached user so the greeting/avatar update immediately
      await user?.reload().catch(() => {});
      setSaved(true);
      onSaved?.();
      setTimeout(onClose, 900);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const initials =
    `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'P';

  const inputCls =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all ' +
    'placeholder:text-gray-300 disabled:bg-gray-50';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#FFB81C] via-[#ffd166] to-transparent" />
          <h2 className="text-lg font-bold text-[#0a0a0a]">Edit Profile</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Live avatar preview from initials */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-[#0a0a0a] flex items-center justify-center shadow-lg shadow-[#FFB81C]/20 ring-4 ring-[#FFB81C]/20">
              <span className="text-[#FFB81C] font-black text-2xl">{initials}</span>
            </div>
            <p className="text-xs text-gray-400">Your avatar uses your initials</p>
          </div>

          {/* Name */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              <User className="w-3.5 h-3.5 text-[#FFB81C]" /> Name
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                disabled={loading}
                className={inputCls}
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                disabled={loading}
                className={inputCls}
              />
            </div>
          </div>

          {/* University */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              <GraduationCap className="w-3.5 h-3.5 text-[#FFB81C]" /> University / School
            </label>
            <input
              type="text"
              value={university}
              onChange={e => setUniversity(e.target.value)}
              placeholder="e.g. Oakland University"
              disabled={loading}
              className={inputCls}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 text-[#FFB81C]" /> Bio
                <span className="text-gray-300 normal-case font-normal">(optional)</span>
              </span>
              <span className={`text-[11px] ${bio.length > BIO_MAX ? 'text-red-500 font-semibold' : 'text-gray-300'}`}>
                {bio.length}/{BIO_MAX}
              </span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, BIO_MAX))}
              placeholder="Tell the club a bit about yourself…"
              rows={3}
              disabled={loading}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          {saved && (
            <p className="text-xs text-green-600 mb-3 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Profile saved!
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || saved}
              className="flex-1 px-4 py-2.5 bg-[#FFB81C] rounded-xl text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Check className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
