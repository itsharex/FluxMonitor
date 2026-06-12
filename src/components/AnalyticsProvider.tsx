"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { init, trackEvent } from '@aptabase/web';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';

interface AnalyticsContextType {
  enabled: boolean | null;
  setEnabled: (val: boolean) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aptabaseKey, setAptabaseKey] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const pathname = usePathname();

  useEffect(() => {
    // Fetch key from API
    fetch('/api/analytics')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.key) {
          setAptabaseKey(data.key);
          if (data.version) {
            setAppVersion(data.version);
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('analytics_enabled');
    if (stored !== null) {
      setTimeout(() => setEnabledState(stored === 'true'), 0);
    } else {
      // Delay prompt by 30 seconds to let user see the UI first
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (enabled && aptabaseKey) {
      // Force isDebug to false so events from localhost or dev aren't hidden
      init(aptabaseKey, { appVersion, isDebug: false });
      trackEvent('app_started');
    }
  }, [enabled, aptabaseKey, appVersion]);

  useEffect(() => {
    if (enabled && aptabaseKey && pathname) {
      trackEvent('page_view', { path: pathname });
    }
  }, [enabled, aptabaseKey, pathname]);

  const setEnabled = (val: boolean) => {
    setEnabledState(val);
    localStorage.setItem('analytics_enabled', val ? 'true' : 'false');
    setShowPrompt(false);
  };

  return (
    <AnalyticsContext.Provider value={{ enabled, setEnabled }}>
      {children}
      {showPrompt && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 10000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: '350px', padding: '1.25rem', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>
              {t.settings?.analyticsPromptTitle || 'Help Us Improve'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              {t.settings?.analyticsPromptDesc || 'We use anonymous statistics to improve Flux Monitor. Do you agree to share anonymous usage data? You can change this later in settings.'}
            </p>
            <div className="flex-between" style={{ gap: '1rem' }}>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1 }}
                onClick={() => setEnabled(false)}
              >
                {t.settings?.analyticsDecline || 'Decline'}
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => setEnabled(true)}
              >
                {t.settings?.analyticsAgree || 'Agree'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
