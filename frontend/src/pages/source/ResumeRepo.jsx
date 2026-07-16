import React, { useState, useEffect, useCallback } from 'react';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Folder, File, ChevronRight, Search, Upload, Trash2, CalendarDays, Loader, Plus, X, LayoutGrid, List } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const PDF_LIMIT_BYTES = 30 * 1024 * 1024;
const ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

export default function ResumeRepo() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  const [currentYear, setCurrentYear] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null); // null means root/year view, otherwise folder object {id, label}
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  
  const [selected, setSelected] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [forceFolderDate, setForceFolderDate] = useState(true);
  const [manualYears, setManualYears] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  const [showFolderModal, setShowFolderModal] = useState(false);
  const currentDate = new Date();
  const [newFolderMonth, setNewFolderMonth] = useState(currentDate.getMonth() + 1);
  const [newFolderYear, setNewFolderYear] = useState(currentDate.getFullYear());

  const fetchFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await sourceApi.getRepositoryFolders();
      setFolders(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load folders');
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchCandidates = async (folderId) => {
    setLoadingCandidates(true);
    try {
      const res = await sourceApi.searchCandidates({ upload_time: folderId, limit: 1000 });
      setCandidates(res.data.data || []);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to load resumes');
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (!currentFolder) {
      fetchFolders();
    } else {
      fetchCandidates(currentFolder.id);
    }
  }, [currentFolder]);

  const filteredCandidates = React.useMemo(() => {
    return candidates
      .filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
        if (sortBy === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortBy === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return 0;
      });
  }, [candidates, searchQuery, sortBy]);

  // Derived state for years
  const yearCounts = React.useMemo(() => {
    return folders.reduce((acc, f) => {
      acc[f.year] = (acc[f.year] || 0) + f.count;
      return acc;
    }, {});
  }, [folders]);
  const yearList = Array.from(new Set([...Object.keys(yearCounts).map(Number), ...manualYears])).sort((a, b) => b - a);

  const foldersForYear = currentYear ? folders.filter(f => f.year === currentYear) : [];

  // Dropzone logic
  const onDrop = useCallback(async (accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Some files were rejected due to size or type restrictions.');
    }
    if (accepted.length === 0) return;

    setIsUploading(true);
    toast.loading(`Uploading ${accepted.length} file(s)...`, { id: 'repo_upload' });
    
    let successCount = 0;
    for (const file of accepted) {
      try {
        const overrideDate = currentFolder && forceFolderDate ? currentFolder.id : null;
        await sourceApi.uploadResume(file, null, null, null, overrideDate);
        successCount++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploading(false);
    toast.success(`Successfully uploaded ${successCount} file(s). Processing in background.`, { id: 'repo_upload' });
    
    // Refresh folder view to show new candidates if they are processed fast enough (though processing is bg)
    if (currentFolder) {
      fetchCandidates(currentFolder.id);
    }
  }, [currentFolder, forceFolderDate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true, // We don't want clicking anywhere to open file dialog, only drag
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip'],
    },
    validator: (file) => {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip') && file.size > ZIP_LIMIT_BYTES) return { code: 'too-large', message: 'ZIP files must be <= 2GB' };
      if ((name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) && file.size > PDF_LIMIT_BYTES) return { code: 'too-large', message: 'Docs must be <= 30MB' };
      return null;
    }
  });

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selected.size} resume(s)?`)) return;

    try {
      await sourceApi.bulkDeleteCandidates(Array.from(selected));
      toast.success(`${selected.size} resume(s) deleted successfully`);
      setSelected(new Set());
      if (currentFolder) {
        fetchCandidates(currentFolder.id);
      }
    } catch (err) {
      toast.error('Failed to delete resumes');
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(candidates.map(c => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleCreateFolder = () => {
    if (!currentYear) {
      // Creating a Year
      setManualYears(prev => new Set(prev).add(newFolderYear));
      setCurrentYear(newFolderYear);
      setShowFolderModal(false);
      return;
    }
    
    // Creating a Month inside currentYear
    const monthStr = newFolderMonth.toString().padStart(2, '0');
    const folderId = `${currentYear}-${monthStr}`;
    const date = new Date(currentYear, newFolderMonth - 1);
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Check if it already exists in the backend folders array
    const existing = folders.find(f => f.id === folderId);
    if (existing) {
      setCurrentFolder(existing);
    } else {
      setCurrentFolder({ id: folderId, label, year: currentYear, month_num: newFolderMonth, count: 0 });
    }
    setShowFolderModal(false);
  };

  return (
    <div {...getRootProps()} style={{ outline: 'none', minHeight: 'calc(100vh - 100px)' }}>
      <input {...getInputProps()} />
      
      {/* Drag Overlay */}
      {isDragActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(59, 130, 246, 0.1)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, border: '4px dashed var(--primary)', borderRadius: '16px', margin: '20px'
        }}>
          <div style={{ textAlign: 'center', color: 'var(--primary)', background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <Upload size={64} style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Drop resumes to upload instantly</h2>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 24 }}>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 600 }}>
          <span 
            style={{ color: (!currentYear && !currentFolder) ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setCurrentYear(null); setCurrentFolder(null); }}
          >
            <Folder size={18} />
            Resume Repo
          </span>
          
          {currentYear && (
            <>
              <ChevronRight size={16} color="var(--text-muted)" />
              <span 
                style={{ color: currentFolder ? 'var(--text-muted)' : 'var(--text-primary)', cursor: 'pointer' }}
                onClick={() => setCurrentFolder(null)}
              >
                {currentYear}
              </span>
            </>
          )}

          {currentFolder && (
            <>
              <ChevronRight size={16} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-primary)' }}>{currentFolder.label}</span>
            </>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* YEAR VIEW */}
        {!currentYear && !currentFolder && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search years..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36, width: '100%', borderRadius: '8px' }}
                />
              </div>
              <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                <Plus size={15} /> Create Folder
              </button>
            </div>
            
            {loadingFolders ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
            ) : yearList.length === 0 ? (
              <div className="empty-state">
                <Folder size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No resumes have been uploaded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {yearList.filter(year => year.toString().includes(searchQuery)).map((year, i) => (
                  <div 
                    key={year} 
                    className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                    style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    onClick={() => setCurrentYear(year)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Folder size={32} color="var(--primary)" style={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{yearCounts[year]} resumes</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{year}</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Uploaded files</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MONTH VIEW */}
        {currentYear && !currentFolder && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search months..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36, width: '100%', borderRadius: '8px' }}
                />
              </div>
              <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setShowFolderModal(true)}>
                <Plus size={15} /> Create Folder
              </button>
            </div>
            
            {foldersForYear.length === 0 ? (
              <div className="empty-state">
                <Folder size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No resumes uploaded in {currentYear}.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {foldersForYear.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase())).map((f, i) => (
                  <div 
                    key={f.id} 
                    className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                    style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    onClick={() => setCurrentFolder(f)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Folder size={32} color="var(--primary)" style={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{f.count} resumes</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{f.label}</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Uploaded files</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETAIL FILE VIEW */}
        {currentFolder && (
          <div className="animate-fade-in">
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: 'var(--bg-card)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input 
                  type="checkbox" 
                  style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }}
                  checked={filteredCandidates.length > 0 && selected.size === filteredCandidates.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(filteredCandidates.map(c => c.id)));
                    else setSelected(new Set());
                  }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select All</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 300 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search resumes..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36, width: '100%', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                </select>

                <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '8px', padding: '4px' }}>
                  <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 10px', height: 'auto' }} onClick={() => setViewMode('list')}><List size={16} /></button>
                  <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 10px', height: 'auto' }} onClick={() => setViewMode('grid')}><LayoutGrid size={16} /></button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }} title="If checked, new uploads will be permanently dated to match this folder.">
                  <input type="checkbox" checked={forceFolderDate} onChange={e => setForceFolderDate(e.target.checked)} style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  Force folder date
                </label>
                {selected.size > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={handleBulkDelete} style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', gap: 6 }}>
                    <Trash2 size={15} /> Delete {selected.size}
                  </button>
                )}
                {/* Upload Trigger - opens file dialog manually */}
                <label className="btn btn-primary btn-sm" style={{ gap: 6, margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Upload size={15} /> Upload Resumes
                  <input {...getInputProps()} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {loadingCandidates ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
            ) : filteredCandidates.length === 0 ? (
              <div className="empty-state">
                <File size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No resumes found. Try adjusting your search.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr', gap: 16 }}>
                {filteredCandidates.map((c, i) => (
                  <div 
                    key={c.id} 
                    className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                    style={{ 
                      padding: '16px', 
                      border: selected.has(c.id) ? '2px solid var(--primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      display: 'flex',
                      flexDirection: viewMode === 'grid' ? 'column' : 'row',
                      alignItems: viewMode === 'grid' ? 'stretch' : 'center',
                      gap: 12
                    }}
                    onClick={() => toggleSelect(c.id)}
                  >
                    <div style={{ display: 'flex', alignItems: viewMode === 'grid' ? 'flex-start' : 'center', gap: 12, flex: 1 }}>
                      <input 
                        type="checkbox" 
                        style={{ accentColor: 'var(--primary)', width: 16, height: 16, marginTop: viewMode === 'grid' ? 4 : 0 }}
                        checked={selected.has(c.id)}
                        onChange={() => {}} // Handled by parent div
                      />
                      <div style={{ flex: 1, minWidth: 0, display: viewMode === 'list' ? 'flex' : 'block', alignItems: 'center', gap: 24 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: viewMode === 'grid' ? 4 : 0 }}>
                            <File size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </span>
                          </div>
                          {viewMode === 'grid' && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {c.email}
                            </div>
                          )}
                        </div>
                        {viewMode === 'list' && (
                          <div style={{ width: 200, fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.email}
                          </div>
                        )}
                        {viewMode === 'list' && (
                          <div style={{ width: 150, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {new Date(c.created_at || Date.now()).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: viewMode === 'grid' ? 'auto' : 0, paddingTop: viewMode === 'grid' ? 12 : 0, borderTop: viewMode === 'grid' ? '1px solid var(--border-light)' : 'none' }}>
                      <Link 
                        to={`/source/candidates/${c.id}`} 
                        className="btn btn-ghost btn-sm" 
                        style={{ padding: '4px 12px', fontSize: '0.75rem', height: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 400, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Folder size={20} color="var(--primary)" /> Create Folder
              </h3>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4, height: 'auto' }} onClick={() => setShowFolderModal(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              {!currentYear ? (
                <>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Select Year</label>
                  <select 
                    className="form-control" 
                    value={newFolderYear} 
                    onChange={e => setNewFolderYear(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const y = currentDate.getFullYear() - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Select Month for {currentYear}</label>
                  <select 
                    className="form-control" 
                    value={newFolderMonth} 
                    onChange={e => setNewFolderMonth(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => {
                      const monthNum = i + 1;
                      const date = new Date(2000, i);
                      const monthName = date.toLocaleString('default', { month: 'long' });
                      // Disable future months if year is current year
                      const isFuture = currentYear === currentDate.getFullYear() && monthNum > currentDate.getMonth() + 1;
                      return <option key={monthNum} value={monthNum} disabled={isFuture}>{monthName}</option>;
                    })}
                  </select>
                </>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Folders organize resumes by their upload date. Creating a folder lets you artificially upload files into this specific timeline.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder}>Create & Open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
