'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, Eye, EyeOff, KeyRound, Loader2, Mail, RefreshCw, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/app/contexts/AuthContext';
import type { AccountProfile } from '@/lib/accountProfile';
import { prepareAvatar } from './avatar';
import './profile.css';

type ProfileForm = { displayName: string; email: string; phone: string; bio: string; avatarDataUrl: string | null };
const formFor = (profile: AccountProfile): ProfileForm => ({ displayName: profile.displayName, email: profile.email || '', phone: profile.phone, bio: profile.bio, avatarDataUrl: profile.avatarDataUrl });
const dateText = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(value));

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  return data as T;
}

function PasswordField({ label, value, onChange, autoComplete, minLength }: { label: string; value: string; onChange: (value: string) => void; autoComplete: 'current-password' | 'new-password'; minLength?: number }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="profile-field"><label htmlFor={id}>{label}</label><div className="profile-password-field">
    <input id={id} className="profile-input" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required minLength={minLength}/>
    <button type="button" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(previous => !previous)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
  </div></div>;
}

export default function ProfileClient() {
  const { user } = useAuth();
  return <ProfileSettings key={user?.id || 'loading'}/>;
}

function ProfileSettings() {
  const { token, user, updateProfile } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const avatarTask = useRef({ id: 0 });

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const avatarJobs = avatarTask.current;
    fetch('/api/account/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
      .then(response => readResponse<AccountProfile>(response))
      .then(data => { if (!controller.signal.aborted) { setProfile(data); setForm(formFor(data)); updateProfile(data); setLoading(false); } })
      .catch(error => { if (!controller.signal.aborted) { setLoadError(error instanceof Error ? error.message : 'Không thể tải hồ sơ.'); setLoading(false); } });
    return () => { controller.abort(); avatarJobs.id++; };
  }, [token, revision, updateProfile]);

  const dirty = !!profile && !!form && JSON.stringify(form) !== JSON.stringify(formFor(profile));
  const emailChanged = !!form && form.email.trim().toLowerCase() !== (profile?.email || '');
  const busy = saving || changingPassword || processingAvatar;

  async function chooseAvatar(file?: File) {
    if (!file) return;
    const task = ++avatarTask.current.id;
    setProcessingAvatar(true); setProfileError(''); setProfileMessage('');
    try {
      const avatarDataUrl = await prepareAvatar(file);
      if (avatarTask.current.id === task) setForm(previous => previous ? { ...previous, avatarDataUrl } : previous);
    } catch (error) { if (avatarTask.current.id === task) setProfileError(error instanceof Error ? error.message : 'Không thể xử lý ảnh.'); }
    finally { if (avatarTask.current.id === task) setProcessingAvatar(false); }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setSaving(true); setProfileError(''); setProfileMessage('');
    try {
      const { email, ...details } = form;
      const data = await readResponse<AccountProfile>(await fetch('/api/account/profile', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, ...(emailChanged ? { email, currentPassword: emailPassword } : {}) }),
      }));
      setProfile(data); setForm(formFor(data)); updateProfile(data); setEmailPassword(''); setProfileMessage('Đã lưu hồ sơ cá nhân.');
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.'); }
    finally { setSaving(false); }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setPasswordError(''); setPasswordMessage('');
    if (passwords.newPassword !== passwords.confirmPassword) { setPasswordError('Mật khẩu xác nhận không khớp.'); return; }
    if (new TextEncoder().encode(passwords.newPassword).length > 72) { setPasswordError('Mật khẩu mới tối đa 72 byte. Hãy giảm số ký tự có dấu hoặc emoji.'); return; }
    setChangingPassword(true);
    try {
      const data = await readResponse<{ detail: string; passwordChangedAt: string }>(await fetch('/api/account/password', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(passwords),
      }));
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); setEmailPassword('');
      setPasswordMessage(data.detail); setProfile(previous => previous ? { ...previous, passwordChangedAt: data.passwordChangedAt } : previous);
    } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.'); }
    finally { setChangingPassword(false); }
  }

  return <div className="business-shell min-h-screen p-3 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:flex md:p-6 md:pt-6">
    <Sidebar/>
    <main className="business-main account-profile min-w-0 flex-1">
      <div className="business-content profile-content mx-auto max-w-5xl">
        <header className="profile-heading"><div><p className="profile-eyebrow"><UserRound size={16}/> Tài khoản của bạn</p><h1>Hồ sơ cá nhân</h1><p>Thông tin của bạn, theo cách của bạn.</p></div>{user?.role === 'admin' && <Link href="/admin/registration-codes" className="profile-secondary-link"><ShieldCheck size={17}/> Trang quản trị</Link>}</header>
        {loading ? <div className="profile-panel profile-loading" role="status"><Loader2 className="animate-spin" size={24}/> Đang tải hồ sơ...</div> : loadError ? <div className="profile-panel profile-loading"><p role="alert">{loadError}</p><button type="button" className="btn-push" onClick={() => { setLoadError(''); setLoading(true); setRevision(value => value + 1); }}><RefreshCw size={16}/> Thử lại</button></div> : profile && form && <div className="profile-layout">
          <aside className="profile-summary profile-panel">
            <UserAvatar name={form.displayName || profile.username} src={form.avatarDataUrl} size={112}/>
            <h2>{form.displayName.trim() || profile.username}</h2><p className="profile-handle">@{profile.username}</p>
            <span className="profile-role"><ShieldCheck size={15}/>{profile.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</span>
            <dl><div><dt>Tham gia từ</dt><dd>{dateText(profile.createdAt)}</dd></div><div><dt>Mật khẩu cập nhật</dt><dd>{profile.passwordChangedAt ? dateText(profile.passwordChangedAt) : 'Chưa ghi nhận thay đổi'}</dd></div></dl>
            <p className="profile-private-note">Thông tin hồ sơ chỉ hiển thị trong tài khoản của bạn.</p>
          </aside>
          <div className="profile-forms">
            <form className="profile-panel" onSubmit={saveProfile}>
              <div className="profile-section-heading"><span><UserRound size={20}/></span><div><h2>Thông tin cá nhân</h2><p>Ảnh đại diện và thông tin liên hệ.</p></div></div>
              <fieldset disabled={busy}>
                <div className="profile-avatar-actions"><input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Chọn ảnh đại diện" onChange={event => { void chooseAvatar(event.target.files?.[0]); event.target.value = ''; }}/><button type="button" className="btn-push" onClick={() => uploadInput.current?.click()}>{processingAvatar ? <Loader2 size={16} className="animate-spin"/> : <Camera size={16}/>} Đổi ảnh</button>{form.avatarDataUrl && <button type="button" className="profile-text-button" onClick={() => { setForm({ ...form, avatarDataUrl: null }); setProfileMessage(''); }}><Trash2 size={15}/> Xóa ảnh</button>}<p>JPG, PNG, WebP · Tối đa 5 MB. Ảnh được cắt vuông ở giữa.</p></div>
                <div className="profile-field-grid"><div className="profile-field"><label htmlFor="profile-display-name">Tên hiển thị</label><input id="profile-display-name" type="text" className="profile-input" value={form.displayName} autoComplete="name" maxLength={80} placeholder={profile.username} onChange={event => { setForm({ ...form, displayName: event.target.value }); setProfileMessage(''); }}/></div><div className="profile-field"><label htmlFor="profile-username">Tên đăng nhập</label><input id="profile-username" type="text" className="profile-input" value={profile.username} autoComplete="username" readOnly/><small>Tên đăng nhập được giữ cố định.</small></div></div>
                <div className="profile-field-grid"><div className="profile-field"><label htmlFor="profile-email">Email</label><input id="profile-email" type="email" className="profile-input" value={form.email} autoComplete="email" maxLength={254} required={emailChanged} onChange={event => { setForm({ ...form, email: event.target.value }); setProfileMessage(''); }}/></div><div className="profile-field"><label htmlFor="profile-phone">Số điện thoại <small>(tùy chọn)</small></label><input id="profile-phone" type="tel" className="profile-input" value={form.phone} autoComplete="tel" maxLength={30} placeholder="Nhập số điện thoại" onChange={event => { setForm({ ...form, phone: event.target.value }); setProfileMessage(''); }}/></div></div>
                <div className="profile-field"><label htmlFor="profile-bio">Giới thiệu ngắn <small>(tùy chọn)</small></label><textarea id="profile-bio" className="profile-input" value={form.bio} maxLength={300} rows={3} placeholder="Một vài điều về bạn..." onChange={event => { setForm({ ...form, bio: event.target.value }); setProfileMessage(''); }}/><small className="profile-character-count">{form.bio.length}/300</small></div>
                {emailChanged && <div className="profile-email-confirmation"><p><Mail size={16}/> Xác nhận mật khẩu để lưu email mới.</p><PasswordField label="Mật khẩu xác nhận đổi email" value={emailPassword} onChange={setEmailPassword} autoComplete="current-password"/></div>}
                <div className="profile-form-footer"><span>{dirty ? 'Bạn có thay đổi chưa lưu.' : 'Không có thay đổi chưa lưu.'}</span><div><button type="button" className="profile-text-button" disabled={!dirty} onClick={() => { setForm(formFor(profile)); setEmailPassword(''); setProfileError(''); setProfileMessage(''); }}>Hủy thay đổi</button><button type="submit" className="btn-push-primary" disabled={!dirty}>{saving ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} Lưu hồ sơ</button></div></div>
              </fieldset>
              {profileError && <p className="profile-feedback profile-error" role="alert">{profileError}</p>}{profileMessage && <p className="profile-feedback" role="status"><Check size={16}/>{profileMessage}</p>}
            </form>
            <form className="profile-panel" onSubmit={savePassword}>
              <div className="profile-section-heading"><span><KeyRound size={20}/></span><div><h2>Mật khẩu & bảo mật</h2><p>Dùng mật khẩu riêng cho tài khoản này.</p></div></div>
              <fieldset disabled={busy}>
                <PasswordField label="Mật khẩu hiện tại" value={passwords.currentPassword} onChange={value => { setPasswords({ ...passwords, currentPassword: value }); setPasswordMessage(''); }} autoComplete="current-password"/>
                <div className="profile-field-grid"><PasswordField label="Mật khẩu mới" value={passwords.newPassword} onChange={value => { setPasswords({ ...passwords, newPassword: value }); setPasswordMessage(''); }} autoComplete="new-password" minLength={8}/><PasswordField label="Nhập lại mật khẩu mới" value={passwords.confirmPassword} onChange={value => { setPasswords({ ...passwords, confirmPassword: value }); setPasswordMessage(''); }} autoComplete="new-password" minLength={8}/></div>
                <p className="profile-password-hint">Ít nhất 8 ký tự. Nên kết hợp chữ hoa, chữ thường, số và ký hiệu.</p>
                <div className="profile-form-footer"><span>Không chia sẻ mật khẩu với người khác.</span><button type="submit" className="btn-push-primary">{changingPassword ? <Loader2 size={17} className="animate-spin"/> : <KeyRound size={17}/>} Đổi mật khẩu</button></div>
              </fieldset>
              {passwordError && <p className="profile-feedback profile-error" role="alert">{passwordError}</p>}{passwordMessage && <p className="profile-feedback" role="status"><Check size={16}/>{passwordMessage}</p>}
            </form>
          </div>
        </div>}
      </div>
    </main>
  </div>;
}
