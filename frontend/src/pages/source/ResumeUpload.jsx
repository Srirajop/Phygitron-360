import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { sourceApi } from '../../api';
import { Upload, File, CheckCircle, AlertCircle, Loader, X, Zap, Clock, Wifi, Folder } from 'lucide-react';
import toast from 'react-hot-toast';

const PDF_LIMIT_BYTES = 30 * 1024 * 1024;
const ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000; // poll every 3s (was 5s)

function formatFileSize(size) {
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(size / 1024)} KB`;
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

function formatETA(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s left`;
  return `~${Math.ceil(seconds / 60)}m left`;
}

function FileItem({ file, status, uploadPct, uploadSpeed, uploadETA, onAbort }) {
  const icons = {
    pending: <Loader size={16} style={{ color: 'var(--text-muted)', animation: 'spin 1.2s linear infinite' }} />,
    uploading: <Wifi size={16} style={{ color: 'var(--primary)', animation: 'pulse 1s ease infinite' }} />,
    processing: <Loader size={16} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />,
    done: <CheckCircle size={16} color="var(--success)" />,
    duplicate: <AlertCircle size={16} color="var(--text-muted)" />,
    error: <AlertCircle size={16} color="var(--danger)" />,
    cancelled: <X size={16} color="var(--text-muted)" />,
  };

  const isUploading = status === 'uploading';
  const isZip = file.name.toLowerCase().endsWith('.zip');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '12px 16px',
      background: 'var(--bg-card)',
      border: `1px solid ${isUploading ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      marginBottom: 8,
      transition: 'border-color 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <File size={18} color={isZip ? 'var(--primary)' : 'var(--text-secondary)'} />
        <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {formatFileSize(file.size)}
        </span>
        {isUploading && (
          <span style={{ fontSize: '0.72rem', color: 'var(--primary)', flexShrink: 0, fontWeight: 600 }}>
            {Math.round(uploadPct || 0)}%
          </span>
        )}
        {icons[status] || icons.pending}
        <span style={{
          fontSize: '0.72rem',
          color: status === 'done' ? 'var(--success)' : status === 'duplicate' ? 'var(--text-muted)' : status === 'error' ? 'var(--danger)' : status === 'uploading' ? 'var(--primary)' : 'var(--text-muted)',
          fontWeight: 700,
          textTransform: 'capitalize',
          flexShrink: 0,
        }}>
          {status === 'uploading' ? 'uploading…' : status}
        </span>
        {isUploading && onAbort && (
          <button
            onClick={onAbort}
            title="Cancel upload"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--danger)', padding: 2, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Upload progress bar (HTTP transfer phase) */}
      {isUploading && (
        <div>
          <div style={{ height: 4, background: 'var(--bg-card-alt)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${uploadPct || 0}%`,
              background: 'linear-gradient(90deg, var(--primary), #a78bfa)',
              transition: 'width 0.3s ease',
              borderRadius: 2,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={10} />{uploadSpeed ? formatSpeed(uploadSpeed) : 'Connecting…'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} />{formatETA(uploadETA)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResumeUpload() {
  const [files, setFiles] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [uploadProgress, setUploadProgress] = useState({}); // { filename: { pct, speed, eta } }
  const [bulkJobs, setBulkJobs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef(null);   // for cancelling HTTP upload
  const pollTimerRef = useRef(null);
  const uploadStartRef = useRef({});          // { filename: { startTime, lastBytes } }

  // ── Smart polling: only when there are active jobs & tab is visible ─────────
  const fetchBulkJobs = useCallback(async () => {
    try {
      const res = await sourceApi.getBulkUploads();
      const jobs = res.data.data || [];

      const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending');

      if (activeJobs.length === 0) {
        setBulkJobs(jobs);
        return;
      }

      // Fetch detailed status for active jobs in parallel
      const details = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            const r = await sourceApi.getBulkUploadStatus(job.id);
            return r.data.data;
          } catch {
            return job;
          }
        })
      );
      const detailMap = new Map(details.map(j => [j.id, j]));
      setBulkJobs(jobs.map(j => detailMap.get(j.id) || j));
    } catch (err) {
      console.error('Failed to fetch bulk jobs', err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return; // don't poll when tab hidden
      fetchBulkJobs();
    }, POLL_INTERVAL_MS);
  }, [fetchBulkJobs]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchBulkJobs();
    startPolling();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchBulkJobs();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchBulkJobs, startPolling, stopPolling]);

  // Stop polling when all jobs are done
  useEffect(() => {
    const hasActive = bulkJobs.some(j => j.status === 'processing' || j.status === 'pending');
    if (!hasActive) stopPolling();
    else startPolling();
  }, [bulkJobs, startPolling, stopPolling]);

  // ── Cancel a background processing job ──────────────────────────────────────
  const handleCancelJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;

    // Optimistic UI update — mark immediately as "cancelling"
    setBulkJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelling' } : j));

    try {
      await sourceApi.cancelBulkUpload(jobId);
      toast.success('Job cancelled');
      // Update to actual cancelled state
      setBulkJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to cancel job');
      // Revert optimistic update
      fetchBulkJobs();
    }
  };

  // ── Cancel the in-progress HTTP upload ──────────────────────────────────────
  const handleAbortUpload = (filename) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatuses(s => ({ ...s, [filename]: 'cancelled' }));
    setIsUploading(false);
    toast('Upload cancelled');
  };

  // ── Dropzone ─────────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      const hasZipLimit = rejected.some(r => r.errors?.some(e => e.code === 'zip-too-large'));
      const hasPdfLimit = rejected.some(r => r.errors?.some(e => e.code === 'pdf-too-large'));
      const hasType = rejected.some(r => r.errors?.some(e => e.code === 'file-invalid-type'));
      if (hasZipLimit) toast.error('ZIP files must be 2GB or smaller');
      else if (hasPdfLimit) toast.error('PDF files must be 30MB or smaller');
      else if (hasType) toast.error('Only PDF or ZIP files are accepted');
      else toast.error('One or more files could not be added');
      return;
    }
    const newFiles = accepted.slice(0, 50);
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => setStatuses(s => ({ ...s, [f.name]: 'pending' })));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip'],
    },
    multiple: true,
    validator: (file) => {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip') && file.size > ZIP_LIMIT_BYTES)
        return { code: 'zip-too-large', message: 'ZIP files must be 2GB or smaller' };
      if ((name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) && file.size > PDF_LIMIT_BYTES)
        return { code: 'pdf-too-large', message: 'Document files must be 30MB or smaller' };
      return null;
    },
  });

  const handleFolderSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const name = (file.name || '').toLowerCase();
      return name.endsWith('.pdf') || name.endsWith('.zip') || name.endsWith('.doc') || name.endsWith('.docx');
    });
    
    if (validFiles.length === 0) {
      toast.error('No valid PDF, DOCX, DOC or ZIP files found in the folder');
      return;
    }
    
    const validAndSized = [];
    let hasSizeError = false;
    for (const file of validFiles) {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip') && file.size > ZIP_LIMIT_BYTES) hasSizeError = true;
      else if ((name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) && file.size > PDF_LIMIT_BYTES) hasSizeError = true;
      else validAndSized.push(file);
    }
    
    if (hasSizeError) {
      toast.error('Some files were skipped because they exceeded the size limit');
    }
    
    const newFiles = validAndSized.slice(0, 50);
    if (validAndSized.length > 50) {
      toast.error('Only the first 50 files from the folder will be added');
    }
    
    setFiles(prev => {
      // Avoid adding duplicates by name
      const existingNames = new Set(prev.map(f => f.name));
      const uniqueNew = newFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...uniqueNew];
    });
    
    newFiles.forEach(f => setStatuses(s => ({ ...s, [f.name]: 'pending' })));
    e.target.value = null;
  };

  // ── Upload all pending files ─────────────────────────────────────────────────
  const uploadAll = async () => {
    const pending = files.filter(f => statuses[f.name] === 'pending' || statuses[f.name] === 'error');
    if (!pending.length) return;

    setIsUploading(true);

    for (const file of pending) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatuses(s => ({ ...s, [file.name]: 'uploading' }));
      uploadStartRef.current[file.name] = { startTime: Date.now(), lastLoaded: 0 };

      const onProgress = (evt) => {
        if (!evt.total) return;
        const pct = (evt.loaded / evt.total) * 100;
        const elapsed = (Date.now() - uploadStartRef.current[file.name].startTime) / 1000;
        const speed = elapsed > 0 ? evt.loaded / elapsed : 0;
        const remaining = speed > 0 ? (evt.total - evt.loaded) / speed : Infinity;
        setUploadProgress(p => ({
          ...p,
          [file.name]: { pct, speed, eta: remaining },
        }));
      };

      try {
        const res = await sourceApi.uploadResume(file, null, onProgress, controller.signal);

        if (res.data.data?.job_id) {
          setStatuses(s => ({ ...s, [file.name]: 'done' }));
          toast.success(`ZIP upload complete — processing ${file.name} in background`);
          await fetchBulkJobs();
          startPolling();
        } else if (res.data.data?.status === 'duplicate') {
          setStatuses(s => ({ ...s, [file.name]: 'duplicate' }));
          toast(`Duplicate skipped: ${file.name}`);
        } else {
          setStatuses(s => ({ ...s, [file.name]: 'done' }));
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          setStatuses(s => ({ ...s, [file.name]: 'cancelled' }));
        } else {
          setStatuses(s => ({ ...s, [file.name]: 'error' }));
          const msg = err.response?.data?.detail || err.response?.data?.message;
          toast.error(msg ? `${file.name}: ${msg}` : `Failed to upload ${file.name}`);
        }
      }

      // Clean up progress state after upload
      setUploadProgress(p => { const n = { ...p }; delete n[file.name]; return n; });

      // Check if aborted — stop the whole queue
      if (controller.signal.aborted) break;
    }

    abortControllerRef.current = null;
    setIsUploading(false);
    toast.success('Upload sequence complete!');
  };

  const pendingCount = files.filter(f => !statuses[f.name] || statuses[f.name] === 'pending' || statuses[f.name] === 'error').length;
  const hasActive = bulkJobs.some(j => j.status === 'processing' || j.status === 'pending');

  return (
    <div>
      <div className="page-header">
        <h1>Upload Resumes</h1>
        <p>Upload PDF resumes or a ZIP archive — AI extracts skills and builds candidate profiles automatically</p>
      </div>

      <div className="page-body" style={{ maxWidth: 800 }}>
        {/* ── Drop Zone ── */}
        <div
          {...getRootProps()}
          className={`upload-zone animate-fade-in ${isDragActive ? 'drag-over' : ''}`}
          style={{ cursor: 'pointer' }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>{isDragActive ? '📂' : '📄'}</div>
          <h3 style={{ marginBottom: 8 }}>{isDragActive ? 'Drop files here!' : 'Drag & drop resumes here'}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            or click to browse · PDF/DOCX up to 30 MB · ZIP up to 2 GB · up to 50 files
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary">
              <Upload size={16} /> Choose Files
            </button>
            <label 
              className="btn btn-secondary" 
              style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={e => e.stopPropagation()}
            >
              <Folder size={16} /> Upload Folder
              <input 
                type="file" 
                webkitdirectory="true" 
                directory="true" 
                multiple 
                onChange={handleFolderSelect} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>

        {/* ── Selected Files ── */}
        {files.length > 0 && (
          <div className="card animate-slide-up" style={{ marginTop: 24 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isUploading && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFiles([]); setStatuses({}); setUploadProgress({}); }}>
                    Clear All
                  </button>
                )}
                {pendingCount > 0 && !isUploading && (
                  <button className="btn btn-primary btn-sm" onClick={uploadAll}>
                    <Upload size={14} /> Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
                  </button>
                )}
                {isUploading && (
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                    onClick={() => {
                      if (abortControllerRef.current) abortControllerRef.current.abort();
                    }}
                  >
                    <X size={14} /> Cancel Upload
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              {files.map(f => {
                const prog = uploadProgress[f.name] || {};
                return (
                  <FileItem
                    key={f.name}
                    file={f}
                    status={statuses[f.name] || 'pending'}
                    uploadPct={prog.pct}
                    uploadSpeed={prog.speed}
                    uploadETA={prog.eta}
                    onAbort={statuses[f.name] === 'uploading' ? () => handleAbortUpload(f.name) : null}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Info Card ── */}
        <div className="card animate-fade-in" style={{ marginTop: 24, background: 'var(--bg-card-alt)', border: '1px solid var(--border)' }}>
          <div className="card-body">
            <h4 style={{ marginBottom: 12, color: 'var(--primary)' }}>🤖 What happens after upload?</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                'AI extracts skills & experience from each resume',
                'ZIP archives are expanded & all PDFs processed in parallel',
                'Skills are matched to the master skill taxonomy',
                'Candidate profiles are ready for scoring in seconds',
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bulk Jobs ── */}
        {bulkJobs.length > 0 && (
          <div className="animate-fade-in" style={{ marginTop: 40 }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader
                size={20}
                style={hasActive ? { animation: 'spin 1s linear infinite' } : {}}
              />
              Recent Bulk Processing
              {hasActive && (
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 4 }}>
                  Live
                </span>
              )}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bulkJobs.map(job => {
                const pct = job.total_files > 0 ? Math.round((job.processed_files / job.total_files) * 100) : 0;
                const isActive = job.status === 'processing' || job.status === 'pending';
                const isCancelling = job.status === 'cancelling';

                return (
                  <div
                    key={job.id}
                    className="card"
                    style={{
                      border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                      transition: 'border-color 0.3s ease',
                    }}
                  >
                    <div className="card-body" style={{ padding: '16px 20px' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.filename}
                          </span>
                          <span className={`badge badge-${
                            job.status === 'completed' ? 'success' :
                            job.status === 'processing' ? 'primary' :
                            job.status === 'cancelled' || job.status === 'cancelling' ? 'muted' :
                            job.status === 'failed' ? 'danger' : 'secondary'
                          }`} style={{ flexShrink: 0 }}>
                            {isCancelling ? 'cancelling…' : job.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {(isActive || isCancelling) && !isCancelling && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleCancelJob(job.id)}
                              style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '3px 10px' }}
                            >
                              <X size={12} /> Cancel
                            </button>
                          )}
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {new Date(job.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Error message */}
                      {job.status === 'failed' ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontStyle: 'italic', marginBottom: 12 }}>
                          ⚠ {job.error_message || 'Unknown processing error'}
                        </div>
                      ) : (
                        /* Progress bar */
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ height: 8, background: 'var(--bg-card-alt)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: job.status === 'completed' ? 'var(--success)' :
                                          job.status === 'cancelled' ? 'var(--text-muted)' :
                                          'linear-gradient(90deg, var(--primary), #a78bfa)',
                              transition: 'width 0.6s ease',
                              borderRadius: 4,
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>
                              {job.status === 'completed'
                                ? `✅ All ${job.total_files} resumes processed`
                                : `Processed ${job.processed_files} of ${job.total_files} resumes`}
                            </span>
                            <span style={{ fontWeight: 700, color: job.status === 'completed' ? 'var(--success)' : 'var(--primary)' }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Per-file details */}
                      {job.processed_details && job.processed_details.length > 0 && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Recent File Tracking</span>
                            <span style={{ fontWeight: 500 }}>{job.total_files} files total</span>
                          </div>
                          <div style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                            {job.processed_details.slice().reverse().map((detail, idx) => (
                              <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '7px 12px',
                                background: 'var(--bg-card-alt)',
                                borderRadius: 6,
                                marginBottom: 5,
                                fontSize: '0.78rem',
                                border: '1px solid var(--border)',
                              }}>
                                {detail.status === 'done'
                                  ? <CheckCircle size={13} color="var(--success)" />
                                  : detail.status === 'duplicate'
                                    ? <AlertCircle size={13} color="var(--text-muted)" />
                                    : detail.status === 'error'
                                      ? <AlertCircle size={13} color="var(--danger)" />
                                      : <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                                <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {detail.filename}
                                </span>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: '0.63rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  background: detail.status === 'done' ? '#10B98120' : detail.status === 'duplicate' ? '#64748B20' : detail.status === 'error' ? '#EF444420' : '#3B82F620',
                                  color: detail.status === 'done' ? 'var(--success)' : detail.status === 'duplicate' ? 'var(--text-muted)' : detail.status === 'error' ? 'var(--danger)' : 'var(--primary)',
                                }}>
                                  {detail.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
