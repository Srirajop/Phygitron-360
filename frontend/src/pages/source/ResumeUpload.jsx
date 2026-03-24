import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { sourceApi } from '../../api';
import { Upload, File, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

function FileItem({ file, status }) {
  const icons = { pending: <Loader size={16} className="spinner" style={{ animation: 'spin 0.8s linear infinite' }} />, processing: <Loader size={16} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />, done: <CheckCircle size={16} color="var(--success)" />, error: <AlertCircle size={16} color="var(--danger)" /> };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--primary-lightest)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
      <File size={18} color="var(--primary)" />
      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB</span>
      {icons[status]}
      <span style={{ fontSize: '0.75rem', color: status === 'done' ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
}

export default function ResumeUpload() {
  const [files, setFiles] = useState([]);
  const [statuses, setStatuses] = useState({});

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) { toast.error('Only PDF files up to 5MB are accepted'); return; }
    const newFiles = accepted.slice(0, 50);
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => setStatuses(s => ({ ...s, [f.name]: 'pending' })));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 5 * 1024 * 1024,
    multiple: true,
  });

  const uploadAll = async () => {
    const pending = files.filter(f => statuses[f.name] === 'pending' || statuses[f.name] === 'error');
    
    for (const file of pending) {
      setStatuses(s => ({ ...s, [file.name]: 'processing' }));
      try {
        await sourceApi.uploadResume(file);
        setStatuses(s => ({ ...s, [file.name]: 'done' }));
      } catch {
        setStatuses(s => ({ ...s, [file.name]: 'error' }));
        toast.error(`Failed to upload ${file.name}`);
      }
      // Rate limiting buffer
      await new Promise(r => setTimeout(r, 1000));
    }
    
    toast.success(`Upload sequence complete!`);
  };

  const pendingCount = files.filter(f => !statuses[f.name] || statuses[f.name] === 'pending' || statuses[f.name] === 'error').length;

  return (
    <div>
      <div className="page-header">
        <h1>Upload Resumes</h1>
        <p>Upload PDF resumes for AI-powered skill extraction and candidate profiling</p>
      </div>
      <div className="page-body" style={{ maxWidth: 760 }}>
        <div {...getRootProps()} className={`upload-zone animate-fade-in ${isDragActive ? 'drag-over' : ''}`}>
          <input {...getInputProps()} />
          <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>{isDragActive ? '📂' : '📄'}</div>
          <h3 style={{ marginBottom: 8 }}>{isDragActive ? 'Drop PDFs here!' : 'Drag & drop resumes here'}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>or click to browse · PDF only · max 5MB · up to 50 files</p>
          <button type="button" className="btn btn-primary"><Upload size={16} /> Choose Files</button>
        </div>

        {files.length > 0 && (
          <div className="card animate-slide-up" style={{ marginTop: 24 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setFiles([]); setStatuses({}); }}>Clear All</button>
                {pendingCount > 0 && <button className="btn btn-primary btn-sm" onClick={uploadAll}><Upload size={14} /> Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}</button>}
              </div>
            </div>
            <div className="card-body">
              {files.map(f => <FileItem key={f.name} file={f} status={statuses[f.name] || 'pending'} />)}
            </div>
          </div>
        )}

        <div className="card animate-fade-in" style={{ marginTop: 24, background: 'var(--primary-lightest)', border: '1px solid var(--primary-lighter)' }}>
          <div className="card-body">
            <h4 style={{ marginBottom: 12, color: 'var(--primary)' }}>🤖 What happens after upload?</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['AI extracts skills and experience from the PDF', 'Skills are matched to the master skill taxonomy', 'Confidence signals flag any inconsistencies', 'Candidate profile is ready for scoring in ~30 seconds'].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
