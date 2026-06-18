"use client";

import { useLanguage } from '@/lib/LanguageContext';
import { X, Mail, Download } from 'lucide-react';
import Image from 'next/image';

interface AppGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppGuide({ isOpen, onClose }: AppGuideProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="ios-guide-overlay animate-fade-in" onClick={onClose}>
      <div className="ios-guide-modal glass-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <button className="dismiss-btn" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className="modal-header">
          <h3>{t.client?.title}</h3>
          <p className="desc">{t.client?.desc}</p>
        </div>

        <div className="modal-content">
          <div className="platform-column ios-column">
            <span className="platform-label">iOS</span>
            <div className="qr-section">
              <div className="qr-container">
                <Image 
                  src="/ios_qrcode.png" 
                  alt={t.client?.scanToRemote || 'Scan QR Code'} 
                  width={140} 
                  height={140} 
                  className="qr-image" 
                />
                <div className="qr-glow"></div>
              </div>
              <p className="qr-text">{t.client?.scanToRemote}</p>
            </div>
            <a 
              href="https://apps.apple.com/app/flux-remote/id6761290185" 
              target="_blank" 
              rel="noopener noreferrer"
              className="store-btn"
            >
              <Image 
                src={t.client?.appStoreBadge || '/app-store-badge-zh.svg'} 
                alt="App Store" 
                width={132}
                height={44}
              />
            </a>
          </div>
          
          <div className="divider"></div>
          
          <div className="platform-column android-column">
            <span className="platform-label">Android</span>
            <div className="qr-section">
              <div className="qr-container">
                <Image 
                  src="/android_qrcode.png" 
                  alt={t.client?.scanToRemote || 'Scan QR Code'} 
                  width={140} 
                  height={140} 
                  className="qr-image" 
                />
                <div className="qr-glow"></div>
              </div>
              <p className="qr-text">{t.client?.scanToRemote}</p>
            </div>
            <a 
              href="https://play.google.com/store/apps/details?id=com.ct106.flux_remote" 
              target="_blank" 
              rel="noopener noreferrer"
              className="store-btn"
            >
              <Image 
                src="/en-play-badge.png" 
                alt="Google Play" 
                width={147}
                height={44}
                style={{ objectFit: 'contain' }}
              />
            </a>
          </div>
        </div>

        <button className="btn btn-ghost btn-block dismiss-action-btn" onClick={onClose}>
          {t.client?.dismiss}
        </button>
      </div>

      <style jsx>{`
        .ios-guide-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        
        .ios-guide-modal {
          width: 100%;
          max-width: 650px;
          position: relative;
          padding: 2.5rem;
          border-radius: 1.5rem;
        }
        
        .dismiss-btn {
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 50%;
          transition: all 0.2s;
          z-index: 10;
        }
        
        .dismiss-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: var(--color-text);
          transform: scale(1.1);
        }

        .modal-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .modal-header h3 {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--color-text) 0%, var(--color-text-muted) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .desc {
          color: var(--color-text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
        }
        
        .modal-content {
          display: flex;
          gap: 2rem;
          align-items: stretch;
          margin-bottom: 2rem;
        }
        
        @media (max-width: 640px) {
          .modal-content {
            flex-direction: column;
            gap: 2rem;
          }
          .divider {
            height: 1px !important;
            width: 100% !important;
          }
        }
        
        .platform-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.5rem;
        }
        
        .divider {
          width: 1px;
          background: rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }
        
        .platform-label {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .qr-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        
        .qr-container {
          position: relative;
          width: 140px;
          height: 140px;
        }
        
        .qr-image {
          width: 100%;
          height: 100%;
          border-radius: 1rem;
          position: relative;
          z-index: 2;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .qr-glow {
          position: absolute;
          inset: -15px;
          background: radial-gradient(circle, var(--color-primary) 0%, transparent 70%);
          opacity: 0.3;
          z-index: 1;
          filter: blur(12px);
        }
        
        .qr-text {
          font-size: 0.9rem;
          color: var(--color-text-muted);
          font-weight: 500;
          margin: 0;
        }

        .store-btn {
          display: inline-block;
          transition: transform 0.2s;
        }
        
        .store-btn:hover {
          transform: translateY(-2px);
        }

        .badge {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          font-size: 0.7rem;
          padding: 0.15rem 0.5rem;
          border-radius: 1rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        
        .android-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          align-items: center;
          justify-content: center;
          flex: 1;
        }
        
        .alpha-notice {
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin: 0;
          opacity: 0.8;
          text-align: center;
        }
        
        .android-steps {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          max-width: 240px;
        }
        
        .step-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          width: 100%;
        }
        
        .step-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        
        .dismiss-action-btn {
          width: 100%;
          justify-content: center;
          padding: 0.8rem !important;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: var(--color-text);
          border-radius: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 1rem;
        }
        
        .dismiss-action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
