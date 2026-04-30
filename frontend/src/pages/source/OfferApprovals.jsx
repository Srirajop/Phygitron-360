import React, { useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { CheckCircle, XCircle, Clock, Mail, Briefcase, DollarSign, MapPin, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OfferApprovals() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await sourceApi.listOffers(filterStatus);
      setOffers(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [filterStatus]);

  const startEditing = (offer) => {
    setEditingId(offer.id);
    setEditForm({ ...offer });
  };

  const handleUpdate = async () => {
    try {
      await sourceApi.updateOffer(editingId, editForm);
      toast.success('Offer updated');
      setEditingId(null);
      fetchOffers();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve and send this offer letter?')) return;
    try {
      await sourceApi.approveOffer(id);
      toast.success('Offer approved and sent!');
      fetchOffers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Approval failed');
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

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Offer Letter Approvals</h1>
          <p>Review and release offer letters submitted by HR</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            className="form-control" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="pending">Pending Review</option>
            <option value="approved">Approved / Sent</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : offers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              <Clock size={32} />
            </div>
            <h4>No {filterStatus} offers found</h4>
            <p>Once HR generates an offer letter, it will appear here for your review.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            {offers.map((offer) => {
              const isEditing = editingId === offer.id;
              const current = isEditing ? editForm : offer;

              return (
                <div key={offer.id} className="card" style={{ padding: 0, overflow: 'hidden', border: isEditing ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', minHeight: 220 }}>
                    {/* Left Section: Candidate & Summary */}
                    <div style={{ flex: 1, padding: 24, borderRight: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{offer.candidate_name}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                            <Mail size={14} /> {offer.candidate_email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {!isEditing && offer.status === 'pending' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => startEditing(offer)} style={{ fontSize: '0.75rem' }}>
                              Edit Details
                            </button>
                          )}
                          <span className={`badge badge-${offer.status === 'pending' ? 'info' : offer.status === 'approved' ? 'success' : 'danger'}`}>
                            {offer.status.toUpperCase()}
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

                    {/* Right Section: Content Review & Actions */}
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
                                value={editForm.offer_content.subject} 
                                placeholder="Subject"
                                onChange={(e) => setEditForm({
                                  ...editForm, 
                                  offer_content: { ...editForm.offer_content, subject: e.target.value }
                                })}
                              />
                              <textarea 
                                className="form-control" 
                                rows={8}
                                value={(editForm.offer_content.body_paragraphs || []).join('\n\n')}
                                onChange={(e) => setEditForm({
                                  ...editForm, 
                                  offer_content: { ...editForm.offer_content, body_paragraphs: e.target.value.split('\n\n') }
                                })}
                                style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                              />
                            </div>
                          ) : offer.offer_content ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ fontWeight: 800, borderBottom: '1px solid #f1f5f9', pb: 8 }}>
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
                        ) : offer.status === 'pending' ? (
                          <>
                            <button 
                              className="btn btn-primary" 
                              style={{ flex: 1, gap: 8 }}
                              onClick={() => handleApprove(offer.id)}
                            >
                              <CheckCircle size={18} /> Approve & Send
                            </button>
                            <button 
                              className="btn btn-ghost" 
                              style={{ color: 'var(--danger)', gap: 8 }}
                              onClick={() => handleReject(offer.id)}
                            >
                              <XCircle size={18} /> Reject
                            </button>
                          </>
                        ) : (
                          <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, padding: '10px', border: '1px dashed var(--border)', borderRadius: 8 }}>
                            Action Taken: {offer.status.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
