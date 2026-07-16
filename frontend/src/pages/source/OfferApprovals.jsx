import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, XCircle, Clock, Mail, Briefcase, DollarSign, MapPin, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OfferApprovals() {
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs: 'offer_letters' or 'lifecycle_tracking'
  const [activeTab, setActiveTab] = useState('offer_letters');
  
  // State for Offer Letters Tab
  const [filterStatus, setFilterStatus] = useState('pending');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isHr = user?.role === 'hr';
  const canApprove = ['org_admin', 'manager', 'super_admin'].includes(user?.role);
  const canSend = ['hr', 'org_admin', 'super_admin'].includes(user?.role);
  const [selectedOffer, setSelectedOffer] = useState(null);

  // State for Lifecycle Tracking Tab
  const [lifecyclePhase, setLifecyclePhase] = useState('invite_sent');
  const [lifecycleCandidates, setLifecycleCandidates] = useState([]);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [selectedLifecycleCandidate, setSelectedLifecycleCandidate] = useState(null);
  const [inviteDetails, setInviteDetails] = useState(null);
  const [editingInvite, setEditingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(null);

  const fetchOffers = async () => {
    if (activeTab !== 'offer_letters') return;
    setLoading(true);
    setSelectedOffer(null);
    try {
      const res = await sourceApi.listOffers(filterStatus);
      setOffers(res.data.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const fetchLifecycleCandidates = async () => {
    if (activeTab !== 'lifecycle_tracking') return;
    setLoadingLifecycle(true);
    setSelectedLifecycleCandidate(null);
    try {
      const res = await sourceApi.searchCandidates({ lifecycle_phase: lifecyclePhase, limit: 100 });
      setLifecycleCandidates(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load lifecycle candidates');
    } finally {
      setLoadingLifecycle(false);
    }
  };

  useEffect(() => {
    setSelectedOffer(null);
    setSelectedLifecycleCandidate(null);
    if (activeTab === 'offer_letters') fetchOffers();
    else if (activeTab === 'lifecycle_tracking') fetchLifecycleCandidates();
  }, [filterStatus, lifecyclePhase, activeTab]);

  const startEditing = (offer) => {
    setEditingId(offer.id);
    setEditForm({ ...offer });
  };

  const fetchInviteDetails = async (candId) => {
    try {
      const res = await sourceApi.getCandidateInvite(candId);
      setInviteDetails(res.data.data);
      setEditingInvite(false);
    } catch (err) {
      toast.error('Failed to load invitation details');
    }
  };

  useEffect(() => {
    if (selectedLifecycleCandidate) {
      fetchInviteDetails(selectedLifecycleCandidate.id);
    } else {
      setInviteDetails(null);
    }
  }, [selectedLifecycleCandidate]);
  
  const handleUpdateInvite = async () => {
    try {
      await sourceApi.updateInvite(inviteDetails.id, inviteForm);
      toast.success('Draft saved successfully!');
      fetchInviteDetails(selectedLifecycleCandidate.id);
    } catch (err) {
      toast.error('Failed to save draft');
    }
  };
  
  const handleDispatchInvite = async () => {
    if (!window.confirm('Are you sure you want to send this invitation to the candidate?')) return;
    setIsSubmitting(true);
    try {
      await sourceApi.dispatchInvite(inviteDetails.id);
      toast.success('Invitation Sent!');
      setSelectedLifecycleCandidate(null);
      fetchLifecycleCandidates();
    } catch (err) {
      toast.error('Failed to dispatch invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await sourceApi.updateOffer(editingId, editForm);
      toast.success('Offer details saved!');
      setEditingId(null);
      fetchOffers();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save changes';
      toast.error(msg);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this offer? Once approved, it will be locked and sent back to HR for final dispatch.')) return;
    try {
      await sourceApi.approveOffer(id);
      toast.success('Offer approved and locked!');
      fetchOffers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Approval failed');
    }
  };

  const handleRequestChanges = async (id) => {
    if (!feedback.trim()) return toast.error('Please provide feedback for changes');
    setIsSubmitting(true);
    try {
      await sourceApi.requestChangesOffer(id, feedback);
      toast.success('Feedback sent to HR');
      setFeedback('');
      fetchOffers();
    } catch (err) {
      toast.error('Failed to send feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this offer?')) return;
    try {
      await sourceApi.rejectOffer(id);
      toast.success('Offer rejected');
      fetchOffers();
    } catch (err) {
      toast.error('Rejection failed');
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this approved offer to the candidate now?')) return;
    setIsSubmitting(true);
    try {
      await sourceApi.sendOffer(id);
      toast.success('Offer sent to candidate');
      fetchOffers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{isHr ? 'Offer & Candidate Tracker' : 'Offer Tracker'}</h1>
          <p>{isHr ? 'Track candidate lifecycle phases and send offer letters' : 'Track Offers of Employees and Candidates'}</p>
        </div>
        
        {/* Only show these specific filters based on active tab */}
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'offer_letters' && (
            <select 
              className="form-control" 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="pending">Pending Review</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved / Ready</option>
              <option value="sent">Sent to Candidate</option>
              <option value="accepted">Accepted (Hired)</option>
              <option value="rejected">Rejected</option>
              <option value="revoked">Revoked</option>
            </select>
          )}

          {activeTab === 'lifecycle_tracking' && (
            <select 
              className="form-control" 
              value={lifecyclePhase} 
              onChange={(e) => setLifecyclePhase(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="invite_sent">Invitation Sent</option>
              <option value="invite_accepted">Invitation Accepted</option>
              <option value="invite_declined">Invitation Revoked</option>
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 24, padding: '0 24px' }}>
        <button 
          className={`btn btn-ghost ${activeTab === 'offer_letters' ? 'active' : ''}`}
          style={{ 
            borderRadius: 0, 
            borderBottom: activeTab === 'offer_letters' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'offer_letters' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'offer_letters' ? 600 : 400,
            padding: '12px 0',
            marginBottom: '-1px'
          }}
          onClick={() => setActiveTab('offer_letters')}
        >
          Employee Tracker
        </button>
        <button 
          className={`btn btn-ghost ${activeTab === 'lifecycle_tracking' ? 'active' : ''}`}
          style={{ 
            borderRadius: 0, 
            borderBottom: activeTab === 'lifecycle_tracking' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'lifecycle_tracking' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'lifecycle_tracking' ? 600 : 400,
            padding: '12px 0',
            marginBottom: '-1px'
          }}
          onClick={() => setActiveTab('lifecycle_tracking')}
        >
          Candidate Tracker
        </button>
      </div>

      <div className="page-body">
        {activeTab === 'offer_letters' ? (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : offers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <Clock size={32} />
              </div>
              <h4>No {filterStatus} offers found</h4>
              <p>{isHr ? 'Your generated offers will appear here once you create them from a candidate profile.' : 'Once HR generates an offer letter, it will appear here for your review.'}</p>
            </div>
          ) : selectedOffer ? (
            <div>
              <button className="btn btn-ghost" onClick={() => setSelectedOffer(null)} style={{ marginBottom: 20 }}>
                ← Back to List
              </button>
              {(() => {
                const offer = selectedOffer;
                const isEditing = editingId === offer.id;
                const current = isEditing ? editForm : offer;

                return (
                  <div className="card" style={{ padding: 0, overflow: 'hidden', border: isEditing ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', minHeight: 220 }}>
                      <div style={{ flex: 1, padding: 24, borderRight: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{offer.candidate_name}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                              <Mail size={14} /> 
                              {isEditing ? (
                                <input 
                                  className="form-control form-control-sm"
                                  style={{ width: 250, padding: '2px 8px', fontSize: '0.85rem' }}
                                  value={current.candidate_email || ''}
                                  onChange={(e) => setEditForm({...editForm, candidate_email: e.target.value})}
                                />
                              ) : (
                                offer.candidate_email
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Link to={`/source/candidates/${offer.candidate_id}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                              View Profile
                            </Link>
                            {!isEditing && (offer.status === 'pending' || offer.status === 'changes_requested') && (
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditing(offer)} style={{ fontSize: '0.75rem' }}>
                                Edit Details
                              </button>
                            )}
                            <span className={`badge badge-${offer.status === 'pending' ? 'info' : offer.status === 'approved' ? 'success' : offer.status === 'changes_requested' ? 'warning' : 'danger'}`}>
                              {(offer.status || 'UNKNOWN').replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f9ff', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Briefcase size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ROLE</div>
                              {isEditing ? (
                                <input 
                                  className="form-control form-control-sm" 
                                  value={current.role_title} 
                                  onChange={(e) => setEditForm({...editForm, role_title: e.target.value})}
                                />
                              ) : (
                                <div style={{ fontWeight: 700 }}>{offer.role_title}</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <DollarSign size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPENSATION</div>
                              {isEditing ? (
                                <input 
                                  className="form-control form-control-sm" 
                                  value={current.salary} 
                                  onChange={(e) => setEditForm({...editForm, salary: e.target.value})}
                                />
                              ) : (
                                <div style={{ fontWeight: 700 }}>{offer.salary}</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fdf4ff', color: '#86198f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Calendar size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>START DATE</div>
                              {isEditing ? (
                                <input 
                                  type="date"
                                  className="form-control form-control-sm" 
                                  value={current.start_date ? new Date(current.start_date).toISOString().split('T')[0] : ''} 
                                  onChange={(e) => setEditForm({...editForm, start_date: e.target.value})}
                                />
                              ) : (
                                <div style={{ fontWeight: 700 }}>{offer.start_date ? new Date(offer.start_date).toLocaleDateString() : 'TBD'}</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff7ed', color: '#9a3412', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MapPin size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOCATION</div>
                              {isEditing ? (
                                <input 
                                  className="form-control form-control-sm" 
                                  value={current.location} 
                                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                                />
                              ) : (
                                <div style={{ fontWeight: 700 }}>{offer.location || 'Remote'}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ width: 450, background: 'var(--bg-secondary)', padding: 24, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Offer Letter Content
                          </div>
                          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16, fontSize: '0.85rem', color: '#334155' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <input 
                                  className="form-control" 
                                  value={editForm.offer_content?.subject || ''} 
                                  placeholder="Subject"
                                  onChange={(e) => setEditForm({
                                    ...editForm, 
                                    offer_content: { ...editForm.offer_content, subject: e.target.value }
                                  })}
                                />
                                <textarea 
                                  className="form-control" 
                                  rows={8}
                                  value={(editForm.offer_content?.body_paragraphs || []).join('\n\n')}
                                  onChange={(e) => setEditForm({
                                    ...editForm, 
                                    offer_content: { ...editForm.offer_content, body_paragraphs: e.target.value.split('\n\n') }
                                  })}
                                  style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                                />
                              </div>
                            ) : offer.offer_content ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                                  Subject: {offer.offer_content.subject || 'N/A'}
                                </div>
                                <div>{offer.offer_content.salutation}</div>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                  {(offer.offer_content.body_paragraphs || []).join('\n\n')}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                  {offer.offer_content.closing}<br/>
                                  <strong>{offer.offer_content.signatory_name}</strong><br/>
                                  <span style={{ opacity: 0.7 }}>{offer.offer_content.signatory_title}</span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No detailed content generated.</span>
                            )}
                          </div>
                        </div>

                        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                          {isEditing ? (
                            <>
                              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdate}>Save Changes</button>
                              <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                            </>
                           ) : canApprove && offer.status === 'pending' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>FEEDBACK FOR CHANGES</label>
                                <textarea 
                                  className="form-control" 
                                  placeholder="E.g. Please increase the relocation bonus by $2k..."
                                  rows={2}
                                  value={feedback}
                                  onChange={(e) => setFeedback(e.target.value)}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ flex: 1, gap: 8 }}
                                  onClick={() => handleApprove(offer.id)}
                                >
                                  <CheckCircle size={18} /> Approve
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ flex: 1, gap: 8 }}
                                  onClick={() => handleRequestChanges(offer.id)}
                                  disabled={isSubmitting}
                                >
                                  <FileText size={18} /> Request Changes
                                </button>
                                <button 
                                  className="btn btn-ghost" 
                                  style={{ color: 'var(--danger)', gap: 8 }}
                                  onClick={() => handleReject(offer.id)}
                                >
                                  <XCircle size={18} /> Reject
                                </button>
                              </div>
                            </div>
                          ) : canSend && offer.status === 'approved' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                This offer has been approved and is ready to be sent to the candidate.
                              </div>
                              <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: 8 }}
                                onClick={() => handleSend(offer.id)}
                                disabled={isSubmitting}
                              >
                                <Mail size={18} /> {isSubmitting ? 'Sending...' : 'Send Offer'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ width: '100%' }}>
                              {offer.feedback && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: '0.85rem', color: '#92400e' }}>
                                  <strong>Feedback:</strong> {offer.feedback}
                                </div>
                              )}
                              <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, padding: '10px', border: '1px dashed var(--border)', borderRadius: 8 }}>
                                Status: {(offer.status || 'UNKNOWN').replace('_', ' ').toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {offers.map((offer) => (
                 <div key={offer.id} className="card" style={{ padding: 20 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                        {offer.candidate_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{offer.candidate_name}</h4>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{offer.role_title}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge badge-${offer.status === 'pending' ? 'info' : offer.status === 'approved' ? 'success' : offer.status === 'changes_requested' ? 'warning' : 'danger'}`}>
                        {(offer.status || 'UNKNOWN').replace('_', ' ').toUpperCase()}
                      </span>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--primary)' }} onClick={() => setSelectedOffer(offer)}>
                        View Offer
                      </button>
                    </div>
                 </div>
              ))}
            </div>
          )
        ) : (
          /* Lifecycle Tracking Tab */
          loadingLifecycle ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : lifecycleCandidates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <Clock size={32} />
              </div>
              <h4>No candidates found</h4>
              <p>No candidates are currently in the "{lifecyclePhase.replace('_', ' ')}" phase.</p>
            </div>
          ) : selectedLifecycleCandidate ? (
            <div>
              <button className="btn btn-ghost" onClick={() => setSelectedLifecycleCandidate(null)} style={{ marginBottom: 20 }}>
                ← Back to List
              </button>
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', minHeight: 220 }}>
                    <div style={{ flex: 1, padding: 24, borderRight: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{selectedLifecycleCandidate.name}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                            <Mail size={14} /> 
                            {selectedLifecycleCandidate.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Link to={`/source/candidates/${selectedLifecycleCandidate.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                            View Full Profile
                          </Link>
                          <span className="badge badge-info">
                            {lifecyclePhase.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: 24, background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 16, textTransform: 'uppercase' }}>
                        INVITATION CONTENT PREVIEW
                      </div>
                      {inviteDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem', flex: 1 }}>
                                <>
<div style={{ fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                                Subject: {inviteDetails.invite_content?.subject || 'Assessment Invitation'}
                              </div>
                              <div>Dear {selectedLifecycleCandidate.name},</div>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                                {(inviteDetails.invite_content?.body_paragraphs || []).join('\n\n')}
                              </div>
                              <div style={{ marginTop: 8, color: '#334155' }}>
                                Regards,<br/>
                                <strong>EWANDZ Talent Acquisition Team</strong>
                              </div>
                            </>
                          </div>
                      ) : (
                         <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {lifecycleCandidates.map((cand) => (
                <div key={cand.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                      {cand.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{cand.name}</h4>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{cand.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-info">{cand.type || 'Candidate'}</span>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--primary)' }} onClick={() => setSelectedLifecycleCandidate(cand)}>
                      View Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

