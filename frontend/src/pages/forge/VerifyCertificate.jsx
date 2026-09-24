import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { forgeApi } from '../../api';
import {
  ShieldCheck, Award, CheckCircle, Download, ExternalLink,
  AlertTriangle, Copy, ArrowLeft, Calendar, User, BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyCertificate() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('No certificate verification code provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    forgeApi.verifyCertificate(code)
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setCert(res.data.data);
        } else {
          setError(res.data?.error || 'Certificate not found or expired');
        }
      })
      .catch(err => {
        setError(err.response?.data?.detail || err.response?.data?.error || 'Unable to verify certificate. Please check the code.');
      })
      .finally(() => setLoading(false));
  }, [code]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Verification link copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1E1B4B 0%, #0F172A 70%, #020617 100%)',
      color: '#F8FAFC',
      padding: '40px 20px 80px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 900,
            fontSize: '1.1rem'
          }}>
            P3
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'white' }}>
            PHYGITRON <span style={{ color: '#A78BFA' }}>360</span>
          </span>
        </Link>
        <div style={{ fontSize: '0.82rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
          Enterprise Credential Verification Registry
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: 680, width: '100%' }}>
        {loading ? (
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 24,
            padding: 60,
            textAlign: 'center',
            backdropFilter: 'blur(12px)',
          }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 20px', borderColor: '#A78BFA', borderTopColor: 'transparent' }} />
            <h3 style={{ margin: 0, fontWeight: 700 }}>Verifying Credential...</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: 8 }}>
              Validating cryptographic verification code against Phygitron 360 LMS Registry
            </p>
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 24,
            padding: '48px 36px',
            textAlign: 'center',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.4rem', fontWeight: 800, color: '#F87171' }}>
              Verification Failed
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.5 }}>
              {error}
            </p>
            <div style={{
              display: 'inline-block',
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 16px',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              color: '#94A3B8',
              marginBottom: 28,
            }}>
              Code queried: {code}
            </div>
            <div>
              <Link to="/forge/transcript" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12 }}>
                <ArrowLeft size={16} /> Back to Learning Transcript
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 40px rgba(16, 185, 129, 0.15)',
            backdropFilter: 'blur(16px)',
          }}>
            {/* Top Status Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
              borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#10B981',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#34D399', letterSpacing: '0.02em' }}>
                    AUTHENTIC & VERIFIED CREDENTIAL
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    Phygitron 360 LMS Registry &bull; Verified Record
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34D399',
                padding: '4px 12px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: '0.75rem',
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}>
                ✓ ACTIVE
              </div>
            </div>

            {/* Certificate Details Body */}
            <div style={{ padding: '36px 32px' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Certificate of Completion
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                  {cert.course_title}
                </h1>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 16,
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                marginBottom: 28,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                    <User size={13} /> Issued To
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9' }}>
                    {cert.learner_name}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                    <Calendar size={13} /> Date of Issuance
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F1F5F9' }}>
                    {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                    <Award size={13} /> Verification Code
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(124, 58, 237, 0.1)',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    borderRadius: 10,
                    padding: '8px 14px',
                  }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.15rem', color: '#C4B5FD', letterSpacing: '0.1em' }}>
                      {cert.verification_code}
                    </span>
                    <button
                      onClick={copyLink}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copied ? '#34D399' : '#A78BFA',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                      }}
                    >
                      <Copy size={13} /> {copied ? 'Copied' : 'Share Link'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {cert.pdf_url && (
                  <a
                    href={cert.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      minWidth: 180,
                      justifyContent: 'center',
                      padding: '12px 20px',
                      borderRadius: 12,
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={16} /> Download Official PDF
                  </a>
                )}

                <Link
                  to="/forge/transcript"
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    minWidth: 180,
                    justifyContent: 'center',
                    padding: '12px 20px',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                  }}
                >
                  <BookOpen size={16} /> Learning Transcript
                </Link>
              </div>

              {/* Security Seal Note */}
              <div style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: '#64748B',
                lineHeight: 1.5,
              }}>
                This official credential was issued by Phygitron 360 LMS and is digitally verified by the central registry.
                The certificate recipient has satisfied all curriculum requirements, SCORM mastery benchmarks, and assessment criteria.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
