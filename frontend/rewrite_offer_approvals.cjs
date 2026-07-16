const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/source/OfferApprovals.jsx');

let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables
content = content.replace(
  "const canSend = ['hr', 'org_admin', 'super_admin'].includes(user?.role);",
  "const canSend = ['hr', 'org_admin', 'super_admin'].includes(user?.role);\n  const [selectedOffer, setSelectedOffer] = useState(null);"
);
content = content.replace(
  "const [loadingLifecycle, setLoadingLifecycle] = useState(false);",
  "const [loadingLifecycle, setLoadingLifecycle] = useState(false);\n  const [selectedLifecycleCandidate, setSelectedLifecycleCandidate] = useState(null);"
);

// 2. Clear state on fetch
content = content.replace(
  "if (activeTab !== 'offer_letters') return;\n    setLoading(true);",
  "if (activeTab !== 'offer_letters') return;\n    setLoading(true);\n    setSelectedOffer(null);"
);
content = content.replace(
  "if (activeTab !== 'lifecycle_tracking') return;\n    setLoadingLifecycle(true);",
  "if (activeTab !== 'lifecycle_tracking') return;\n    setLoadingLifecycle(true);\n    setSelectedLifecycleCandidate(null);"
);
content = content.replace(
  "  useEffect(() => {\n    if (activeTab === 'offer_letters')",
  "  useEffect(() => {\n    setSelectedOffer(null);\n    setSelectedLifecycleCandidate(null);\n    if (activeTab === 'offer_letters')"
);

// 3. Rewrite the Offer Letters rendering block
const offerLettersMapStart = `          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            {offers.map((offer) => {`;
const offerLettersMapNewStart = `          ) : selectedOffer ? (
            <div>
              <button className="btn btn-ghost" onClick={() => setSelectedOffer(null)} style={{ marginBottom: 20 }}>
                ← Back to List
              </button>
              {(() => {
                const offer = selectedOffer;`;
content = content.replace(offerLettersMapStart, offerLettersMapNewStart);

const offerLettersMapEnd = `              );
            })}
          </div>
          )
        ) : (
          /* Lifecycle Tracking Tab */`;
const offerLettersMapNewEnd = `              );
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
          /* Lifecycle Tracking Tab */`;
content = content.replace(offerLettersMapEnd, offerLettersMapNewEnd);

// 4. Rewrite the Lifecycle Tracking rendering block
const lifecycleMapFull = `          ) : (
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
                    <Link to={\`/source/candidates/\${cand.id}\`} className="btn btn-sm btn-ghost" style={{ color: 'var(--primary)' }}>
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )`;
const lifecycleMapNewFull = `          ) : selectedLifecycleCandidate ? (
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
          )`;
content = content.replace(lifecycleMapFull, lifecycleMapNewFull);

fs.writeFileSync(file, content);
console.log('Done rewriting OfferApprovals.jsx');
