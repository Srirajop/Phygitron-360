import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sourceApi, verifyApi } from '../../api';
import { ArrowLeft, MapPin, Clock, Star, AlertTriangle, ExternalLink, Calendar, X, FileText, Download, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_COLOR = { beginner: 'badge-muted', intermediate: 'badge-info', advanced: 'badge-primary', expert: 'badge-success' };
const FLAGGED_COPY = [
  'Needs project proof',
  'Verify hands-on depth',
  'Evidence is thin',
  'Ask for implementation detail',
  'Confirm ownership',
];

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function tidyConfidenceReason(flag, index) {
  const skill = flag.skill || 'This skill';
  const raw = String(flag.reason || '').trim();
  const genericMissing = /^no evidence of .+ usage in (project descriptions|projects) or work history$/i;

  if (raw && !genericMissing.test(raw)) return raw;

  if ((flag.claimed_years || 0) > (flag.supported_years || 0)) {
    return `${flag.claimed_years}y claimed, but the resume only supports about ${flag.supported_years || 0}y from described work.`;
  }

  return [
    `${skill} is listed, but the resume does not tie it to a named project, employer outcome, or shipped deliverable.`,
    `The profile mentions ${skill}, yet the work history lacks enough detail to judge real implementation depth.`,
    `${skill} needs follow-up because the resume gives a keyword, not a concrete example of use.`,
  ][index % 3];
}

function isGenericConfidenceFlag(flag) {
  const reason = String(flag.reason || '').trim();
  return (
    /^no evidence of .+ usage in (project descriptions|projects) or work history$/i.test(reason) ||
    ((flag.claimed_years || 0) > 0 && (flag.supported_years || 0) === 0)
  );
}

function buildEvidenceChecks(confidenceSignals, skills = []) {
  const flagged = [];
  const supported = [];
  const seen = new Set();

  confidenceSignals.forEach((flag, index) => {
    const skill = String(flag.skill || '').trim();
    if (!skill) return;
    const key = skill.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const item = {
      ...flag,
      skill,
      reason: tidyConfidenceReason(flag, index),
      label: FLAGGED_COPY[index % FLAGGED_COPY.length],
      generic: isGenericConfidenceFlag(flag),
    };

    if (flag.flag) flagged.push(item);
    else supported.push(item);
  });

  skills
    .filter(skill => skill.evidence && !seen.has(String(skill.name || '').toLowerCase()))
    .slice(0, 3)
    .forEach(skill => supported.push({
      skill: skill.name,
      reason: skill.evidence,
      label: 'Resume-backed',
      supported_years: skill.years_of_use || 0,
    }));

  const genericFlags = flagged.filter(f => f.generic);
  const specificFlags = flagged.filter(f => !f.generic);
  const shouldGroupGeneric = genericFlags.length >= 3;
  const groupedReview = shouldGroupGeneric ? {
    skills: genericFlags.map(f => f.skill),
    count: genericFlags.length,
    claimedYears: [...new Set(genericFlags.map(f => f.claimed_years).filter(Boolean))],
    supportedYears: Math.max(...genericFlags.map(f => f.supported_years || 0), 0),
  } : null;
  const visibleFlags = shouldGroupGeneric ? specificFlags : flagged;

  return {
    flagged: visibleFlags.slice(0, 4),
    hiddenCount: Math.max(0, visibleFlags.length - 4),
    groupedReview,
    supported: supported.slice(0, 3),
  };
}

export default function CandidateProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ job_role_id: '', deadline: '' });
  const [jobRoles, setJobRoles] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ salary: '', role_title: '', department: '', location: 'Office', start_date: '', recipient_email: '' });
  const [converting, setConverting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [results, setResults] = useState([]);
  const [showAllGroupedFlags, setShowAllGroupedFlags] = useState(false);

  const openInviteModal = () => {
    sourceApi.listJobRoles().then(r => setJobRoles(r.data.data)).catch(console.error);
    setInviteForm(f => ({ ...f, email: data.user?.email || '' }));
    setShowInvite(true);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.job_role_id) return toast.error('Please select a job role');
    if (!inviteForm.email) return toast.error('Please provide an email address');
    setInviting(true);
    try {
      await sourceApi.sendInvite({ 
        candidate_ids: [parseInt(id)], 
        job_role_id: parseInt(inviteForm.job_role_id), 
        deadline: inviteForm.deadline || undefined,
        email_addresses: [inviteForm.email]
      });
      toast.success('Assessment Invite sent! ✉️', { duration: 4000 });
      setShowInvite(false);
      setData(prev => ({ ...prev, status: 'invited' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };
 
  const handleConvert = async (e) => {
    e.preventDefault();
    if (!convertForm.salary || !convertForm.role_title || !convertForm.department) return toast.error('Please fill required fields');
    setPreviewing(true);
    try {
      const r = await sourceApi.previewOfferLetter(id, convertForm);
      setPreviewData(r.data.data);
      setShowPreview(true);
      setShowConvert(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to generate preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setConverting(true);
    try {
      await sourceApi.convertToEmployee(id, { ...convertForm, offer_content: previewData });
      toast.success('Hired! Employee created and Offer Letter sent! 🎊');
      setShowPreview(false);
      const r = await sourceApi.getCandidate(id);
      setData(r.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleRevert = async () => {
    if (!data.employee_id) return;
    if (!window.confirm('Are you sure you want to revert this employee back to a candidate? This will delete the employee record.')) return;
    
    setReverting(true);
    try {
      await sourceApi.revertToCandidate(data.employee_id);
      toast.success('Employee reverted back to Candidate! ♻️');
      // Refresh data
      const r = await sourceApi.getCandidate(id);
      setData(r.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Revert failed');
    } finally {
      setReverting(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const roleId = queryParams.get('role_id');

    sourceApi.getCandidate(id, roleId ? { role_id: roleId } : undefined)
      .then(r => {
        setData(r.data.data);
        setConvertForm(f => ({ 
          ...f, 
          role_title: r.data.data.user?.job_role_title || '',
          recipient_email: r.data.data.user?.email || ''
        }));
      })
      .finally(() => setLoading(false));
    
    verifyApi.getUserResults(id)
      .then(r => setResults(r.data.data || []))
      .catch(e => console.error("Failed to fetch user results:", e));
  }, [id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body"><p>Candidate not found.</p></div>;

  const queryParams = new URLSearchParams(window.location.search);
  const roleId = queryParams.get('role_id');

  const fitScore = data.ai_scores?.find(s => s.type === 'role_fit');
  const confidence = data.ai_scores?.find(s => s.type === 'confidence_signals');
  const evidenceChecks = buildEvidenceChecks(parseJsonArray(confidence?.reasoning), data.skills || []);
  const groupedSkills = evidenceChecks.groupedReview?.skills || [];
  const visibleGroupedSkills = showAllGroupedFlags ? groupedSkills : groupedSkills.slice(0, 8);
  const resumeAtsScore = data.resume_ats_score ?? null;
  const atsColor = resumeAtsScore >= 70 ? '#10B981' : resumeAtsScore >= 40 ? '#F59E0B' : '#EF4444';

  let fitData = null;
  try { fitData = fitScore ? JSON.parse(fitScore.reasoning) : null; } catch {}

  return (
    <div>
      <div className="page-header">
        <Link to="/source" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={16} /> Back to Candidates</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.5rem' }}>
            {data.user?.full_name?.[0] || '?'}
          </div>
          <div>
            <h1 style={{ marginBottom: 4 }}>{data.user?.full_name || 'Unknown'} <span style={{ fontWeight: 400, fontSize: '1rem', opacity: 0.7 }}>({data.type})</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {data.location && <span><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {data.location}</span>}
              {data.exp_years > 0 && <span><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {data.exp_years} years exp</span>}
              <span className={`badge badge-${data.status === 'active' ? 'success' : 'muted'}`}>{data.status}</span>
            </div>
          </div>
          {roleId && fitScore && (
            <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: fitScore.score >= 70 ? 'var(--success)' : fitScore.score >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{Math.round(fitScore.score)}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Role Fit Score</div>
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div>
            {/* Skills */}
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4>Skills Profile</h4></div>
              <div className="card-body">
                <div className="chip-list">
                  {data.skills?.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-lightest)', border: '1px solid var(--primary-lighter)', borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{s.name}</span>
                      <span className={`badge ${LEVEL_COLOR[s.level] || 'badge-muted'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{s.level}</span>
                      {s.years_of_use && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.years_of_use}y</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Fit Analysis */}
            {roleId && fitData && (

              <div className="card animate-fade-in stagger-2" style={{ marginBottom: 24 }}>
                <div className="card-header"><h4>🤖 AI Role Fit Analysis</h4></div>
                <div className="card-body">
                  <p style={{ marginBottom: 16 }}>{fitData.summary}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--success)', fontSize: '0.85rem' }}>✅ Matched Skills</div>
                      <div className="chip-list">{(fitData.matched_skills || []).map(s => <span key={s} className="skill-tag match">{s}</span>)}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--danger)', fontSize: '0.85rem' }}>❌ Missing Skills</div>
                      <div className="chip-list">{(fitData.missing_skills || []).map(s => <span key={s} className="skill-tag miss">{s}</span>)}</div>
                    </div>
                  </div>
                  {fitData.interview_questions?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary)', fontSize: '0.85rem' }}>💬 Suggested Interview Questions</div>
                      {fitData.interview_questions.map((q, i) => (
                        <div key={i} style={{ background: 'var(--primary-lightest)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8, fontSize: '0.875rem', borderLeft: '3px solid var(--primary)' }}>
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test History */}
            <div className="card animate-fade-in stagger-3" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>🏆 Test History</h4>
                {results.some(r => r.is_malpractice) && <span className="badge badge-danger">⚠️ Malpractice Detected</span>}
              </div>
              <div className="card-body">
                {results.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    <Calendar size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
                    <p>No assessment data available for this candidate.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table style={{ width: '100%', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '12px 0' }}>Assessment</th>
                          <th style={{ textAlign: 'left', padding: '12px 0' }}>Date</th>
                          <th style={{ textAlign: 'center', padding: '12px 0' }}>Score</th>
                          <th style={{ textAlign: 'right', padding: '12px 0' }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => (
                          <tr key={r.result_id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 0', fontWeight: 600 }}>{r.title}</td>
                            <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 0', textAlign: 'center' }}>
                              {r.is_malpractice ? (
                                <span style={{ color: 'var(--danger)', fontWeight: 800 }}>0.0% ⚠️</span>
                              ) : (
                                r.score != null ? `${r.score.toFixed(1)}%` : <span className="text-muted">Grading...</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 0', textAlign: 'right' }}>
                              <span className={`badge ${r.is_malpractice ? 'badge-danger' : (r.pass_status ? 'badge-success' : 'badge-danger')}`}>
                                {r.is_malpractice ? 'MALPRACTICE' : (r.pass_status ? 'PASS' : 'FAIL')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            {/* Resume ATS Score */}
            <div className="card animate-fade-in" style={{ marginBottom: 24, border: `1px solid ${atsColor}30`, background: `${atsColor}08` }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>Resume ATS Score</div>
                <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 12px' }}>
                  <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={atsColor} strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - (resumeAtsScore || 0) / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: atsColor }}>{resumeAtsScore != null ? Math.round(resumeAtsScore) : '—'}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {resumeAtsScore >= 70 ? '✅ Strong profile. Likely to pass initial ATS screening.' :
                   resumeAtsScore >= 40 ? '⚠️ Moderate profile. Needs stronger skill depth.' :
                   '❌ Weak profile. Resume may be filtered out by ATS systems.'}
                </div>
                <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-around' }}>
                  <div><div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{data.skills?.length || 0}</div><div>Skills</div></div>
                  <div><div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{data.exp_years || 0}y</div><div>Experience</div></div>
                </div>
              </div>
            </div>
            {/* Evidence Checks */}
            {(evidenceChecks.groupedReview || evidenceChecks.flagged.length > 0 || evidenceChecks.supported.length > 0) && (
              <div className="card animate-fade-in" style={{ marginBottom: 24, border: '1px solid rgba(245,158,11,0.35)', background: 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)' }}>
                <div className="card-header" style={{ borderColor: 'rgba(245,158,11,0.18)' }}>
                  <h4 style={{ color: '#92400E', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><AlertTriangle size={16} /> Evidence Checks</h4>
                  <div style={{ fontSize: '0.78rem', color: '#92400E', opacity: 0.78 }}>
                    Resume claims that deserve a closer read before shortlisting.
                  </div>
                </div>
                <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                  {(evidenceChecks.groupedReview || evidenceChecks.flagged.length > 0) && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Needs Review</span>
                        <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                          {(evidenceChecks.groupedReview?.count || 0) + evidenceChecks.flagged.length + evidenceChecks.hiddenCount} checks
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {evidenceChecks.groupedReview && (
                          <div style={{ border: '1px solid rgba(245,158,11,0.24)', background: 'rgba(255,255,255,0.78)', borderRadius: 8, padding: '12px' }}>
                            <div style={{ color: '#78350F', fontSize: '0.88rem', fontWeight: 800, marginBottom: 8 }}>
                              Cluster of unsupported AI/ML keywords
                            </div>
                            <div style={{ color: '#92400E', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: 10 }}>
                              The resume lists these as experience, but the parsed projects/work history do not show concrete implementation details. Treat them as interview follow-ups, not confirmed strengths.
                            </div>
                            <div className="chip-list" style={{ marginBottom: 10 }}>
                              {visibleGroupedSkills.map(skill => (
                                <span key={skill} className="skill-tag" style={{ fontSize: '0.7rem', padding: '3px 8px', background: '#FFF7ED', color: '#9A3412', borderColor: '#FED7AA' }}>{skill}</span>
                              ))}
                              {groupedSkills.length > 8 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllGroupedFlags(v => !v)}
                                  className="skill-tag"
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '3px 8px',
                                    background: '#FFFFFF',
                                    color: '#92400E',
                                    borderColor: '#FDBA74',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                  }}
                                >
                                  {showAllGroupedFlags ? 'Show less' : `+${groupedSkills.length - 8} more`}
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'grid', gap: 6, fontSize: '0.76rem', color: '#A16207', fontWeight: 700 }}>
                              <span>Ask for one shipped project, the candidate's exact ownership, and production impact.</span>
                              {evidenceChecks.groupedReview.claimedYears.length > 0 && (
                                <span>Claimed tenure: {evidenceChecks.groupedReview.claimedYears.join(', ')}y; resume-backed tenure: {evidenceChecks.groupedReview.supportedYears}y.</span>
                              )}
                            </div>
                          </div>
                        )}
                        {evidenceChecks.flagged.map((f, i) => (
                          <div key={`${f.skill}-${i}`} style={{ border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(255,255,255,0.72)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                              <strong style={{ color: '#78350F', fontSize: '0.86rem' }}>{f.skill}</strong>
                              <span className="badge badge-muted" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>{f.label}</span>
                            </div>
                            <div style={{ color: '#92400E', fontSize: '0.8rem', lineHeight: 1.45 }}>{f.reason}</div>
                            {(f.claimed_years || f.supported_years) ? (
                              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.7rem', color: '#A16207', fontWeight: 700 }}>
                                <span>Claimed: {f.claimed_years || 0}y</span>
                                <span>Supported: {f.supported_years || 0}y</span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {evidenceChecks.hiddenCount > 0 && (
                        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>
                          +{evidenceChecks.hiddenCount} more low-evidence claims grouped to keep this panel readable.
                        </div>
                      )}
                    </div>
                  )}

                  {evidenceChecks.supported.length > 0 && (
                    <div style={{ borderTop: evidenceChecks.flagged.length ? '1px solid rgba(245,158,11,0.16)' : 'none', paddingTop: evidenceChecks.flagged.length ? 12 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#047857', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <CheckCircle2 size={14} /> Supported Evidence
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {evidenceChecks.supported.map((f, i) => (
                          <div key={`${f.skill}-supported-${i}`} style={{ display: 'flex', gap: 8, color: '#065F46', fontSize: '0.8rem', lineHeight: 1.4 }}>
                            <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                            <span><strong>{f.skill}:</strong> {f.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="card animate-fade-in stagger-2">
              <div className="card-body">
                <h4 style={{ marginBottom: 16 }}>Actions</h4>
                {data.resume_url && (
                  <button onClick={() => setShowResume(true)} className="btn btn-secondary btn-block" style={{ marginBottom: 8, gap: 8 }}>
                    <FileText size={14} /> View Resume
                  </button>
                )}
                {data.status !== 'archived' ? (
                  <>
                    <button onClick={openInviteModal} className="btn btn-primary btn-block" style={{ marginTop: 8 }}>
                      Send Assessment Invite
                    </button>
                    <button onClick={() => setShowConvert(true)} className="btn btn-shimmer btn-block" style={{ marginTop: 12, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' }}>
                      Convert to Employee
                    </button>
                  </>
                ) : (
                  data.employee_id && (
                    <button onClick={handleRevert} className="btn btn-ghost btn-block" style={{ marginTop: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={reverting}>
                      {reverting ? 'Reverting...' : 'Reset to Candidate'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Send Assessment Invite</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Send an assessment invitation to {data.user?.full_name || 'this candidate'}.
                </p>
                <div className="form-group">
                  <label className="form-label">Candidate Email *</label>
                  <input type="email" required className="form-control" value={inviteForm.email || ''} onChange={e => setInviteForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Role *</label>
                  <select required className="form-control" value={inviteForm.job_role_id} onChange={e => setInviteForm(f => ({...f, job_role_id: e.target.value}))}>
                    <option value="">Select a job role...</option>
                    {jobRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <div className="form-date-group">
                    <Calendar size={18} className="calendar-icon" />
                    <input type="date" className="form-control" value={inviteForm.deadline} onChange={e => setInviteForm(f => ({...f, deadline: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {showConvert && (
        <div className="modal-overlay" onClick={() => setShowConvert(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Hire Candidate</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConvert(false)}>✕</button>
            </div>
            <form onSubmit={handleConvert}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  This will convert <strong>{data.user?.full_name}</strong> to an Employee and automatically send the Job Offer Letter.
                </p>
                <div className="form-group">
                  <label className="form-label">Recipient Email *</label>
                  <input type="email" required className="form-control" placeholder="candidate@example.com" value={convertForm.recipient_email} onChange={e => setConvertForm(f => ({...f, recipient_email: e.target.value}))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Role Title *</label>
                    <input required className="form-control" value={convertForm.role_title} onChange={e => setConvertForm(f => ({...f, role_title: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <input required className="form-control" placeholder="e.g. Engineering" value={convertForm.department} onChange={e => setConvertForm(f => ({...f, department: e.target.value}))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Salary / CTC *</label>
                    <input required className="form-control" placeholder="e.g. $80k or ₹12LPA" value={convertForm.salary} onChange={e => setConvertForm(f => ({...f, salary: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className="form-control" value={convertForm.location} onChange={e => setConvertForm(f => ({...f, location: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <div className="form-date-group">
                    <Calendar size={18} className="calendar-icon" />
                    <input type="date" className="form-control" value={convertForm.start_date} onChange={e => setConvertForm(f => ({...f, start_date: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowConvert(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={previewing} style={{ background: '#10B981', borderColor: '#10B981' }}>
                  {previewing ? 'Generating...' : 'Generate Offer Letter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Review Offer Letter</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <form onSubmit={handleFinalSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Review and edit the AI-generated offer letter before sending it to the candidate.
                </p>
                
                <div className="form-group">
                  <label className="form-label">Recipient Email *</label>
                  <input type="email" required className="form-control" value={convertForm.recipient_email} onChange={e => setConvertForm(f => ({...f, recipient_email: e.target.value}))} />
                  <small style={{ color: 'var(--text-muted)' }}>The offer letter will be sent to this address.</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Subject</label>
                  <input required className="form-control" value={previewData.subject} onChange={e => setPreviewData({...previewData, subject: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label">Salutation</label>
                  <input required className="form-control" value={previewData.salutation} onChange={e => setPreviewData({...previewData, salutation: e.target.value})} />
                </div>

                <div className="form-group">
                  <label className="form-label">Letter Body</label>
                  <textarea 
                    required 
                    className="form-control" 
                    style={{ minHeight: 300, lineHeight: 1.6 }} 
                    value={previewData.body_paragraphs.join('\n\n')} 
                    onChange={e => setPreviewData({...previewData, body_paragraphs: e.target.value.split('\n\n')})}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Separate paragraphs with a double line break.</small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Closing</label>
                    <input required className="form-control" value={previewData.closing} onChange={e => setPreviewData({...previewData, closing: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Signatory Name</label>
                    <input required className="form-control" value={previewData.signatory_name} onChange={e => setPreviewData({...previewData, signatory_name: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Signatory Title</label>
                  <input required className="form-control" value={previewData.signatory_title} onChange={e => setPreviewData({...previewData, signatory_title: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowPreview(false); setShowConvert(true); }}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={converting} style={{ background: '#10B981', borderColor: '#10B981' }}>
                  {converting ? 'Sending...' : 'Confirm & Send Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resume Viewer Modal */}
      {showResume && data.resume_url && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }} onClick={() => setShowResume(false)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={18} color="white" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>Resume — {data.user?.full_name}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={data.resume_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: 'white', gap: 6, fontSize: '0.8rem' }}>
                <Download size={14} /> Download
              </a>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowResume(false)} style={{ color: 'white' }}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, padding: 16 }} onClick={e => e.stopPropagation()}>
            <iframe
              src={data.resume_url}
              title="Resume Viewer"
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: 'white' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
