const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/source/OfferApprovals.jsx');

let content = fs.readFileSync(file, 'utf8');

// I need to add states for invite handling
content = content.replace(
  "const [selectedLifecycleCandidate, setSelectedLifecycleCandidate] = useState(null);",
  `const [selectedLifecycleCandidate, setSelectedLifecycleCandidate] = useState(null);
  const [inviteDetails, setInviteDetails] = useState(null);
  const [editingInvite, setEditingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(null);`
);

// I need to add the fetch logic for invite
content = content.replace(
  "const handleUpdate = async () => {",
  `const fetchInviteDetails = async (candId) => {
    try {
      const res = await sourceApi.getCandidateInvite(candId);
      setInviteDetails(res.data.data);
      if (lifecyclePhase === 'invite_pending') {
        setEditingInvite(true);
        setInviteForm(res.data.data.invite_content || { subject: '', body_paragraphs: [] });
      } else {
        setEditingInvite(false);
      }
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

  const handleUpdate = async () => {`
);

// I need to add "invite_pending" to the select box
content = content.replace(
  `<option value="invite_sent">Invitation Sent</option>`,
  `<option value="invite_pending">Pending Invitations</option>
                  <option value="invite_sent">Invitation Sent</option>`
);

// I need to replace the static INVITATION CONTENT PREVIEW with the dynamic one
const newPreviewBlock = `                      <div style={{ flex: 1, padding: 24, background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 16, textTransform: 'uppercase' }}>
                          {lifecyclePhase === 'invite_pending' ? 'EDIT INVITATION DRAFT' : 'INVITATION CONTENT PREVIEW'}
                        </div>
                        {inviteDetails ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem', flex: 1 }}>
                            {editingInvite ? (
                              <>
                                <input 
                                  className="form-control" 
                                  value={inviteForm?.subject || ''} 
                                  placeholder="Subject"
                                  onChange={(e) => setInviteForm({ ...inviteForm, subject: e.target.value })}
                                />
                                <textarea 
                                  className="form-control" 
                                  rows={10}
                                  value={(inviteForm?.body_paragraphs || []).join('\\n\\n')}
                                  onChange={(e) => setInviteForm({ ...inviteForm, body_paragraphs: e.target.value.split('\\n\\n') })}
                                  style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                                />
                                <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 12 }}>
                                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleUpdateInvite}>
                                    Save Changes
                                  </button>
                                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDispatchInvite} disabled={isSubmitting}>
                                    {isSubmitting ? 'Sending...' : 'Approve & Send'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                                  Subject: {inviteDetails.invite_content?.subject || 'Assessment Invitation'}
                                </div>
                                <div>Dear {selectedLifecycleCandidate.name},</div>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155' }}>
                                  {(inviteDetails.invite_content?.body_paragraphs || []).join('\\n\\n')}
                                </div>
                                <div style={{ marginTop: 8, color: '#334155' }}>
                                  Regards,<br/>
                                  <strong>EWANDZ Talent Acquisition Team</strong>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                           <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
                        )}
                      </div>`;

const searchStart = `<div style={{ flex: 1, padding: 24, background: 'var(--bg-subtle)' }}>`;
const searchEnd = `Regards,<br/>
                            <strong>EWANDZ Talent Acquisition Team</strong>
                          </div>
                        </div>
                      </div>`;

const startIndex = content.indexOf(searchStart);
const endIndex = content.indexOf(searchEnd) + searchEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    fs.writeFileSync(file, before + newPreviewBlock + after);
    console.log("Successfully rewrote OfferApprovals.jsx");
} else {
    console.error("Could not find preview block bounds!");
}
