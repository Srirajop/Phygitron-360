import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { 
  Folder, File, ChevronRight, Search, Upload, Trash2, CalendarDays, 
  Loader, Plus, X, LayoutGrid, List, FolderInput, AlertTriangle, 
  Check, Tag, Sparkles, FileText, CheckCircle2 
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const PDF_LIMIT_BYTES = 30 * 1024 * 1024; // 30MB
const ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const SKILL_TYPE_CONFIG = {
  required: { label: 'Required', badge: 'Required (Must-have)', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', weight: 2 },
  preferred: { label: 'Preferred', badge: 'Preferred (Bonus)', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', weight: 1 },
};

const getSkillType = (skill) => {
  const t = (skill?.type || skill?.level || 'required').toLowerCase().trim();
  if (['required', 'must-have', 'mandatory', 'core', 'expert', 'advanced'].includes(t)) return 'required';
  return 'preferred';
};

export default function ResumeRepo() {
  const { user } = useAuth();
  
  // Navigation & Folders
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  const [currentYear, setCurrentYear] = useState(() => {
    const saved = sessionStorage.getItem('resumeRepo_year');
    return saved ? Number(saved) : null;
  });
  
  const [currentFolder, setCurrentFolder] = useState(() => {
    try {
      const saved = sessionStorage.getItem('resumeRepo_folder');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Candidates & State inside Month
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleTagFilter, setSelectedRoleTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [forceFolderDate, setForceFolderDate] = useState(true);
  const [manualYears, setManualYears] = useState(new Set());

  // Job Roles (from database)
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const currentDate = new Date();
  const [newFolderMonth, setNewFolderMonth] = useState(currentDate.getMonth() + 1);
  const [newFolderYear, setNewFolderYear] = useState(currentDate.getFullYear());

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadRoleTag, setUploadRoleTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Inline Create Job Role inside Upload/Tag Modal
  const [showCreateJobRoleInline, setShowCreateJobRoleInline] = useState(false);
  const [newRoleJD, setNewRoleJD] = useState('');
  const [newRoleMinExp, setNewRoleMinExp] = useState(0);
  const [newRoleSkills, setNewRoleSkills] = useState([]);
  const [extractingInlineSkills, setExtractingInlineSkills] = useState(false);
  const [inlineManualSkill, setInlineManualSkill] = useState({ skill: '', type: 'required' });
  const [savingJobRole, setSavingJobRole] = useState(false);

  // Assign Role Tag Modal
  const [tagModal, setTagModal] = useState({
    open: false,
    candidateIds: [],
    candidateNames: [],
    roleTag: '',
    loading: false,
  });

  // Move Month Folder Modal
  const [moveModal, setMoveModal] = useState({
    open: false,
    candidateIds: [],
    candidateNames: [],
    targetMonthId: '',
    loading: false,
  });

  // Delete Month Folder Modal
  const [deleteMonthFolderModal, setDeleteMonthFolderModal] = useState({
    open: false,
    folder: null,
    loading: false,
  });

  // Session storage sync
  useEffect(() => {
    if (currentYear) sessionStorage.setItem('resumeRepo_year', currentYear);
    else sessionStorage.removeItem('resumeRepo_year');
  }, [currentYear]);

  useEffect(() => {
    if (currentFolder) sessionStorage.setItem('resumeRepo_folder', JSON.stringify(currentFolder));
    else sessionStorage.removeItem('resumeRepo_folder');
  }, [currentFolder]);

  // Load Job Roles from backend
  const fetchJobRoles = useCallback(async () => {
    setLoadingJobRoles(true);
    try {
      const res = await sourceApi.listJobRoles();
      setJobRoles(res.data.data || []);
    } catch (err) {
      console.warn('Failed to load job roles:', err);
    } finally {
      setLoadingJobRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchJobRoles();
  }, [fetchJobRoles]);

  // Load Folder list
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

  // Load candidates inside month
  const fetchCandidates = async (folderId) => {
    setLoadingCandidates(true);
    try {
      const res = await sourceApi.searchCandidates({ upload_time: folderId, limit: 1000, pool: 'candidate' });
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

  // Distinct Role Tags present in currently loaded candidates
  const availableMonthTags = useMemo(() => {
    const set = new Set();
    let hasUntagged = false;
    candidates.forEach(c => {
      const tag = (c.role_folder || '').trim();
      if (tag && tag.toLowerCase() !== 'unassigned roles') {
        set.add(tag);
      } else {
        hasUntagged = true;
      }
    });
    return {
      tags: Array.from(set).sort((a, b) => a.localeCompare(b)),
      hasUntagged
    };
  }, [candidates]);

  // Filter & sort candidates
  const filteredCandidates = useMemo(() => {
    let filtered = candidates;

    // Filter by Role Tag
    if (selectedRoleTagFilter === 'UNTAGGED') {
      filtered = filtered.filter(c => !c.role_folder || c.role_folder.trim().toLowerCase() === 'unassigned roles');
    } else if (selectedRoleTagFilter !== 'ALL') {
      filtered = filtered.filter(c => (c.role_folder || '').trim() === selectedRoleTagFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.email || '').toLowerCase().includes(q) ||
        (c.role_folder || '').toLowerCase().includes(q)
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return 0;
    });
  }, [candidates, selectedRoleTagFilter, searchQuery, sortBy]);

  // Derived Year Lists
  const yearCounts = useMemo(() => {
    return folders.reduce((acc, f) => {
      acc[f.year] = (acc[f.year] || 0) + f.count;
      return acc;
    }, {});
  }, [folders]);

  const yearList = Array.from(new Set([...Object.keys(yearCounts).map(Number), ...manualYears])).sort((a, b) => b - a);
  const foldersForYear = currentYear ? folders.filter(f => f.year === currentYear) : [];

  // Dropzone handling: if dropped anywhere or inside modal
  const handleDroppedFiles = useCallback((accepted) => {
    if (!accepted || accepted.length === 0) return;
    setUploadFiles(prev => [...prev, ...accepted]);
    setShowUploadModal(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDroppedFiles,
    noClick: true,
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

  // Check if typed upload role tag matches an existing Job Role
  const matchedJobRole = useMemo(() => {
    const trimmed = (uploadRoleTag || '').trim().toLowerCase();
    if (!trimmed) return null;
    return jobRoles.find(r => r.title.toLowerCase() === trimmed) || null;
  }, [uploadRoleTag, jobRoles]);

  // Create Job Role inline (with JD and AI skill extraction)
  const handleCreateJobRoleInline = async (titleToCreate) => {
    const title = (titleToCreate || uploadRoleTag || '').trim();
    if (!title) {
      toast.error('Please enter a role title');
      return;
    }
    setSavingJobRole(true);
    try {
      const res = await sourceApi.createJobRole({
        title,
        description: newRoleJD.trim() || undefined,
        min_experience: Number(newRoleMinExp) || 0,
        required_skills: newRoleSkills,
      });
      toast.success(`Job Role "${title}" created with your customized criteria!`);
      await fetchJobRoles();
      setShowCreateJobRoleInline(false);
      setNewRoleJD('');
      setNewRoleMinExp(0);
      setNewRoleSkills([]);
      setUploadRoleTag(title);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create Job Role');
    } finally {
      setSavingJobRole(false);
    }
  };

  // AI Extraction for inline Job Role
  const handleExtractInlineSkills = async () => {
    const roleTitle = (uploadRoleTag || '').trim();
    if (!newRoleJD.trim() && !roleTitle) {
      toast.error('Please enter a role tag or JD text first');
      return;
    }
    setExtractingInlineSkills(true);
    try {
      const res = await sourceApi.extractJdSkills({
        description: newRoleJD,
        title: roleTitle,
      });
      const extracted = res.data.data || [];
      if (extracted.length === 0) {
        toast('No skills detected automatically. You can add skills manually below.', { icon: 'ℹ️' });
      } else {
        const existing = new Set(newRoleSkills.map(s => (s.skill || '').toLowerCase().trim()));
        const newlyAdded = extracted.filter(s => !existing.has((s.skill || '').toLowerCase().trim()));
        setNewRoleSkills(prev => [...prev, ...newlyAdded]);
        toast.success(`Extracted ${extracted.length} skills! Set Required vs Preferred below.`);
      }
    } catch (err) {
      toast.error('Failed to extract skills with AI');
    } finally {
      setExtractingInlineSkills(false);
    }
  };

  const handleAddInlineCustomSkill = (e) => {
    if (e) e.preventDefault();
    const name = (inlineManualSkill.skill || '').trim();
    if (!name) return;
    const exists = newRoleSkills.some(s => (s.skill || '').toLowerCase().trim() === name.toLowerCase());
    if (exists) {
      toast.error(`Skill "${name}" is already in the list`);
      return;
    }
    const skillType = inlineManualSkill.type || 'required';
    setNewRoleSkills(prev => [...prev, { skill: name, type: skillType, level: skillType }]);
    setInlineManualSkill({ skill: '', type: 'required' });
  };

  // Perform upload
  const handleExecuteUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error('Please select at least one resume file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading(`Uploading ${uploadFiles.length} resume(s)...`);

    let successCount = 0;
    const finalTag = uploadRoleTag.trim() || null;
    const overrideDate = currentFolder && forceFolderDate ? currentFolder.id : null;

    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      try {
        await sourceApi.uploadResume(
          file,
          matchedJobRole ? matchedJobRole.id : null,
          (progressEvent) => {
            if (progressEvent.total) {
              const filePct = (progressEvent.loaded / progressEvent.total) * 100;
              const totalPct = Math.round(((i + filePct / 100) / uploadFiles.length) * 100);
              setUploadProgress(totalPct);
            }
          },
          null,
          overrideDate,
          finalTag
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    toast.success(`Uploaded ${successCount} file(s). AI parsing in progress!`, { id: toastId });
    setShowUploadModal(false);
    setUploadFiles([]);
    setUploadRoleTag('');
    setShowCreateJobRoleInline(false);
    setNewRoleJD('');
    setNewRoleSkills([]);

    if (currentFolder) {
      fetchCandidates(currentFolder.id);
    }
    fetchFolders();
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selected.size} selected resume(s)?`)) return;

    try {
      await sourceApi.bulkDeleteCandidates(Array.from(selected));
      toast.success(`${selected.size} resume(s) deleted successfully`);
      setSelected(new Set());
      if (currentFolder) {
        fetchCandidates(currentFolder.id);
      }
      fetchFolders();
    } catch (err) {
      toast.error('Failed to delete resumes');
    }
  };

  // Single Delete
  const handleSingleDelete = async (candidateId, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name || 'this resume'}"?`)) return;
    try {
      await sourceApi.deleteCandidate(candidateId);
      toast.success('Resume deleted successfully');
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
      if (currentFolder) {
        fetchCandidates(currentFolder.id);
      }
      fetchFolders();
    } catch (err) {
      toast.error('Failed to delete resume');
    }
  };

  // Selection toggles
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(filteredCandidates.map(c => c.id)));
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

  // Create Year / Month Folder
  const handleCreateFolder = () => {
    if (!currentYear) {
      setManualYears(prev => new Set(prev).add(newFolderYear));
      setCurrentYear(newFolderYear);
      setShowFolderModal(false);
      return;
    }

    if (!currentFolder) {
      const monthStr = newFolderMonth.toString().padStart(2, '0');
      const folderId = `${currentYear}-${monthStr}`;
      const date = new Date(currentYear, newFolderMonth - 1);
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });

      const existing = folders.find(f => f.id === folderId);
      if (existing) {
        setCurrentFolder(existing);
      } else {
        setCurrentFolder({ id: folderId, label, year: currentYear, month_num: newFolderMonth, count: 0 });
      }
      setShowFolderModal(false);
    }
  };

  // Delete Month Folder
  const handleConfirmDeleteMonthFolder = async () => {
    const { folder } = deleteMonthFolderModal;
    if (!folder) return;
    setDeleteMonthFolderModal(prev => ({ ...prev, loading: true }));
    try {
      const [year, month] = folder.id.split('-').map(Number);
      await sourceApi.deleteMonthFolder({ year, month });
      toast.success(`Month folder "${folder.label}" deleted`);
      if (currentFolder && currentFolder.id === folder.id) {
        setCurrentFolder(null);
      }
      fetchFolders();
      setDeleteMonthFolderModal({ open: false, folder: null, loading: false });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete month folder');
      setDeleteMonthFolderModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Tag Modal: Open & Execute
  const openTagModal = (candidateIds, candidateNames, currentTag = '') => {
    setTagModal({
      open: true,
      candidateIds,
      candidateNames,
      roleTag: currentTag && currentTag !== 'Unassigned Roles' ? currentTag : '',
      loading: false,
    });
  };

  const handleConfirmTag = async () => {
    if (!tagModal.candidateIds.length) return;
    const finalTag = tagModal.roleTag.trim() || null;
    setTagModal(prev => ({ ...prev, loading: true }));
    try {
      await sourceApi.tagCandidates({
        candidate_ids: tagModal.candidateIds,
        role_tag: finalTag,
      });
      toast.success(`Updated role tag for ${tagModal.candidateIds.length} candidate(s) to ${finalTag ? `"${finalTag}"` : 'Untagged'}`);
      if (currentFolder) {
        fetchCandidates(currentFolder.id);
      }
      setTagModal({ open: false, candidateIds: [], candidateNames: [], roleTag: '', loading: false });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update role tag');
      setTagModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Move Modal: Open & Execute
  const openMoveModal = (candidateIds, candidateNames) => {
    const defaultMonthId = folders[0]?.id || (currentFolder ? currentFolder.id : '');
    setMoveModal({
      open: true,
      candidateIds,
      candidateNames,
      targetMonthId: defaultMonthId,
      loading: false,
    });
  };

  const handleConfirmMove = async () => {
    if (!moveModal.candidateIds.length || !moveModal.targetMonthId) return;
    setMoveModal(prev => ({ ...prev, loading: true }));
    try {
      await sourceApi.moveCandidates({
        candidate_ids: moveModal.candidateIds,
        target_month_folder_id: moveModal.targetMonthId,
      });
      toast.success(`Moved ${moveModal.candidateIds.length} candidate(s) to ${moveModal.targetMonthId}`);
      if (currentFolder) {
        fetchCandidates(currentFolder.id);
      }
      fetchFolders();
      setSelected(new Set());
      setMoveModal({ open: false, candidateIds: [], candidateNames: [], targetMonthId: '', loading: false });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to move candidates');
      setMoveModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div {...getRootProps()} style={{ outline: 'none', minHeight: 'calc(100vh - 100px)' }}>
      <input {...getInputProps()} />

      {/* Drag & Drop Visual Overlay */}
      {isDragActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(59, 130, 246, 0.12)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, border: '4px dashed var(--primary)', borderRadius: '16px', margin: '20px'
        }}>
          <div style={{ textAlign: 'center', color: 'var(--primary)', background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <Upload size={64} style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Drop resumes to upload with Role Tag</h2>
            <p style={{ color: 'var(--text-muted)' }}>PDF, DOCX, or ZIP files supported</p>
          </div>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
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
                <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={16} color="var(--primary)" />
                  {currentFolder.label}
                </span>
              </>
            )}
          </div>

          {/* Quick stats or action button */}
          {currentFolder && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => {
                  setUploadFiles([]);
                  setUploadRoleTag('');
                  setShowCreateJobRoleInline(false);
                  setShowUploadModal(true);
                }} 
                style={{ gap: 6 }}
              >
                <Upload size={15} /> Upload Resumes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* ── 1. YEAR VIEW (ROOT) ──────────────────────────────────────────────── */}
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
                <Plus size={15} /> Create Year Folder
              </button>
            </div>
            
            {loadingFolders ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
            ) : yearList.length === 0 ? (
              <div className="empty-state">
                <Folder size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No resumes uploaded yet. Click "Create Year Folder" to get started.</p>
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
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{yearCounts[year] || 0} resumes</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{year}</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Uploaded files timeline</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 2. MONTH VIEW INSIDE YEAR ────────────────────────────────────────── */}
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
                <Plus size={15} /> Create Month Folder
              </button>
            </div>
            
            {foldersForYear.length === 0 ? (
              <div className="empty-state">
                <Folder size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No month folders created in {currentYear}.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {foldersForYear.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase())).map((f, i) => (
                  <div 
                    key={f.id} 
                    className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                    style={{ position: 'relative', padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    onClick={() => setCurrentFolder(f)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Folder size={32} color="var(--primary)" style={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{f.count} resumes</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          title={`Delete "${f.label}" folder`}
                          style={{ padding: '4px', height: 'auto', color: 'var(--text-muted)', borderRadius: '6px' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteMonthFolderModal({ open: true, folder: f, loading: false });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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

        {/* ── 3. RESUMES DIRECT MONTH VIEW (NO ROLE SUB-FOLDERS!) ──────────────── */}
        {currentFolder && (
          <div className="animate-fade-in">
            {/* Filter & Action Toolbar */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              marginBottom: 16, background: 'var(--bg-card)', padding: '12px 18px', 
              borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '14px' 
            }}>
              {/* Select All Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }}
                  checked={filteredCandidates.length > 0 && selected.size === filteredCandidates.length}
                  onChange={toggleSelectAll}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {selected.size > 0 ? `${selected.size} Selected` : 'Select All'}
                </span>
              </div>

              {/* Candidate Search */}
              <div style={{ position: 'relative', minWidth: 220, flex: 1, maxWidth: 320 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search resumes in this month..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36, width: '100%', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Role Tag Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={15} color="var(--text-muted)" />
                <select 
                  className="form-control"
                  value={selectedRoleTagFilter}
                  onChange={e => setSelectedRoleTagFilter(e.target.value)}
                  style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', minWidth: 160 }}
                >
                  <option value="ALL">All Role Tags ({candidates.length})</option>
                  {availableMonthTags.hasUntagged && (
                    <option value="UNTAGGED">Untagged ({candidates.filter(c => !c.role_folder || c.role_folder.trim().toLowerCase() === 'unassigned roles').length})</option>
                  )}
                  {availableMonthTags.tags.map(t => {
                    const count = candidates.filter(c => (c.role_folder || '').trim() === t).length;
                    return (
                      <option key={t} value={t}>{t} ({count})</option>
                    );
                  })}
                </select>
              </div>

              {/* Sort Dropdown */}
              <select 
                className="form-control" 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)} 
                style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
              </select>

              {/* View Toggle (Grid / List) */}
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '8px', padding: '3px' }}>
                <button 
                  className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ padding: '5px 8px', height: 'auto' }} 
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <List size={16} />
                </button>
                <button 
                  className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ padding: '5px 8px', height: 'auto' }} 
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>

              {/* Action Buttons for Selected Resumes */}
              {selected.size > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const selectedCands = candidates.filter(c => selected.has(c.id));
                      openTagModal(
                        Array.from(selected),
                        selectedCands.map(c => c.name || `Resume #${c.id}`),
                        selectedCands[0]?.role_folder || ''
                      );
                    }}
                    style={{ gap: 6 }}
                  >
                    <Tag size={14} /> Assign Tag ({selected.size})
                  </button>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const selectedCands = candidates.filter(c => selected.has(c.id));
                      openMoveModal(
                        Array.from(selected),
                        selectedCands.map(c => c.name || `Resume #${c.id}`)
                      );
                    }}
                    style={{ gap: 6 }}
                  >
                    <FolderInput size={14} /> Move Month ({selected.size})
                  </button>

                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={handleBulkDelete}
                    style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', gap: 6 }}
                  >
                    <Trash2 size={14} /> Delete ({selected.size})
                  </button>
                </div>
              )}

              {/* Upload Resumes Trigger */}
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => {
                  setUploadFiles([]);
                  setUploadRoleTag('');
                  setShowCreateJobRoleInline(false);
                  setShowUploadModal(true);
                }}
                style={{ gap: 6, whiteSpace: 'nowrap' }}
              >
                <Upload size={14} /> Upload Resumes
              </button>
            </div>

            {/* Resumes Grid/List Display */}
            {loadingCandidates ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
            ) : filteredCandidates.length === 0 ? (
              <div className="empty-state">
                <File size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
                <p>No resumes found in this month folder matching your criteria.</p>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => setShowUploadModal(true)} 
                  style={{ gap: 6, marginTop: 8 }}
                >
                  <Upload size={14} /> Upload Resumes Now
                </button>
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(290px, 1fr))' : '1fr', 
                gap: 14 
              }}>
                {filteredCandidates.map((c, i) => {
                  const isTagged = c.role_folder && c.role_folder.trim() && c.role_folder.trim().toLowerCase() !== 'unassigned roles';
                  const isSelected = selected.has(c.id);

                  return (
                    <div 
                      key={c.id} 
                      className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                      style={{ 
                        padding: '16px', 
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.02)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                        display: 'flex',
                        flexDirection: viewMode === 'grid' ? 'column' : 'row',
                        alignItems: viewMode === 'grid' ? 'stretch' : 'center',
                        gap: 12,
                        borderRadius: '12px'
                      }}
                      onClick={() => toggleSelect(c.id)}
                    >
                      {/* Left: Checkbox + Name & Email */}
                      <div style={{ display: 'flex', alignItems: viewMode === 'grid' ? 'flex-start' : 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <input 
                          type="checkbox" 
                          style={{ accentColor: 'var(--primary)', width: 16, height: 16, marginTop: viewMode === 'grid' ? 3 : 0, cursor: 'pointer' }}
                          checked={isSelected}
                          onChange={() => {}} // handled by card onClick
                        />
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <File size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                              {c.name || 'Candidate #' + c.id}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.email || 'No email provided'}
                          </div>

                          {/* Role Tag Pill (Visible under name in grid mode) */}
                          {viewMode === 'grid' && (
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {isTagged ? (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    background: 'rgba(59, 130, 246, 0.12)', 
                                    color: 'var(--primary)', 
                                    fontWeight: 600, 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: 4, 
                                    fontSize: '0.75rem',
                                    padding: '3px 8px',
                                    borderRadius: '6px'
                                  }}
                                  title="Assigned Role Tag"
                                >
                                  <Tag size={11} /> {c.role_folder}
                                </span>
                              ) : (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    background: 'var(--bg-subtle)', 
                                    color: 'var(--text-muted)', 
                                    fontWeight: 500, 
                                    fontSize: '0.75rem',
                                    padding: '3px 8px',
                                    borderRadius: '6px'
                                  }}
                                  title="No Role Tag Assigned"
                                >
                                  Untagged
                                </span>
                              )}

                              {c.exp_years != null && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  · {c.exp_years}y exp
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* List View additional columns */}
                        {viewMode === 'list' && (
                          <>
                            <div style={{ width: 180, display: 'flex', alignItems: 'center' }}>
                              {isTagged ? (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    background: 'rgba(59, 130, 246, 0.12)', 
                                    color: 'var(--primary)', 
                                    fontWeight: 600, 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: 4, 
                                    fontSize: '0.78rem',
                                    padding: '4px 10px',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <Tag size={12} /> {c.role_folder}
                                </span>
                              ) : (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    background: 'var(--bg-subtle)', 
                                    color: 'var(--text-muted)', 
                                    fontWeight: 500, 
                                    fontSize: '0.78rem',
                                    padding: '4px 10px',
                                    borderRadius: '6px'
                                  }}
                                >
                                  Untagged
                                </span>
                              )}
                            </div>

                            <div style={{ width: 120, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {new Date(c.created_at || Date.now()).toLocaleDateString()}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right/Bottom Action Buttons */}
                      <div 
                        style={{ 
                          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', 
                          gap: 6, marginTop: viewMode === 'grid' ? 'auto' : 0, 
                          paddingTop: viewMode === 'grid' ? 10 : 0, 
                          borderTop: viewMode === 'grid' ? '1px solid var(--border-light)' : 'none' 
                        }}
                      >
                        {/* Quick Tag Button */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', gap: 4, color: 'var(--text-secondary)' }}
                          title="Change or assign role tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTagModal([c.id], [c.name || `Resume #${c.id}`], c.role_folder);
                          }}
                        >
                          <Tag size={13} /> Tag
                        </button>

                        {/* Quick Move Button */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', gap: 4, color: 'var(--text-secondary)' }}
                          title="Move to another month folder"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMoveModal([c.id], [c.name || `Resume #${c.id}`]);
                          }}
                        >
                          <FolderInput size={13} /> Move
                        </button>

                        {/* View Candidate Profile */}
                        <Link 
                          to={`/source/candidates/${c.id}`} 
                          className="btn btn-ghost btn-sm" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', color: 'var(--primary)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Profile
                        </Link>

                        {/* Delete Single Resume */}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 6px', height: 'auto', color: 'var(--text-muted)' }}
                          title="Delete resume"
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSingleDelete(c.id, c.name);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: UPLOAD RESUMES (WITH ROLE TAG & JOB ROLE LINKING) ───────── */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 560, maxWidth: '95vw', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={20} color="var(--primary)" /> Upload Resumes
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Uploading into folder: <strong>{currentFolder ? currentFolder.label : 'Talent Vault'}</strong>
                </p>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: 4, height: 'auto' }} 
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Dropzone File Picker */}
            <div 
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 12,
                padding: '24px 16px',
                textAlign: 'center',
                background: 'var(--bg-subtle)',
                marginBottom: 16,
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('modalFileInput')?.click()}
            >
              <input 
                id="modalFileInput" 
                type="file" 
                multiple 
                accept=".pdf,.doc,.docx,.zip" 
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUploadFiles(prev => [...prev, ...Array.from(e.target.files)]);
                  }
                }}
              />
              <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Click to browse or drag & drop resume files
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                PDF / DOCX (up to 30MB) or ZIP archive (up to 2GB)
              </p>
            </div>

            {/* Selected Files List */}
            {uploadFiles.length > 0 && (
              <div style={{ marginBottom: 16, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Selected Files ({uploadFiles.length}):
                  </span>
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ fontSize: '0.7rem', padding: '2px 6px', height: 'auto', color: 'var(--danger)' }}
                    onClick={() => setUploadFiles([])}
                  >
                    Clear all
                  </button>
                </div>
                {uploadFiles.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 6px', borderRadius: 4, background: 'var(--bg-card)', marginBottom: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{f.name}</span>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: 2, height: 'auto', color: 'var(--text-muted)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Role Tag Selector & Job Role Verification */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <span>Assign Role Tag (Optional)</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Links to Job Role for AI scoring
                </span>
              </label>

              {/* Combobox: Select or Type */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select 
                  className="form-control"
                  value={matchedJobRole ? matchedJobRole.title : (uploadRoleTag === '' ? '' : '__CUSTOM__')}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setUploadRoleTag('');
                      setShowCreateJobRoleInline(false);
                    } else if (e.target.value === '__CUSTOM__') {
                      // Keep custom text
                    } else {
                      setUploadRoleTag(e.target.value);
                      setShowCreateJobRoleInline(false);
                    }
                  }}
                  style={{ flex: 1, borderRadius: 8, fontSize: '0.85rem' }}
                >
                  <option value="">-- Untagged (No Role Tag) --</option>
                  <optgroup label="Existing Job Roles (with JD & AI scoring)">
                    {jobRoles.map(r => (
                      <option key={r.id} value={r.title}>{r.title}</option>
                    ))}
                  </optgroup>
                  {uploadRoleTag && !matchedJobRole && (
                    <option value="__CUSTOM__">Custom: "{uploadRoleTag}"</option>
                  )}
                </select>
              </div>

              {/* Free-text input to type custom role */}
              <div style={{ position: 'relative' }}>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Or type a custom role tag (e.g. Java Developer, Python Lead)..."
                  value={uploadRoleTag}
                  onChange={(e) => {
                    setUploadRoleTag(e.target.value);
                    setShowCreateJobRoleInline(false);
                  }}
                  style={{ borderRadius: 8, fontSize: '0.85rem', width: '100%' }}
                />
              </div>

              {/* Live Verification Status Banner */}
              <div style={{ marginTop: 8 }}>
                {!uploadRoleTag.trim() ? (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Resumes will be uploaded without a specific role tag (Untagged).
                  </p>
                ) : matchedJobRole ? (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 8, 
                    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', 
                    borderRadius: 8, padding: '8px 12px', color: '#059669', fontSize: '0.8rem' 
                  }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <strong>Matches Job Role "{matchedJobRole.title}"</strong>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#047857' }}>
                        Job Description & AI scoring criteria linked automatically.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', 
                    borderRadius: 8, padding: '10px 12px', fontSize: '0.8rem' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ color: '#b45309', fontWeight: 500 }}>
                        "{uploadRoleTag.trim()}" is not in your Job Roles yet.
                      </span>
                      {!showCreateJobRoleInline && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowCreateJobRoleInline(true)}
                          style={{ fontSize: '0.75rem', padding: '3px 10px', height: 'auto', gap: 4 }}
                        >
                          <Plus size={13} /> Add as Job Role with JD
                        </button>
                      )}
                    </div>

                    {/* Inline JD Creation Card */}
                    {showCreateJobRoleInline && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Create Job Role: "{uploadRoleTag.trim()}"
                          </p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleExtractInlineSkills}
                            disabled={extractingInlineSkills || (!newRoleJD.trim() && !uploadRoleTag.trim())}
                            style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto', gap: 4 }}
                          >
                            {extractingInlineSkills ? <Loader size={12} className="spinner" /> : <Sparkles size={12} color="#8b5cf6" />}
                            {extractingInlineSkills ? 'Extracting...' : '⚡ Extract Skills'}
                          </button>
                        </div>
                        
                        <textarea 
                          className="form-control"
                          rows={3}
                          placeholder="Paste Job Description (JD) here... You can extract skills with AI or define requirements manually."
                          value={newRoleJD}
                          onChange={e => setNewRoleJD(e.target.value)}
                          style={{ width: '100%', fontSize: '0.8rem', borderRadius: 6, marginBottom: 8 }}
                        />

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            Min Experience (Years):
                          </label>
                          <input 
                            type="number" 
                            min={0} 
                            max={30} 
                            value={newRoleMinExp}
                            onChange={e => setNewRoleMinExp(e.target.value)}
                            style={{ width: 80, padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem', border: '1px solid var(--border)' }}
                          />
                        </div>

                        {/* Interactive Skills & Levels */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Required Skills & Levels ({newRoleSkills.length})
                            </span>
                            {newRoleSkills.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.7rem', color: 'var(--danger)', padding: 0, height: 'auto' }}
                                onClick={() => setNewRoleSkills([])}
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          {newRoleSkills.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, maxHeight: 120, overflowY: 'auto', padding: 6, background: '#fff', borderRadius: 6, border: '1px solid var(--border)' }}>
                              {newRoleSkills.map((s, idx) => {
                                const stype = getSkillType(s);
                                const cfg = SKILL_TYPE_CONFIG[stype];
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.skill}</span>
                                    <select
                                      value={stype}
                                      onChange={e => {
                                        const updated = [...newRoleSkills];
                                        updated[idx] = { ...updated[idx], type: e.target.value, level: e.target.value };
                                        setNewRoleSkills(updated);
                                      }}
                                      style={{ fontSize: '0.7rem', fontWeight: 700, color: cfg.color, background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
                                    >
                                      <option value="required">Required</option>
                                      <option value="preferred">Preferred</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...newRoleSkills];
                                        updated.splice(idx, 1);
                                        setNewRoleSkills(updated);
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'flex' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                              No specific skills yet. Click "⚡ Extract Skills" or add manually below.
                            </div>
                          )}

                          {/* Quick manual skill add */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Add skill (e.g. Java, Docker)..."
                              value={inlineManualSkill.skill}
                              onChange={e => setInlineManualSkill(s => ({ ...s, skill: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddInlineCustomSkill();
                                }
                              }}
                              style={{ flex: 1, fontSize: '0.75rem', padding: '3px 6px', height: 'auto', borderRadius: 4 }}
                            />
                            <select
                              value={inlineManualSkill.type || 'required'}
                              onChange={e => setInlineManualSkill(s => ({ ...s, type: e.target.value }))}
                              style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }}
                            >
                              <option value="required">Required</option>
                              <option value="preferred">Preferred</option>
                            </select>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={handleAddInlineCustomSkill}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto' }}
                            >
                              + Add
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', height: 'auto' }}
                            onClick={() => setShowCreateJobRoleInline(false)}
                            disabled={savingJobRole}
                          >
                            Skip / Upload Tag Only
                          </button>
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{ fontSize: '0.75rem', padding: '4px 12px', height: 'auto', gap: 4 }}
                            onClick={() => handleCreateJobRoleInline(uploadRoleTag)}
                            disabled={savingJobRole || extractingInlineSkills}
                          >
                            {savingJobRole ? <Loader size={12} className="spinner" /> : <CheckCircle2 size={12} />}
                            Save Job Role & Link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Force Folder Date Checkbox */}
            {currentFolder && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', marginBottom: 20, color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={forceFolderDate} 
                  onChange={e => setForceFolderDate(e.target.checked)} 
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                Stamp uploaded resumes with date <strong>{currentFolder.label}</strong>
              </label>
            )}

            {/* Progress bar if uploading */}
            {isUploading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                className="btn btn-ghost" 
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                disabled={isUploading || uploadFiles.length === 0}
                onClick={handleExecuteUpload}
                style={{ gap: 6 }}
              >
                {isUploading ? <Loader size={16} className="spinner" /> : <Upload size={16} />}
                Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ASSIGN ROLE TAG TO CANDIDATES ───────────────────────────── */}
      {tagModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 460, maxWidth: '95vw', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color="var(--primary)" /> Assign Role Tag
              </h3>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: 4, height: 'auto' }} 
                onClick={() => setTagModal(prev => ({ ...prev, open: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Assigning role tag to <strong>{tagModal.candidateIds.length}</strong> candidate(s): {tagModal.candidateNames.slice(0, 3).join(', ')}{tagModal.candidateNames.length > 3 ? ` +${tagModal.candidateNames.length - 3} more` : ''}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Select Role Tag or Choose Untagged
              </label>
              
              <select 
                className="form-control"
                value={jobRoles.some(r => r.title.toLowerCase() === (tagModal.roleTag || '').toLowerCase()) ? tagModal.roleTag : (tagModal.roleTag === '' ? '' : '__CUSTOM__')}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setTagModal(prev => ({ ...prev, roleTag: '' }));
                  } else if (e.target.value === '__CUSTOM__') {
                    // Keep custom
                  } else {
                    setTagModal(prev => ({ ...prev, roleTag: e.target.value }));
                  }
                }}
                style={{ width: '100%', borderRadius: 8, marginBottom: 8 }}
              >
                <option value="">-- Untagged (Clear Role Tag) --</option>
                <optgroup label="Existing Job Roles">
                  {jobRoles.map(r => (
                    <option key={r.id} value={r.title}>{r.title}</option>
                  ))}
                </optgroup>
                {tagModal.roleTag && !jobRoles.some(r => r.title.toLowerCase() === tagModal.roleTag.toLowerCase()) && (
                  <option value="__CUSTOM__">Custom: "{tagModal.roleTag}"</option>
                )}
              </select>

              <input 
                type="text"
                className="form-control"
                placeholder="Or type a custom tag..."
                value={tagModal.roleTag}
                onChange={e => setTagModal(prev => ({ ...prev, roleTag: e.target.value }))}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                className="btn btn-ghost" 
                disabled={tagModal.loading}
                onClick={() => setTagModal(prev => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                disabled={tagModal.loading}
                onClick={handleConfirmTag}
                style={{ gap: 6 }}
              >
                {tagModal.loading ? <Loader size={16} className="spinner" /> : <Check size={16} />}
                Apply Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MOVE RESUMES TO ANOTHER MONTH FOLDER ────────────────────── */}
      {moveModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 440, maxWidth: '95vw', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderInput size={18} color="var(--primary)" /> Move Resumes to Month
              </h3>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: 4, height: 'auto' }} 
                onClick={() => setMoveModal(prev => ({ ...prev, open: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Moving <strong>{moveModal.candidateIds.length}</strong> resume(s) to another month timeline.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Target Month Folder
              </label>
              <select 
                className="form-control"
                value={moveModal.targetMonthId}
                onChange={e => setMoveModal(prev => ({ ...prev, targetMonthId: e.target.value }))}
                style={{ width: '100%', borderRadius: 8 }}
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.label} {currentFolder && f.id === currentFolder.id ? '(Current Month)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                className="btn btn-ghost" 
                disabled={moveModal.loading}
                onClick={() => setMoveModal(prev => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                disabled={moveModal.loading}
                onClick={handleConfirmMove}
                style={{ gap: 6 }}
              >
                {moveModal.loading ? <Loader size={16} className="spinner" /> : <FolderInput size={16} />}
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE YEAR / MONTH FOLDER ──────────────────────────────── */}
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
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Select Year
                  </label>
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
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Folders organize resumes by upload timeline.
                  </p>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Select Month for {currentYear}
                  </label>
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
                      return <option key={monthNum} value={monthNum}>{monthName}</option>;
                    })}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Creating a month folder lets you upload and organize resumes into this specific timeline.
                  </p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder}>Create & Open</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE MONTH FOLDER ──────────────────────────────────────── */}
      {deleteMonthFolderModal.open && deleteMonthFolderModal.folder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 420, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={20} color="var(--danger)" /> Delete Month Folder
              </h3>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: 4, height: 'auto' }} 
                onClick={() => setDeleteMonthFolderModal(prev => ({ ...prev, open: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 12 }}>
              Are you sure you want to delete folder <strong>"{deleteMonthFolderModal.folder.label}"</strong>?
            </p>

            {deleteMonthFolderModal.folder.count > 0 ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                  <AlertTriangle size={16} /> Warning: Contains {deleteMonthFolderModal.folder.count} resume(s)
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Deleting this month folder will permanently remove all {deleteMonthFolderModal.folder.count} resume(s) inside it.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                This month folder is empty and will be removed.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                className="btn btn-ghost" 
                disabled={deleteMonthFolderModal.loading}
                onClick={() => setDeleteMonthFolderModal(prev => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                disabled={deleteMonthFolderModal.loading}
                onClick={handleConfirmDeleteMonthFolder}
                style={{ gap: 6, background: 'var(--danger)', color: '#fff', border: 'none' }}
              >
                {deleteMonthFolderModal.loading ? <Loader size={16} className="spinner" /> : <Trash2 size={16} />}
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
