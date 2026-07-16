import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Upload, Trash2, MapPin, Zap, Database, Shield,
  CheckSquare, Loader2, Download, X, AlertTriangle, Mail,
  ArrowUpRight, Plus, Send, Star, Filter, Users, ChevronDown,
  RefreshCw, Briefcase, Clock, CheckCircle, UserCheck,
  TrendingUp, PieChart, Activity, Edit, XCircle, UserPlus,
  FileText, Award, User, Calendar, Building, MapPin as MapPinIcon,
  Briefcase as BriefcaseIcon, Mail as MailIcon, Phone, ExternalLink,
  ChevronRight, BarChart, Users as UsersIcon, CheckCircle as CheckCircleIcon,
  Clock as ClockIcon, XCircle as XCircleIcon, AlertCircle,
  Archive, Pause, Play
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import CandidateDrawer from './CandidateDrawer';
import OfferApprovals from './OfferApprovals';
import ActiveCandidates from './ActiveCandidates';
import InviteStatus from './InviteStatus';

import "../../../styles/light-theme-override.css";
import logo from "../../../assets/phy360.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";
import { getHubTabs } from "../../../core/navigation/hubTabs";
import {
  MAX_FILE_SIZE,
  isNonNegativeNumber,
  validateFile,
} from '../../../core/utils/validators';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return 'text-gray-400 bg-gray-50 border-gray-200';
  if (s >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (s >= 60) return 'text-purple-600 bg-purple-50 border-purple-200';
  return 'text-rose-600 bg-rose-50 border-rose-200';
};

const STATUS_STYLE = {
  active:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  favourite:   'bg-purple-50 text-purple-700 border-purple-200',
  invited:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  hired:       'bg-blue-50 text-blue-700 border-blue-200',
  rejected:    'bg-rose-50 text-rose-700 border-rose-200',
  new:         'bg-gray-50 text-gray-700 border-gray-200',
  archived:    'bg-gray-100 text-gray-600 border-gray-200',
};

const initFilters = { pool: 'all', location: '', min_exp: 0, sort_by: 'newest', role_id: '', limit: 20 };

