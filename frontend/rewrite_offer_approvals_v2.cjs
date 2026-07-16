const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/source/OfferApprovals.jsx');

let content = fs.readFileSync(file, 'utf8');

// I will replace everything from `<div className="page-body">` to the end of the file.
const startIndex = content.indexOf('<div className="page-body">');
const beforeBody = content.substring(0, startIndex);

const newBody = `<div className="page-body">
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
                            <Link to={\`/source/candidates/\${offer.candidate_id}\`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                              View Profile
                            </Link>
                            {!isEditing && (offer.status === 'pending' || offer.status === 'changes_requested') && (
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditing(offer)} style={{ fontSize: '0.75rem' }}>
                                Edit Details
                              </button>
                            )}
                            <span className={\`badge badge-\${offer.status === 'pending' ? 'info' : offer.status === 'approved' ? 'success' : offer.status === 'changes_requested' ? 'warning' : 'danger'}\`}>
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
                                  value={(editForm.offer_content?.body_paragraphs || []).join('\\n\\n')}
                                  onChange={(e) => setEditForm({
                                    ...editForm, 
                                    offer_content: { ...editForm.offer_content, body_paragraphs: e.target.value.split('\\n\\n') }
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
                                  {(offer.offer_content.body_paragraphs || []).join('\\n\\n')}
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
                      <span className={\`badge badge-\${offer.status === 'pending' ? 'info' : offer.status === 'approved' ? 'success' : offer.status === 'changes_requested' ? 'warning' : 'danger'}\`}>
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
                          <Link to={\`/source/candidates/\${selectedLifecycleCandidate.id}\`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                            View Full Profile
                          </Link>
                          <span className="badge badge-info">
                            {lifecyclePhase.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: 24, background: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 16 }}>
                        INVITATION CONTENT PREVIEW
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem' }}>
                        <div style={{ fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                          Subject: Assessment Invitation
                        </div>
                        <div>Dear {selectedLifecycleCandidate.name},</div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                          You have been invited to complete a technical assessment for the role you applied for.
                          
                          Please log in to your portal using the credentials provided in your official email to begin.
                          
                          We look forward to reviewing your application.
                        </div>
                        <div style={{ marginTop: 8, color: '#334155' }}>
                          Regards,<br/>
                          <strong>EWANDZ Talent Acquisition Team</strong>
                        </div>
                      </div>
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
\n`;

fs.writeFileSync(file, beforeBody + newBody);
console.log("Successfully rewrote the page body!");
