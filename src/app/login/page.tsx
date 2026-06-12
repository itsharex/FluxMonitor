"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, translations } from '@/lib/translations';
import { Globe } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const router = useRouter();
  const { language, setLanguage, t, systemLang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{version: string, hostname: string} | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch('/api/info')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSystemInfo(data.data);
        }
      })
      .catch(err => console.error('Failed to fetch system info:', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, autoLogin }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = '/dashboard';
      } else {
        let errorMsg = t.login.error;
        if (data.error === 'INVALID_CREDENTIALS') {
          errorMsg = t.login.invalidCredentials;
        } else if (data.error === 'INTERNAL_ERROR') {
          errorMsg = t.login.internalError;
        } else if (data.error) {
          errorMsg = data.error;
        }
        setError(errorMsg);
      }
    } catch (e: unknown) {
      setError(t.login.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem', position: 'relative' }} suppressHydrationWarning>
      <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10 }}>
        {mounted && (
          <>
            <Globe size={18} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Parameters<typeof setLanguage>[0])}
              className="input"
              style={{ padding: '0.3rem 1.5rem 0.3rem 0.6rem', fontSize: '0.85rem', height: 'auto', background: 'var(--color-surface-bg)', backdropFilter: 'blur(16px)', border: '1px solid var(--color-surface-border)', cursor: 'pointer' }}
            >
              <option value="auto">{translations[systemLang].common.systemDefault}</option>
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{LANGUAGE_NAMES[lang]}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }} suppressHydrationWarning>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }} suppressHydrationWarning>
          <div style={{
            width: '64px', height: '64px',
            margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center',
            justifyContent: 'center'
          }} suppressHydrationWarning>
            <img src="/logo.png" alt="Flux" style={{ width: '64px', height: '64px', borderRadius: '16px' }} />
          </div>
          <h1 className="card-title" style={{ fontSize: '2.5rem', marginBottom: '0.25rem', fontWeight: 900, letterSpacing: '0.1em' }} suppressHydrationWarning>{t.login.title}</h1>
          {t.login.logoText && <div style={{ fontSize: '1rem', color: 'var(--color-primary)', fontWeight: 600, letterSpacing: '0.6em', textIndent: '0.6em', marginBottom: '0.5rem', opacity: 0.8 }} suppressHydrationWarning>{t.login.logoText}</div>}
          
          {systemInfo && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-surface-bg)', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--color-surface-border)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                <Globe size={14} />
                <span>{systemInfo.hostname}</span>
              </div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.5 }}></div>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>v{systemInfo.version}</span>
            </div>
          )}

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: t.login.logoText ? '0' : '1.5rem' }} suppressHydrationWarning>{t.login.subtitle}</p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="grid" style={{ gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--color-text)' }}>{t.login.username}</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              suppressHydrationWarning
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--color-text)' }}>{t.login.password}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              suppressHydrationWarning
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '-0.5rem' }}>
            <input
              id="autoLogin"
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="autoLogin" style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              {t.login.autoLogin}
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', marginTop: '1rem', fontSize: '1.05rem' }}
            disabled={loading}
          >
            {loading ? t.login.submitting : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