export default function SourceDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const query = new URLSearchParams(location.search);
  const currentTab = query.get('tab') || 'home';

  const { user, hasPermission, logout } = useAuth();
  const displayName = user?.name || user?.email?.split('@')[0] || "User";

  const appModules = getHubTabs({ hasPermission, hasRole });

  // Dynamic role display based on actual user roles
  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Super Admin';
    if (hasRole?.('org_admin')) return 'Organisation Admin';
    if (hasRole?.('manager')) return 'Manager';
    if (hasRole?.('recruiter')) return 'Recruiter';
    return 'Employee';
  };

  const isCandidate = hasRole('candidate');

  if (!hasRole(['super_admin', 'org_admin', 'manager']) && !isCandidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center bg-gray-50">
        <Shield size={48} className="text-gray-300" />
        <div>
          <h2 className="text-xl font-bold text-gray-800">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">You do not have access to this module.</p>
        </div>
      </div>
    );
  }

  if (isCandidate) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-2xl p-8 border border-purple-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-2xl opacity-50"></div>
          <p className="text-xs font-medium text-purple-600 mb-2">CANDIDATE PORTAL</p>
          <h1 className="text-3xl font-bold text-gray-800">Application Status</h1>
          
          <div className="mt-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-xl">
              {user?.name?.[0] || 'C'}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">{user?.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">Identity Verified • Application Processing</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <Activity size={16} className="text-purple-600" /> Active Pipeline
            </h3>
            <div className="space-y-3">
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Resume Screening</p>
                    <p className="text-xs text-gray-500 mt-0.5">Stage 1</p>
                  </div>
                  <CheckCircleIcon className="text-emerald-500" size={18} />
               </div>
               <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Pre-Employment Assessment</p>
                    <p className="text-xs text-purple-600 mt-0.5">Stage 2 • Action Required</p>
                  </div>
                  <button onClick={() => navigate('/verify')} className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors">
                    Start
                  </button>
               </div>
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center opacity-50">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Technical Interview</p>
                    <p className="text-xs text-gray-400 mt-0.5">Stage 3</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
               </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <Database size={16} className="text-purple-600" /> My Profile
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Your profile is being reviewed to find matching opportunities. Ensure your skills are current for the best matches.
            </p>
            <div className="space-y-3">
               <div className="flex justify-between text-sm font-medium text-gray-600">
                  <span>Compatibility Score</span>
                  <span className="text-purple-600">Searching...</span>
               </div>
               <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-300 w-1/3 animate-pulse"></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [candidates, setCandidates] = useState([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [drawerCandidate, setDrawerCandidate] = useState(null);
  
  const fileRef = useRef(null);
  const folderRef = useRef(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Activity feed state
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [autoRanking, setAutoRanking] = useState(false);

  // Invite-status tab: role selector
  const [inviteStatusRoleId, setInviteStatusRoleId] = useState('');
  const [showInviteStatus, setShowInviteStatus] = useState(false);

  // Form states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkJobId, setBulkJobId] = useState(null);
  const [bulkJobProgress, setBulkJobProgress] = useState(null);
  const [newRole, setNewRole] = useState({ title: '', description: '', min_experience: 0, required_skills: [] });
  const [newSkillInput, setNewSkillInput] = useState({ name: '', level: 'intermediate' });
  const [scoreStatus, setScoreStatus] = useState({});
  const [inviteForm, setInviteForm] = useState({
    role_id: '',
    templateType: 'prebuilt',
    subject: '',
    custom_body: '',
  });
  const [scoreRoleId, setScoreRoleId] = useState('');
  const [scoring, setScoring] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchJobRoles = useCallback(async () => {
    try {
      const r = await fetch('/api/source/job-roles', { credentials: 'include' });
      const d = await r.json();
      setJobRoles(d.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.pool !== 'all') params.set('pool', filters.pool);
      if (filters.location) params.set('location', filters.location);
      if (filters.min_exp > 0) params.set('min_exp', filters.min_exp);
      params.set('sort_by', filters.sort_by);
      if (filters.role_id) {
        params.set('role_id', filters.role_id);
        params.set('limit', filters.limit);
      } else {
        // Fetch a large number of candidates for the global directory view
        params.set('limit', 5000);
      }
      // No limit when no role_id is selected - fetch all candidates

      const r = await fetch(`/api/source/candidates/search?${params}`, { credentials: 'include' });
      const d = await r.json();
      setCandidates(d.data || []);
      setTotalCandidates(d.total_count ?? (d.data || []).length);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const r = await fetch('/api/source/candidates/activity?limit=10', { credentials: 'include' });
      const d = await r.json();
      if (r.ok && d.success) {
        setActivities(d.data || []);
      }
    } catch { /* silent */ }
    finally { setLoadingActivities(false); }
  }, []);

  useEffect(() => { fetchJobRoles(); }, [fetchJobRoles]);
  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // ── Prevent Accidental Tab Closure During Upload ───────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome to show the prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  useEffect(() => {
    if (currentTab === 'home') {
      fetchActivities();
    }
  }, [currentTab, fetchActivities]);

  const fetchActiveJob = useCallback(async () => {
    try {
      const r = await fetch('/api/source/candidates/bulk-upload/active');
      if (r.ok) {
        const d = await r.json();
        if (d.success && d.data && d.data.job) {
          setBulkJobId(d.data.job.id);
          setBulkJobProgress(d.data);
        } else if (d.success && !d.data) {
          setBulkJobId(null);
          setBulkJobProgress(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active bulk upload job', err);
    }
  }, []);

  // Resume tracking an active bulk upload job if we refresh the page
  useEffect(() => {
    fetchActiveJob();
  }, [fetchActiveJob]);

  // Poll bulk upload progress
  useEffect(() => {
    if (!bulkJobId) return;

    const fetchProgress = async () => {
      try {
        const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}`);
        const d = await r.json();
        if (r.ok && d.success) {
          setBulkJobProgress(d.data);
          const stats = d.data.items_stats || [];
          const totalProcessed = stats
            .filter(s => s.status !== 'pending' && s.status !== 'processing')
            .reduce((acc, curr) => acc + curr.count, 0);
          const job = d.data.job;

          if (job && (job.status === 'cancelled' || job.status === 'failed' || (job.total_files > 0 && totalProcessed >= job.total_files))) {
             setBulkJobId(null);
             if (job.status === 'completed' || (job.total_files > 0 && totalProcessed >= job.total_files)) {
                 toast.success('Bulk processing complete');
                 fetchCandidates();
             }
             setBulkJobProgress(null);
             return;
          }
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [bulkJobId, fetchCandidates]);

  // ── Filter candidates client-side ──
  const filteredCandidates = candidates.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = c.full_name?.toLowerCase().includes(term);
    const emailMatch = c.email?.toLowerCase().includes(term);
    const designationMatch = c.current_designation?.toLowerCase().includes(term);
    const locationMatch = c.location?.toLowerCase().includes(term);
    const skillStrings = [
      ...(Array.isArray(c.skills) ? c.skills : []),
      ...(Array.isArray(c.structured_skills) ? c.structured_skills.map(s => s.skill_name || s.name) : [])
    ];
    const skillMatch = skillStrings.some(s => s?.toLowerCase().includes(term));
    return nameMatch || emailMatch || designationMatch || locationMatch || skillMatch;
  });

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggle = (id) => setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const allSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id));
  
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.add(c.id));
        return next;
      });
    }
  };
  const clearSel = () => setSelectedIds(new Set());

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt', '.zip'];
    let validCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const error = validateFile(file, validExtensions, null, file.name);
        if (error) {
            toast.error(error);
            setUploading(false);
            if (e.target) e.target.value = '';
            return;
        }
        const cleanFile = new File([file], file.name, { type: file.type });
        fd.append('files', cleanFile);
        validCount++;
    }
    if (validCount === 0) {
        toast.error('No supported files found (PDF, DOCX, TXT, ZIP)');
        setUploading(false);
        if (e.target) e.target.value = '';
        return;
    }
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/source/candidates/bulk-upload');
        xhr.withCredentials = true;
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          try {
            const d = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              toast.success(d.message || `Queued ${validCount} file(s) for AI processing!`);
              if (d.data?.job_id) {
                setBulkJobId(d.data.job_id);
                setBulkJobProgress(null);
              }
              setShowUpload(false);
              resolve();
            } else {
              toast.error(d.detail || 'Upload failed');
              reject(new Error(d.detail || 'Upload failed'));
            }
          } catch { reject(new Error('Invalid server response')); }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
      });
    } catch (err) { toast.error('Upload error: ' + (err?.message || 'Unknown')); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    await handleUpload(e);
  };

  const handleCancelQueue = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/cancel`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Queue cancelled successfully');
        setBulkJobId(null);
        setBulkJobProgress(null);
      } else {
        toast.error('Failed to cancel queue');
      }
    } catch {
      toast.error('Error cancelling queue');
    }
  };

  const handlePauseQueue = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/pause`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Queue paused successfully');
        fetchActiveJob();
      } else {
        toast.error('Failed to pause queue');
      }
    } catch {
      toast.error('Error pausing queue');
    }
  };

  const handleResumeQueue = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/resume`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Queue resumed successfully');
        fetchActiveJob();
      } else {
        toast.error('Failed to resume queue');
      }
    } catch {
      toast.error('Error resuming queue');
    }
  };

  const handleRetryFailed = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/retry-failed`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Failed items queued for retry');
        fetchActiveJob();
      } else {
        toast.error('Failed to retry items');
      }
    } catch {
      toast.error('Error retrying items');
    }
  };

  // ── Create / Edit job role ────────────────────────────────────────────────────────
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!newRole.title.trim()) return toast.error('Role title is required');
    if (!isNonNegativeNumber(newRole.min_experience)) return toast.error('Minimum experience must be 0 or greater');
    const isEdit = !!newRole.id;
    const url = isEdit ? `/api/source/job-roles/${newRole.id}` : '/api/source/job-roles';
    const method = isEdit ? 'PUT' : 'POST';
    
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });
      if (r.ok) {
        toast.success(isEdit ? 'Role updated' : 'Role created');
        setShowNewRole(false);
        setNewRole({ title: '', description: '', min_experience: 0 });
        fetchJobRoles();
      } else { toast.error(`Failed to ${isEdit ? 'update' : 'create'} role`); }
    } catch { toast.error('Error saving role'); }
  };

  const openEditRole = (r) => {
    setNewRole({
      id: r.id,
      title: r.title,
      description: r.description || '',
      min_experience: r.min_experience || 0,
      required_skills: Array.isArray(r.required_skills) ? r.required_skills : [],
    });
    setNewSkillInput({ name: '', level: 'intermediate' });
    setShowNewRole(true);
  };

  const addSkillToRole = () => {
    const name = newSkillInput.name.trim();
    if (!name) return;
    const already = newRole.required_skills.some(s => s.skill.toLowerCase() === name.toLowerCase());
    if (already) { toast.error('Skill already added'); return; }
    setNewRole(r => ({ ...r, required_skills: [...r.required_skills, { skill: name, level: newSkillInput.level }] }));
    setNewSkillInput(s => ({ ...s, name: '' }));
  };

  const removeSkillFromRole = (idx) => {
    setNewRole(r => ({ ...r, required_skills: r.required_skills.filter((_, i) => i !== idx) }));
  };

  const fetchScoreStatus = async (roleId) => {
    if (!roleId) return;
    try {
      const r = await fetch(`/api/source/job-roles/${roleId}/score-status`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setScoreStatus(prev => ({ ...prev, [roleId]: d.data }));
    } catch { /* non-fatal */ }
  };

  // ── Bulk AI score ──────────────────────────────────────────────────────────
  const handleScore = async (e) => {
    e.preventDefault();
    if (!scoreRoleId) return toast.error('Select a role');
    setScoring(true);
    try {
      const r = await fetch('/api/source/score-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: parseInt(scoreRoleId), candidate_ids: [...selectedIds] }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`Scored ${d.data.length} candidates`);
        setShowScore(false);
        clearSel();
        fetchCandidates();
      } else { toast.error(d.detail || 'Scoring failed'); }
    } catch { toast.error('Scoring interrupted'); }
    finally { setScoring(false); }
  };

  // ── Send invite ────────────────────────────────────────────────────────────
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.role_id) return toast.error('Select a role');
    if (inviteForm.templateType === 'custom' && (!inviteForm.subject.trim() || !inviteForm.custom_body.trim())) {
      return toast.error('Custom invite requires both subject and email body');
    }
    const ids = [...selectedIds];
    
    const payload = {
      candidate_ids: ids,
      job_role_id: parseInt(inviteForm.role_id),
    };
    
    if (inviteForm.templateType === 'custom') {
      if (inviteForm.subject) payload.subject = inviteForm.subject;
      if (inviteForm.custom_body) payload.custom_body = inviteForm.custom_body;
    }

    const tid = toast.loading('Sending invites...');
    try {
      const r = await fetch('/api/source/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || `Invited ${ids.length} candidate(s)!`, { id: tid });
        setShowInvite(false);
        clearSel();
        fetchCandidates();
        fetchActivities();
      } else {
        toast.error(d.detail || 'Invitation failed', { id: tid });
      }
    } catch {
      toast.error('Invitation error', { id: tid });
    }
  };

  const handleCancelInvite = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to cancel the invite for ${ids.length} candidate(s)? This will unlink their user account if they are a trainee and convert them back to an active candidate.`)) return;

    const tid = toast.loading('Cancelling invites...');
    try {
      const r = await fetch('/api/source/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: ids }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || `Cancelled invites for ${ids.length} candidate(s)!`, { id: tid });
        clearSel();
        fetchCandidates();
        fetchActivities();
      } else {
        toast.error(d.detail || 'Cancel failed', { id: tid });
      }
    } catch {
      toast.error('Cancel error', { id: tid });
    }
  };

  const handleAutoRank = async (roleId) => {
    if (!roleId) return;
    setAutoRanking(true);
    const tid = toast.loading('Searching through resumes for matches...');
    try {
      const r = await fetch(`/api/source/job-roles/${roleId}/auto-rank`, { method: 'POST' });
      if (r.ok) {
        toast.success('Auto-ranking complete!', { id: tid });
        if (filters.role_id === roleId) fetchCandidates();
      } else {
        toast.error('Auto-ranking failed', { id: tid });
      }
    } catch {
      toast.error('Process interrupted', { id: tid });
    } finally {
      setAutoRanking(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this candidate permanently?')) return;
    try {
      await fetch(`/api/source/candidates/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      if (drawerCandidate?.id === id) setDrawerCandidate(null);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      fetchCandidates();
    } catch { toast.error('Delete failed'); }
  };

  const anySelected = selectedIds.size > 0;
  const setTab = (tab) => navigate(`/source?tab=${tab}`);

  // Calculate stats for home dashboard
  const favouriteCount = candidates.filter(c => c.status?.toLowerCase() === 'favourite').length;
  const invitedCount = candidates.filter(c => c.status?.toLowerCase() === 'invited').length;
  const archivedCount = candidates.filter(c => c.status?.toLowerCase() === 'archived').length;
  const hiredCount = candidates.filter(c => c.status?.toLowerCase() === 'hired').length;
  const newCount = candidates.filter(c => !c.status || c.status?.toLowerCase() === 'new').length;
  const rejectedCount = candidates.filter(c => c.status?.toLowerCase() === 'rejected').length;

  // Calculate today's stats
  const today = new Date().toISOString().split('T')[0];
  const resumesUploadedToday = candidates.filter(c => c.created_at?.startsWith(today)).length;
  const invitationsSentToday = activities.filter(a => {
    return a.created_at?.startsWith(today) && a.action?.toLowerCase().includes('invite');
  }).length;

  return (
    <div className="dashboard-page light-theme-override" style={{ backgroundColor: '#FAF8FF' }}>
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>
        <div className="top-center">
          <div className="hub-tabs">
            {appModules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${location.pathname.startsWith(m.path) ? "active" : ""}`}
                onClick={() => navigate(m.path)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="top-right">
          <img src={bellIcon} className="icon" alt="bell" />
          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            onClick={() => { logout(); navigate('/login'); }}
          />
          <div className="profile-wrap">
            <div className="avatar">{displayName?.charAt(0)?.toUpperCase()}</div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="sidebar">
          <button className={currentTab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Home</button>
          <button className={currentTab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Jobs</button>
          <button className={currentTab === 'directory' ? 'active' : ''} onClick={() => setTab('directory')}>Directory</button>
          <button className={currentTab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>Upload</button>
          <button className={currentTab === 'offers' ? 'active' : ''} onClick={() => setTab('offers')}>Offer Approvals</button>
          <button className={currentTab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active Pipeline</button>
        </div>
        
        <div className="content" style={{ backgroundColor: '#FAF8FF', padding: '24px' }}>
          <div className="flex flex-col gap-6 h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
            {currentTab === 'upload' ? 'RESUME PROCESSING' :
             currentTab === 'jobs' ? 'JOB MANAGEMENT' :
             currentTab === 'home' ? 'RECRUITMENT ANALYTICS' :
             currentTab === 'offers' ? 'OFFER MANAGEMENT' :
             currentTab === 'active' ? 'HIRING PIPELINE' :
             currentTab === 'invite-status' ? 'CANDIDATE INVITATIONS' :
             currentTab === 'archive' ? 'CANDIDATE ARCHIVE' :
             'CANDIDATE DATABASE'}
          </p>
          <h1 className="text-4xl font-black text-black tracking-tight leading-none">
            {currentTab === 'upload' ? (
              <>Resume Processing Center</>
            ) : currentTab === 'jobs' ? (
              <>Job Roles</>
            ) : currentTab === 'home' ? (
              <>Talent Acquisition Dashboard</>
            ) : currentTab === 'offers' ? (
              <>Offer Management</>
            ) : currentTab === 'active' ? (
              <>Hiring Pipeline</>
            ) : currentTab === 'invite-status' ? (
              <>Candidate Invitations</>
            ) : (
              <>Candidate Database</>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentTab === 'upload'
              ? 'Upload and process resumes for AI-powered candidate matching'
              : currentTab === 'jobs'
              ? `${jobRoles.length} active roles`
              : currentTab === 'offers' || currentTab === 'active' || currentTab === 'invite-status'
              ? `${user?.company_name || 'Source'} · Talent Acquisition`
              : `${searchTerm ? `${filteredCandidates.length} of ` : ''}${candidates.length} records · ${user?.company_name || 'Source'}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(currentTab === 'directory' || currentTab === 'home' || currentTab === 'jobs') && (
            <button
              onClick={() => { fetchCandidates(); fetchJobRoles(); }}
              className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <RefreshCw size={16} />
            </button>
          )}

          {currentTab === 'directory' && (
            <>
              <div className="relative w-64 md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Search name, email, role, skills..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  showFilters 
                    ? 'bg-purple-50 border-purple-300 text-purple-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Filter size={15} /> Filters
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
              >
                <Upload size={15} /> Upload Resume
              </button>
            </>
          )}

          {currentTab === 'jobs' && (
            <button
              onClick={() => { setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] }); setNewSkillInput({ name: '', level: 'intermediate' }); setShowNewRole(true); }}
              className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
            >
              <Plus size={15} /> Add Job Role
            </button>
          )}

          {currentTab === 'invite-status' && jobRoles.length > 0 && (
            <div className="flex items-center gap-3">
              <select
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                value={inviteStatusRoleId}
                onChange={e => { setInviteStatusRoleId(e.target.value); setShowInviteStatus(false); }}
              >
                <option value="">Select a role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
              {inviteStatusRoleId && (
                <button
                  onClick={() => setShowInviteStatus(true)}
                  className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
                >
                  View Invites
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Tab Content ── */}
      {currentTab === 'home' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-visible pt-2">
            {/* Total Candidates - Purple */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border-t-4 border-t-purple-600 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <UsersIcon size={20} className="text-purple-600" />
                <span className="text-xs font-medium text-purple-600">Total</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{totalCandidates}</h2>
              <p className="text-sm text-gray-500 mt-1">Total Candidates</p>
            </div>

            {/* Favourite - Amber/Orange */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border-t-4 border-t-amber-500 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <Star size={20} className="text-amber-500" />
                <span className="text-xs font-medium text-amber-500">Favourite</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{favouriteCount}</h2>
              <p className="text-sm text-gray-500 mt-1">Shortlisted Candidates</p>
            </div>

            {/* Invited - Indigo */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border-t-4 border-t-indigo-500 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <MailIcon size={20} className="text-indigo-500" />
                <span className="text-xs font-medium text-indigo-500">Invited</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{invitedCount}</h2>
              <p className="text-sm text-gray-500 mt-1">Active Invites</p>
            </div>

            {/* Archived - Gray */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border-t-4 border-t-[#e731ad] max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <Archive size={20} className="text-[#e731ad]" />
                <span className="text-xs font-medium text-[#e731ad]">Archived</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{archivedCount}</h2>
              <p className="text-sm text-gray-500 mt-1">Inactive Pool</p>
            </div>
          </div>

          {/* Row 2: Activity and Today's Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-purple-600" /> Today's Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-xs font-medium text-gray-500">Resumes Uploaded Today</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{resumesUploadedToday}</p>
                    <p className="text-xs text-gray-400 mt-1">Updated today</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-xs font-medium text-gray-500">Invitations Sent Today</p>
                    <p className="text-3xl font-bold text-amber-600 mt-2">{invitationsSentToday}</p>
                    <p className="text-xs text-gray-400 mt-1">Updated today</p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3">Weekly Activity</p>
                  <div className="flex items-end justify-between h-24 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                      const dayIndex = new Date().getDay();
                      const isToday = i === dayIndex - 1;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className={`w-full rounded-t-md transition-all duration-500 ${
                              isToday ? 'bg-purple-500' : 'bg-purple-200 hover:bg-purple-400'
                            }`}
                            style={{ height: `${Math.random() * 80 + 20}%` }}
                          ></div>
                          <span className={`text-[10px] ${isToday ? 'text-purple-600 font-semibold' : 'text-gray-400'}`}>
                            {day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-full">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-purple-600" /> Recent Activity
                </h3>
                
                <div className="space-y-4 max-h-[280px] overflow-y-auto">
                  {loadingActivities ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
                      <Loader2 size={16} className="animate-spin text-purple-600" />
                      <span className="text-sm font-medium">Loading feed...</span>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400 gap-2">
                      <Clock size={24} className="opacity-50" />
                      <p className="text-sm font-medium">No activities logged</p>
                    </div>
                  ) : (
                    activities.slice(0, 5).map((act) => {
                      const dateStr = act.created_at ? new Date(act.created_at).toLocaleString() : 'Just now';
                      
                      let Icon = Activity;
                      let iconColor = 'bg-gray-100 text-gray-500';
                      const action = act.action?.toLowerCase();
                      if (action?.includes('invite')) {
                        Icon = MailIcon;
                        iconColor = 'bg-indigo-50 text-indigo-600';
                      } else if (action?.includes('create') || action?.includes('upload')) {
                        Icon = UserPlus;
                        iconColor = 'bg-purple-50 text-purple-600';
                      } else if (action?.includes('status') || action?.includes('shortlist') || action?.includes('archive')) {
                        Icon = Zap;
                        iconColor = 'bg-amber-50 text-amber-600';
                      } else if (action?.includes('score') || action?.includes('rank')) {
                        Icon = Star;
                        iconColor = 'bg-emerald-50 text-emerald-600';
                      }
                      
                      return (
                        <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800">{act.candidate_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{act.detail || act.action}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">{act.actor_name || 'System'}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-300" />
                              <span className="text-xs text-gray-400">{dateStr}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Job Openings and Recruitment Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BriefcaseIcon size={16} className="text-purple-600" /> Job Openings
              </h3>
              <div className="space-y-3">
                {jobRoles.slice(0, 4).map(role => (
                  <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{role.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Min Exp: {role.min_experience} yrs</p>
                    </div>
                    <span className="text-sm font-medium text-purple-600">
                      {candidates.filter(c => c.role_id === role.id).length} candidates
                    </span>
                  </div>
                ))}
                {jobRoles.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">No job roles created yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart size={16} className="text-purple-600" /> Recruitment Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <UserPlus size={20} className="text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{totalCandidates}</p>
                  <p className="text-xs text-gray-500">Candidates Added</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <MailIcon size={20} className="text-indigo-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{invitedCount}</p>
                  <p className="text-xs text-gray-500">Invitations Sent</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <FileText size={20} className="text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{hiredCount}</p>
                  <p className="text-xs text-gray-500">Offers Issued</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <CheckCircleIcon size={20} className="text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{hiredCount}</p>
                  <p className="text-xs text-gray-500">Hires Completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : currentTab === 'jobs' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {jobRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
              <Briefcase size={48} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">No active roles</p>
                <p className="text-sm text-gray-500">Click Add Role to define a job requisition</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {jobRoles.map(r => (
                <div key={r.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col">
                  <div className="flex w-full items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 pr-2">{r.title}</h3>
                    <button onClick={() => openEditRole(r)} className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
                      <Edit size={14} />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-purple-600 mt-1 mb-2">Min Exp: {r.min_experience} yrs</p>
                  {/* Required Skills chips */}
                  {Array.isArray(r.required_skills) && r.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {r.required_skills.slice(0, 6).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          {s.skill || s}
                        </span>
                      ))}
                      {r.required_skills.length > 6 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">+{r.required_skills.length - 6} more</span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">{r.description || 'No description provided.'}</p>
                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-600">{candidates.filter(c => c.role_id === r.id).length} candidates</p>
                    <button
                      onClick={() => { handleAutoRank(r.id); fetchScoreStatus(r.id); }}
                      disabled={autoRanking}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                      <Zap size={12} /> Re-rank
                    </button>
                  </div>
                  {scoreStatus[r.id] && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      {scoreStatus[r.id].scored_count} scored
                      {scoreStatus[r.id].last_scored_at ? ` · ${new Date(scoreStatus[r.id].last_scored_at).toLocaleString()}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : currentTab === 'upload' ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-6">
          <div className="bg-white w-full max-w-xl rounded-2xl p-8 border border-gray-200 shadow-sm relative">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Upload size={24} className="text-purple-600"/> Resume Processing Center
            </h2>
            
            {/* Upload Area - Click anywhere to upload files/folders */}
            <div 
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all group flex flex-col items-center cursor-pointer ${
                isDragging ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {/* Hidden file inputs - supports files and folders */}
              <input 
                type="file" 
                ref={fileRef} 
                onChange={handleUpload} 
                className="hidden" 
                accept=".pdf,.doc,.docx,.txt,.zip" 
                multiple 
              />
              <input 
                type="file" 
                ref={folderRef} 
                onChange={handleUpload} 
                className="hidden" 
                webkitdirectory="true" 
                directory="true" 
                multiple 
              />
              
              {/* Upload Icon - Clickable */}
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform cursor-pointer">
                {uploading ? (
                  <div className="relative flex items-center justify-center w-14 h-14">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#E9D5FF" strokeWidth="10" />
                      <circle 
                        cx="50" cy="50" r="40" fill="none" stroke="#9333EA" strokeWidth="10" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 - (251.2 * (uploadProgress || 1)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-300 ease-out"
                      />
                    </svg>
                  </div>
                ) : (
                  <Upload size={32} className="text-purple-600" />
                )}
              </div>
              
              <p className="text-gray-800 font-semibold text-base mb-2">
                {uploading ? 'Queueing Files...' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-sm text-gray-500">Supported: PDF, DOCX, TXT, ZIP · Upload files or entire folders</p>
              
              {/* Hidden hint - click the icon or the box */}
              <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> Single files
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> Entire folders
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> ZIP archives
                </span>
              </div>
            </div>
          </div>
          
          {/* Bulk Upload Progress */}
          {bulkJobId && (
            <div className="bg-white w-full max-w-xl rounded-2xl p-6 border border-purple-200 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 left-0 h-1 bg-purple-100 w-full">
              {bulkJobProgress?.job?.status === 'extracting' ? (
                // Indeterminate animated bar during the extracting phase
                <div className="h-full bg-purple-400 animate-pulse" style={{ width: '100%' }} />
              ) : bulkJobProgress?.job?.total_files > 0 ? (
                <div 
                  className={`h-full transition-all duration-500 ${
                    bulkJobProgress?.job?.status === 'paused' ? 'bg-amber-500' : 'bg-purple-600'
                  }`} 
                  style={{ width: `${((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100}%` }}
                ></div>
              ) : null}
           </div>
           <div className="flex justify-between items-center mb-4 mt-1">
             <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                {bulkJobProgress?.job?.status === 'paused' ? (
                  <>
                    <Pause size={14} className="text-amber-500" /> Queue Paused
                  </>
                ) : bulkJobProgress?.job?.status === 'extracting' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-purple-600" /> Scanning &amp; Queueing Files...
                  </>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin text-purple-600" /> Processing Candidates
                  </>
                )}
             </h3>
             {bulkJobProgress?.job?.status === 'extracting' ? (
               <span className="text-sm font-semibold text-purple-600">
                 {bulkJobProgress?.job?.total_files > 0 ? `${bulkJobProgress.job.total_files} queued` : 'Scanning...'}
               </span>
             ) : bulkJobProgress?.job?.total_files > 0 ? (
               <span className={`text-sm font-semibold ${
                 bulkJobProgress?.job?.status === 'paused' ? 'text-amber-600' : 'text-purple-600'
               }`}>
                 {Math.round(((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100)}%
               </span>
             ) : null}
               </div>
               {(() => {
                  const failedCount = bulkJobProgress?.items_stats?.find(s => s.status === 'failed')?.count || 0;
                  if (failedCount > 0) {
                    return (
                      <div className="flex items-center gap-3 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <span className="text-red-400 font-medium">
                          {failedCount} file(s) failed
                        </span>
                        <button
                          onClick={handleRetryFailed}
                          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-md text-sm font-medium transition-colors"
                        >
                          Retry Failed
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
               <div className="flex flex-wrap gap-3">
                  {bulkJobProgress?.items_stats?.map(st => (
                     <div key={st.status} className="bg-gray-50 px-4 py-2 rounded-lg text-sm border border-gray-100 flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          st.status === 'success' ? 'bg-emerald-500' : 
                          st.status === 'failed' ? 'bg-rose-500' : 
                          st.status === 'pending' ? 'bg-gray-300' : 'bg-amber-500'
                        }`}></div>
                        <span className="text-gray-500 font-medium mr-2">{st.status}:</span>
                        <span className="text-gray-800 font-semibold">{st.count}</span>
                     </div>
                  ))}
               </div>
               <div className="flex justify-between items-center mt-6">
                 <p className="text-xs text-gray-500">Total Files Discovered: {bulkJobProgress?.job?.total_files || '...'}</p>
                 <div className="flex gap-3 items-center">
                   {bulkJobProgress?.job?.status === 'paused' ? (
                     <button onClick={handleResumeQueue} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                       <Play size={12} /> Resume
                     </button>
                   ) : (
                     <button onClick={handlePauseQueue} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                       <Pause size={12} /> Pause
                     </button>
                   )}
                   <button onClick={handleCancelQueue} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium transition-colors">
                     Cancel Queue
                   </button>
                 </div>
               </div>
            </div>
          )}
        </div>
      ) : currentTab === 'offers' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <OfferApprovals />
        </div>
      ) : currentTab === 'active' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ActiveCandidates onViewProfile={(c) => setDrawerCandidate(c)} />
        </div>
      ) : currentTab === 'invite-status' ? (
        <div className="flex-1 flex items-center justify-center">
          {!inviteStatusRoleId ? (
            <div className="bg-white rounded-2xl flex flex-col items-center justify-center gap-4 py-16 px-12 border border-gray-200 shadow-sm max-w-md w-full">
              <Briefcase size={40} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">Select a Job Role</p>
                <p className="text-sm text-gray-500">Choose a role from the dropdown above to view invite tracking.</p>
              </div>
              <select
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors mt-2"
                value={inviteStatusRoleId}
                onChange={e => { setInviteStatusRoleId(e.target.value); setShowInviteStatus(e.target.value !== ''); }}
              >
                <option value="">Select a role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500">Role selected. Click <span className="text-purple-600 font-semibold">View Invites</span> in the header.</p>
            </div>
          )}
          {showInviteStatus && inviteStatusRoleId && (
            <InviteStatus
              roleId={inviteStatusRoleId}
              roleName={jobRoles.find(r => String(r.id) === String(inviteStatusRoleId))?.title}
              onClose={() => setShowInviteStatus(false)}
            />
          )}
        </div>
      ) : (
        <>
          {/* ── Filter Bar ── */}
          {showFilters && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end shrink-0">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Job Role</label>
            <div className="flex items-center gap-2">
              <select
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                value={filters.role_id}
                onChange={e => setFilters(f => ({ ...f, role_id: e.target.value }))}
              >
                <option value="">All Roles</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <select
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
              value={filters.pool}
              onChange={e => setFilters(f => ({ ...f, pool: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="favourite">Favourite</option>
              <option value="invited">Invited</option>
              <option value="hired">Hired</option>
              <option value="archived">Archived</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Min. Experience (yrs)</label>
            <input
              type="number" min={0} max={30}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors w-36"
              value={filters.min_exp}
              onChange={e => setFilters(f => ({ ...f, min_exp: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Location</label>
            <input
              type="text" placeholder="City or Remote"
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
              value={filters.location}
              onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Sort By</label>
            <select
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
              value={filters.sort_by}
              onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}
            >
              <option value="newest">Newest</option>
              <option value="experience">Experience</option>
              {filters.role_id && <option value="fit_score">Fit Score</option>}
            </select>
          </div>

          {filters.role_id && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">Show</label>
              <select
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                value={filters.limit}
                onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value) }))}
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          <button
            onClick={fetchCandidates}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
          >
            Apply
          </button>
          <button
            onClick={() => setFilters(initFilters)}
            className="px-5 py-2.5 text-gray-500 rounded-xl text-sm font-medium hover:text-gray-700 transition-colors duration-150"
          >
            Reset
          </button>
          {filters.role_id && (
            <button
              onClick={() => handleAutoRank(filters.role_id)}
              disabled={autoRanking}
              className="px-6 py-2.5 ml-auto bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors duration-150 flex items-center gap-2 shadow-sm"
            >
              {autoRanking ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Auto Score All
            </button>
          )}
        </div>
      )}

      {/* ── Candidate Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Table header */}
        <div className={`grid ${filters.role_id ? 'grid-cols-[40px_1fr_110px_100px_120px_110px_56px]' : 'grid-cols-[40px_1fr_100px_120px_110px_56px]'} gap-4 px-6 py-4 border-b border-gray-100 text-xs font-medium text-gray-500 shrink-0`}>
          <div className="flex items-center justify-center">
            <button
              onClick={toggleAll}
              className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${allSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 hover:border-purple-400'}`}
            >
              {allSelected && <CheckSquare size={12} />}
            </button>
          </div>
          <div>Candidate</div>
          {filters.role_id && <div className="text-center">AI Fit Score</div>}
          <div className="text-center">Experience</div>
          <div className="text-center">Status</div>
          <div>Location</div>
          <div />
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-gray-500">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span className="text-sm font-medium">Syncing directory...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <Database size={48} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">Directory is empty</p>
                <p className="text-sm text-gray-500">Upload resumes to get started</p>
              </div>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <Search size={48} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">No matches found</p>
                <p className="text-sm text-gray-500">Try adjusting your search query</p>
              </div>
            </div>
          ) : (
            filteredCandidates.map(c => (
              <div
                key={c.id}
                onClick={() => setDrawerCandidate(c)}
                className={`grid ${filters.role_id ? 'grid-cols-[40px_1fr_110px_100px_120px_110px_56px]' : 'grid-cols-[40px_1fr_100px_120px_110px_56px]'} gap-4 px-6 py-4 items-center cursor-pointer transition-colors duration-150 group ${drawerCandidate?.id === c.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center" onClick={e => { e.stopPropagation(); toggle(c.id); }}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedIds.has(c.id) ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 hover:border-purple-400'}`}>
                    {selectedIds.has(c.id) && <CheckSquare size={12} />}
                  </div>
                </div>

                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center font-semibold text-sm text-purple-700 group-hover:border-purple-300 transition-colors shrink-0">
                    {(c.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{c.full_name || '—'}</p>
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                  </div>
                </div>

                {/* Score */}
                {filters.role_id && (
                  <div className="flex justify-center">
                    <span className={`px-3 py-1 rounded-lg border text-sm font-semibold ${SCORE_COLOR(c.fit_score)}`}>
                      {c.fit_score != null ? `${Math.round(c.fit_score)}%` : '—'}
                    </span>
                  </div>
                )}

                {/* Exp */}
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">{c.total_experience_years ?? '—'} yrs</span>
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <span className={`px-3 py-1 rounded-lg border text-xs font-medium ${STATUS_STYLE[c.status?.toLowerCase()] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {c.status || 'New'}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-gray-500 min-w-0">
                  <MapPin size={12} className="shrink-0" />
                  <span className="text-xs truncate">{c.location || 'N/A'}</span>
                </div>

                {/* Delete */}
                <div className="flex justify-center" onClick={e => handleDelete(c.id, e)}>
                  <button className="p-2 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-150 opacity-0 group-hover:opacity-100">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}

      {/* ── Bulk Action Bar ── */}
      {anySelected && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-8 py-4 bg-white rounded-2xl border border-purple-200 shadow-2xl">
          <span className="text-sm font-semibold text-purple-600">{selectedIds.size} selected</span>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => setShowScore(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors duration-150"
          >
            <Star size={14} /> Score vs Role
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors duration-150"
          >
            <Send size={14} /> Send Invite
          </button>
          <button
            onClick={async () => {
              if(!confirm('Are you sure you want to delete these candidates?')) return;
              try {
                const r = await fetch('/api/source/candidates/bulk-delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ candidate_ids: Array.from(selectedIds) }),
                  credentials: 'include'
                });
                if(r.ok) {
                  toast.success('Candidates deleted successfully');
                  setSelectedIds(new Set());
                  fetchCandidates();
                } else {
                  toast.error('Failed to delete candidates');
                }
              } catch(e) {
                toast.error('Error deleting candidates');
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-100 hover:border-rose-300 transition-colors duration-150"
          >
            <Trash2 size={14} /> Delete
          </button>

          <button onClick={clearSel} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Candidate Profile Drawer ── */}
      <CandidateDrawer
        candidate={drawerCandidate}
        jobRoles={jobRoles}
        roleId={filters.role_id}
        onClose={() => setDrawerCandidate(null)}
        onRefresh={fetchCandidates}
      />

      {/* ── Upload Modal ── */}
      {showUpload && (
        <Modal onClose={() => setShowUpload(false)} title="Upload Resume">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={handleUpload} multiple />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-6 w-full border-2 border-dashed border-gray-300 rounded-2xl p-16 hover:border-purple-400 hover:bg-purple-50/50 transition-colors duration-150 cursor-pointer"
          >
            {uploading ? (
              <><Loader2 size={40} className="text-purple-600 animate-spin" /><p className="text-sm font-medium text-gray-700">Processing resume...</p></>
            ) : (
              <><Upload size={40} className="text-purple-400" /><div><p className="text-base font-semibold text-gray-800 mb-1">Click to select file(s)</p><p className="text-sm text-gray-500">PDF, DOC, DOCX, TXT, ZIP</p></div></>
            )}
          </button>
        </Modal>
      )}

      {/* ── New / Edit Role Modal ── */}
      {showNewRole && (
        <Modal onClose={() => setShowNewRole(false)} title={newRole.id ? "Edit Job Role" : "Create Job Role"}>
          <form onSubmit={handleSaveRole} className="flex flex-col gap-5">
            <Field label="Role Title *">
              <input required className="form-input" placeholder="e.g. Senior Backend Engineer" value={newRole.title} onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} />
            </Field>
            <Field label="Description">
              <textarea rows={3} className="form-input resize-none" placeholder="Describe requirements..." value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))} />
            </Field>
            <Field label="Min. Experience (years)">
              <input type="number" min={0} className="form-input" value={newRole.min_experience} onChange={e => setNewRole(r => ({ ...r, min_experience: parseInt(e.target.value) || 0 }))} />
            </Field>

            {/* Skills Builder */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Required Skills</label>
              {/* Existing skill chips */}
              {newRole.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {newRole.required_skills.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      {s.skill} <span className="text-purple-400">▸</span> {s.level}
                      <button type="button" onClick={() => removeSkillFromRole(i)} className="ml-1 text-purple-400 hover:text-purple-700"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              {/* Add new skill row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Skill name e.g. Python"
                  value={newSkillInput.name}
                  onChange={e => setNewSkillInput(s => ({ ...s, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkillToRole(); } }}
                />
                <select
                  className="form-input w-36"
                  value={newSkillInput.level}
                  onChange={e => setNewSkillInput(s => ({ ...s, level: e.target.value }))}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <button
                  type="button"
                  onClick={addSkillToRole}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  + Add
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Press Enter or click Add. All candidates will be auto-ranked against these skills after saving.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowNewRole(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm">
                {newRole.id ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Score Modal ── */}
      {showScore && (
        <Modal onClose={() => setShowScore(false)} title={`Score ${selectedIds.size} candidate${selectedIds.size > 1 ? 's' : ''}`}>
          <form onSubmit={handleScore} className="flex flex-col gap-5">
            <p className="text-sm text-gray-500">Run AI fit analysis for selected candidates against a job role.</p>
            <Field label="Job Role *">
              <select required className="form-input" value={scoreRoleId} onChange={e => setScoreRoleId(e.target.value)}>
                <option value="">Select role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowScore(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" disabled={scoring} className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-sm">
                {scoring ? 'Scoring...' : 'Run AI Score'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)} title={`Invite ${selectedIds.size} candidate${selectedIds.size > 1 ? 's' : ''}`}>
          <form onSubmit={handleInvite} className="flex flex-col gap-5">
            <Field label="Job Role *">
              <select required className="form-input" value={inviteForm.role_id} onChange={e => setInviteForm(f => ({ ...f, role_id: e.target.value }))}>
                <option value="">Select role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </Field>
            
            <Field label="Invitation Email Template">
              <select
                className="form-input"
                value={inviteForm.templateType}
                onChange={e => setInviteForm(f => ({ ...f, templateType: e.target.value }))}
              >
                <option value="prebuilt">Pre-built (Default Phygitron 360 Template)</option>
                <option value="custom">Custom Template</option>
              </select>
            </Field>

            {inviteForm.templateType === 'custom' && (
              <>
                <Field label="Email Subject">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Invitation to complete pre-employment assessment"
                    value={inviteForm.subject}
                    onChange={e => setInviteForm(f => ({ ...f, subject: e.target.value }))}
                  />
                </Field>
                <Field label="Email Body (Markdown supported)">
                  <textarea
                    rows={5}
                    className="form-input resize-none"
                    placeholder={`Dear {candidate_name},\n\nWe invite you to take the assessment for {role}.\nYour temporary password is: {temp_password}\nLink: {assessment_link}`}
                    value={inviteForm.custom_body}
                    onChange={e => setInviteForm(f => ({ ...f, custom_body: e.target.value }))}
                  />
                  <div className="text-xs text-gray-500 leading-relaxed mt-1">
                    <strong>Guidelines:</strong> You can use these tokens:
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li><code className="text-purple-600">{`{candidate_name}`}</code> - Full name</li>
                      <li><code className="text-purple-600">{`{role}`}</code> - Job role title</li>
                      <li><code className="text-purple-600">{`{org_name}`}</code> - Organisation name</li>
                      <li><code className="text-purple-600">{`{assessment_link}`}</code> - URL to access the portal</li>
                      <li><code className="text-purple-600">{`{temp_password}`}</code> - Temporary password</li>
                    </ul>
                  </div>
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">Send Invites</button>
            </div>
          </form>
        </Modal>
      )}

        </div>
      </div>
    </div>

      {/* Global Floating Progress Widget (when not on upload tab) */}
      {(bulkJobId || uploading) && currentTab !== 'upload' && (
        <div 
          className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-xl shadow-xl border border-purple-200 p-4 cursor-pointer hover:shadow-2xl transition-all"
          onClick={() => setTab('upload')}
        >
           <div className="flex justify-between items-center mb-2">
             <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                {uploading ? (
                  <><Upload size={12} className="text-purple-600 animate-bounce" /> Uploading ZIP...</>
                ) : bulkJobProgress?.job?.status === 'paused' ? (
                  <><Pause size={12} className="text-amber-500" /> Paused</>
                ) : bulkJobProgress?.job?.status === 'extracting' ? (
                  <><Loader2 size={12} className="animate-spin text-purple-600" /> Scanning ZIP</>
                ) : (
                  <><Loader2 size={12} className="animate-spin text-purple-600" /> Processing Resumes</>
                )}
             </h4>
             {uploading ? (
               <span className="text-xs font-bold text-purple-600">
                 {Math.round(uploadProgress || 0)}%
               </span>
             ) : bulkJobProgress?.job?.status === 'extracting' ? (
               <span className="text-xs font-semibold text-purple-600">
                 {bulkJobProgress?.job?.total_files > 0 ? `${bulkJobProgress.job.total_files} queued` : '...'}
               </span>
             ) : bulkJobProgress?.job?.total_files > 0 ? (
               <span className={`text-xs font-bold ${
                 bulkJobProgress?.job?.status === 'paused' ? 'text-amber-600' : 'text-purple-600'
               }`}>
                 {Math.round(((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100)}%
               </span>
             ) : null}
           </div>
           
           <div className="w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
              {uploading ? (
                <div 
                  className="h-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${uploadProgress || 0}%` }}
                ></div>
              ) : bulkJobProgress?.job?.status === 'extracting' ? (
                <div className="h-full bg-purple-400 animate-pulse w-full"></div>
              ) : bulkJobProgress?.job?.total_files > 0 ? (
                <div 
                  className={`h-full transition-all duration-500 ${
                    bulkJobProgress?.job?.status === 'paused' ? 'bg-amber-500' : 'bg-purple-600'
                  }`} 
                  style={{ width: `${((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100}%` }}
                ></div>
              ) : null}
           </div>
           <p className="text-[10px] text-gray-400 mt-2 font-medium">Click to view details</p>
        </div>
      )}

    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────
function Modal({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl p-8 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}