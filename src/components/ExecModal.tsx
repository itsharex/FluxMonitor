"use client";

import { useState, useRef, useEffect } from "react";
import { X, Play, Square, Sparkles, Brain } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useSettings } from "@/lib/SettingsContext";
import { streamAiContent } from "@/lib/aiStream";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface ExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  command: string;
}

export default function ExecModal({ isOpen, onClose, command }: ExecModalProps) {
  const { t } = useLanguage();
  const { config } = useSettings();
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const aiCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  useEffect(() => {
    if (isOpen && command) {
      setResult("");
      setError("");
      handleExec();
    }
    // eslint-disable-next-line
  }, [isOpen, command]);

  const handleExec = async () => {
    setIsExecuting(true);
    setResult("");
    setError("");
    setAnalysisResult("");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const response = await fetch("/api/system/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });
      if (!response.body) {
        setIsExecuting(false);
        setError(t.common.error);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value);
          setResult((prev) => prev + chunk);
        }
      }
      reader.releaseLock();
    } catch (e: unknown) {
      if (typeof e === 'object' && e && 'name' in e && (e as { name?: string }).name !== 'AbortError') {
        const message = typeof e === 'object' && e && 'message' in e && typeof (e as { message?: unknown }).message === 'string'
          ? (e as { message: string }).message
          : "";
        setError(t.common.networkError + (message ? `: ${message}` : ""));
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  };

  const stopExec = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExecuting(false);
  };

  const analyzeOutput = async () => {
    if (!result) return;
    if (analysisResult) {
      setAnalysisResult('');
      return;
    }
    if (aiCacheRef.current[result]) {
      setAnalysisResult(aiCacheRef.current[result]);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(`${t.common.analyzing}... 🪄`);
    
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    
    streamAiContent(
      {
        prompt: t.monitor.aiAnalyzeOutputPrompt
          .replace('{lang}', t.common.aiResponseLang)
          .replace('{output}', result.length > 30000 ? `... [TRUNCATED] ...\n${result.slice(-30000)}` : result),
        systemPrompt: 'You are an expert system administrator.',
        config: config?.ai,
        signal: controller.signal
      },
      (chunk) => {
        setAnalysisResult(chunk);
      },
      () => {
        setIsAnalyzing(false);
        aiCacheRef.current[result] = analysisResult; // simple cache
      },
      (errStr) => {
        if (errStr === 'AI_CONFIG_MISSING') {
          setAnalysisResult(`${t.common.errors.aiConfigMissing}: ${t.common.errors.aiConfigMissingDetail}`);
        } else {
          setAnalysisResult(`${t.monitor.aiAnalyzeFailed || t.common.error}: ${errStr}`);
        }
        setIsAnalyzing(false);
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "700px",
          minHeight: "320px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 40px 100px -20px var(--color-shadow)",
          position: "relative",
          border: "1px solid var(--color-surface-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex-between"
          style={{
            padding: "0.75rem 1.25rem",
            background: "var(--color-surface-bg)",
            borderBottom: "1px solid var(--color-surface-border)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "1rem" }}>
            {t.docker.title + " - " + (t.docker.exec || "")}
          </span>
          <button className="btn btn-ghost" onClick={onClose} style={{ width: 32, height: 32, padding: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "1rem", flex: 1, overflow: "auto", background: "var(--color-bg)" }}>
          <div style={{ marginBottom: "0.5rem", fontFamily: "monospace", color: "var(--color-primary)" }}>
            $ {command}
          </div>
          <div
            ref={resultRef}
            style={{
              position: 'relative',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              background: 'var(--color-surface-bg)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-surface-border)',
              padding: '1rem',
              minHeight: '120px',
              maxHeight: '300px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {result || (isExecuting ? t.common.loading + '...' : t.common.none || '')}
            {result && (
              <button
                onClick={analyzeOutput}
                disabled={isAnalyzing}
                style={{
                  position: 'absolute',
                  right: '1.25rem',
                  bottom: '1.25rem',
                  background: 'rgba(59, 130, 246, 0.9)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59, 130, 246, 0.9)'}
              >
                <Sparkles size={14} className={isAnalyzing ? 'animate-pulse' : ''} /> 
                {isAnalyzing ? t.common.analyzing : t.monitor.aiAnalyzeBtn}
              </button>
            )}
          </div>
          {error && <div style={{ color: 'var(--color-danger)', marginTop: '0.5rem' }}>{error}</div>}

          {/* AI Advice */}
          {(analysisResult || isAnalyzing) && (
            <div 
              className="ai-output-block animate-fade-in" 
              style={{ 
                background: 'rgba(59, 130, 246, 0.03)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid rgba(59, 130, 246, 0.12)', 
                display: 'flex', 
                flexDirection: 'column',
                maxHeight: '30%',
                marginTop: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', color: 'var(--color-primary)', background: 'rgba(239, 246, 255, 0.8)', borderBottom: '1px solid rgba(59, 130, 246, 0.08)' }}>
                <Brain size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t.monitor.aiAdvice}</span>
                {isAnalyzing && <span className="text-xs animate-pulse opacity-60 ml-2" style={{ fontStyle: 'italic' }}>{t.common.analyzing}...</span>}
                <button onClick={() => {
                  aiAbortControllerRef.current?.abort();
                  setAnalysisResult('');
                  setIsAnalyzing(false);
                }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.6, padding: '1rem', overflowY: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult || (isAnalyzing ? t.common.analyzing : '...')}</ReactMarkdown>
                {analysisResult && analysisResult.includes(t.common.errors.aiConfigMissing) && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <Link href="/dashboard/settings" className="btn btn-primary btn-sm" onClick={onClose}>{t.common.goToSettings}</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-surface-border)' }}>
          {isExecuting ? (
            <button className="btn btn-danger" onClick={stopExec}>
              <Square size={16} style={{ marginRight: 6 }} /> {t.common.stop}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleExec}>
              <Play size={16} style={{ marginRight: 6 }} /> {t.common.run}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>{t.common.close}</button>
        </div>
      </div>
    </div>
  );
}
