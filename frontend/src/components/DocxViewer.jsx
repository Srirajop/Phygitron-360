import React, { useEffect, useRef, useState } from 'react';
import * as docx from 'docx-preview';
import { FileText } from 'lucide-react';

export default function DocxViewer({ url }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    // Fetch the docx file as a blob
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch document');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        // docx.renderAsync renders the document into the container
        return docx.renderAsync(blob, containerRef.current, null, {
          className: 'docx-viewer-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#f3f4f6', borderRadius: 8 }}>
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="spinner spinner-lg" style={{ marginBottom: 16 }}></div>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Rendering Document...</p>
        </div>
      )}
      
      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--danger)' }}>
          <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p style={{ fontWeight: 700 }}>Preview failed</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 4 }}>{error}</p>
        </div>
      )}

      <div 
        ref={containerRef} 
        style={{ 
          display: loading || error ? 'none' : 'block',
          margin: '0 auto',
          maxWidth: '100%',
          padding: '20px 0'
        }} 
      />
    </div>
  );
}
