import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { sourceApi } from '../../api';
import { Upload, File, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

function FileItem({ file, status }) {
  const icons = { pending: <Loader size={16} className="spinner" style={{ animation: 'spin 0.8s linear infinite' }} />, processing: <Loader size={16} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />, done: <CheckCircle size={16} color="var(--success)" />, error: <AlertCircle size={16} color="var(--danger)" /> };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
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
  const [bulkJobs, setBulkJobs] = useState([]);

  useEffect(() => {
    fetchBulkJobs();
    const timer = setInterval(fetchBulkJobs, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchBulkJobs = async () => {
    try {
      const res = await sourceApi.getBulkUploads();
      setBulkJobs(res.data.data);
    } catch (err) {
      console.error("Failed to fetch bulk jobs", err);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to cancel this processing job?")) return;
    try {
      await sourceApi.cancelBulkUpload(jobId);
      toast.success("Job cancellation requested");
      fetchBulkJobs();
    } catch (err) {
      console.error("Cancellation error details:", err.response?.data);
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : "Failed to cancel job");
    }
  };

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      if (rejected.some(r => r.file.size > 30 * 1024 * 1024)) {
        toast.error('One or more files exceed the 30MB limit');
      } else {
        toast.error('Only PDF or ZIP files are accepted');
      }
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
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip']
    },
    maxSize: 30 * 1024 * 1024,
    multiple: true,
  });

  const uploadAll = async () => {
    const pending = files.filter(f => statuses[f.name] === 'pending' || statuses[f.name] === 'error');
    
    for (const file of pending) {
      setStatuses(s => ({ ...s, [file.name]: 'processing' }));
      try {
        const res = await sourceApi.uploadResume(file);
        // If it was a ZIP, handle as background job
        if (res.data.data.job_id) {
          setStatuses(s => ({ ...s, [file.name]: 'done' }));
          toast.success(`ZIP processing started in background!`);
          fetchBulkJobs();
        } else {
          setStatuses(s => ({ ...s, [file.name]: 'done' }));
        }
      } catch (err) {
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
          <h3 style={{ marginBottom: 8 }}>{isDragActive ? 'Drop files here!' : 'Drag & drop resumes here'}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>or click to browse · PDF or ZIP · max 30MB · up to 50 files</p>
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

        <div className="card animate-fade-in" style={{ marginTop: 24, background: 'var(--bg-card-alt)', border: '1px solid var(--border)' }}>
          <div className="card-body">
            <h4 style={{ marginBottom: 12, color: 'var(--primary)' }}>🤖 What happens after upload?</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['AI extracts skills and experience from the document', 'ZIP archives are automatically expanded and processed', 'Skills are matched to the master skill taxonomy', 'Candidate profile is ready for scoring in seconds'].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {bulkJobs.length > 0 && (
          <div className="animate-fade-in" style={{ marginTop: 40 }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader size={20} className={bulkJobs.some(j => j.status === 'processing' || j.status === 'pending') ? 'spinner' : ''} />
              Recent Bulk Processing
            </h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
              {bulkJobs.map(job => (
                <div key={job.id} className="card" style={{ border: job.status === 'processing' ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                  <div className="card-body" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700 }}>{job.filename}</span>
                        <span className={`badge badge-${job.status === 'completed' ? 'success' : job.status === 'processing' ? 'primary' : job.status === 'cancelled' ? 'muted' : job.status === 'failed' ? 'danger' : 'secondary'}`}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {(job.status === 'processing' || job.status === 'pending') && (
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => handleCancelJob(job.id)}
                            style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '2px 8px', height: 'auto' }}
                          >
                            Cancel
                          </button>
                        )}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(job.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {job.status === 'failed' ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontStyle: 'italic', marginBottom: 12 }}>
                        Error: {job.error_message || 'Unknown processing error'}
                      </div>
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ height: 6, background: 'var(--bg-card-alt)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${job.total_files > 0 ? (job.processed_files / job.total_files) * 100 : 0}%`, 
                            background: 'var(--primary)',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Processed {job.processed_files} of {job.total_files} resumes</span>
                          <span>{job.total_files > 0 ? Math.round((job.processed_files / job.total_files) * 100) : 0}%</span>
                        </div>
                      </div>
                    )}

                    {job.processed_details && job.processed_details.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                          <span>File Tracking</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{job.processed_details.length} files detected</span>
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                          {job.processed_details.map((detail, idx) => (
                            <div key={idx} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 10, 
                              padding: '8px 12px', 
                              background: 'var(--bg-card-alt)', 
                              borderRadius: 6, 
                              marginBottom: 6,
                              fontSize: '0.8rem',
                              border: '1px solid var(--border)' 
                            }}>
                              {detail.status === 'done' ? <CheckCircle size={14} color="var(--success)" /> : 
                               detail.status === 'error' ? <AlertCircle size={14} color="var(--danger)" /> : 
                               <Loader size={14} className="spinner" />}
                              <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.filename}</span>
                              <span style={{ 
                                padding: '2px 6px', 
                                borderRadius: 4, 
                                fontSize: '0.65rem', 
                                fontWeight: 800, 
                                textTransform: 'uppercase',
                                background: detail.status === 'done' ? '#10B98120' : detail.status === 'error' ? '#EF444420' : '#3B82F620',
                                color: detail.status === 'done' ? 'var(--success)' : detail.status === 'error' ? 'var(--danger)' : 'var(--primary)'
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
