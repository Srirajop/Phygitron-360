import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\CandidateProfile.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Inject state variables
    state_injection = """  const [showInviteEditor, setShowInviteEditor] = useState(false);
  const [draftInviteId, setDraftInviteId] = useState(null);
  const [draftForm, setDraftForm] = useState(null);
"""
    if "setShowInviteEditor" not in content:
        content = content.replace("const [inviteForm, setInviteForm] = useState({ job_role_id: '', deadline: '' });\n", 
                                  "const [inviteForm, setInviteForm] = useState({ job_role_id: '', deadline: '' });\n" + state_injection)

    # 2. Replace handleInvite
    old_handle_invite = """  const handleInvite = async (e) => {
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
      toast.success('Assessment Invite sent! 🎉', { duration: 4000 });
      setShowInvite(false);
      setData(prev => ({ ...prev, status: 'invited' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };"""

    new_handle_invite = """  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.job_role_id) return toast.error('Please select a job role');
    if (!inviteForm.email) return toast.error('Please provide an email address');
    setInviting(true);
    try {
      const res = await sourceApi.sendInvite({ 
        candidate_ids: [parseInt(id)], 
        job_role_id: parseInt(inviteForm.job_role_id), 
        deadline: inviteForm.deadline || undefined,
        email_addresses: [inviteForm.email]
      });
      
      let invId = res.data?.data?.invite_id;
      if (!invId) {
        const fetchRes = await sourceApi.getCandidateInvite(id);
        invId = fetchRes.data.data.id;
        setDraftForm(fetchRes.data.data.invite_content);
      } else {
        const fetchRes = await sourceApi.getCandidateInvite(id);
        setDraftForm(fetchRes.data.data.invite_content);
      }
      setDraftInviteId(invId);
      setShowInvite(false);
      setShowInviteEditor(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateDraft = async () => {
    try {
      await sourceApi.updateInvite(draftInviteId, draftForm);
      toast.success('Draft saved successfully!');
      setShowInviteEditor(false);
      setData(prev => ({ ...prev, status: 'invited' }));
    } catch (err) {
      toast.error('Failed to save draft');
    }
  };

  const handleDispatchDraft = async () => {
    setInviting(true);
    try {
      await sourceApi.updateInvite(draftInviteId, draftForm);
      await sourceApi.dispatchInvite(draftInviteId);
      toast.success('Assessment Invite sent to candidate! 📩');
      setShowInviteEditor(false);
      setData(prev => ({ ...prev, status: 'invited' }));
    } catch (err) {
      toast.error('Failed to dispatch invitation');
    } finally {
      setInviting(false);
    }
  };"""

    # We might have slight whitespace variations in old_handle_invite, so let's do a more robust replace or regex
    import re
    # Find handleInvite function boundaries
    match = re.search(r"const handleInvite = async \(e\) => \{.*?\n  \};", content, flags=re.DOTALL)
    if match:
        content = content[:match.start()] + new_handle_invite + content[match.end():]
    else:
        print("Could not find handleInvite function!")

    # 3. Inject showInviteEditor modal
    invite_modal_end_str = """        )}

        {/* Convert Modal */}"""
    
    editor_modal_jsx = """        )}

        {/* Invite Editor Modal */}
        {showInviteEditor && draftForm && (
          <div className="modal-overlay" onClick={() => setShowInviteEditor(false)}>
            <div className="modal" style={{ maxWidth: 600, width: '90%' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h4>Edit Assessment Invite</h4>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowInviteEditor(false)}>X</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Review and customize the AI-generated invite for <strong>{data.user?.full_name}</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input 
                    className="form-control" 
                    value={draftForm?.subject || ''} 
                    onChange={(e) => setDraftForm({ ...draftForm, subject: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Message Body</label>
                  <textarea 
                    className="form-control" 
                    rows={10}
                    value={(draftForm?.body_paragraphs || []).join('\\n\\n')}
                    onChange={(e) => setDraftForm({ ...draftForm, body_paragraphs: e.target.value.split('\\n\\n') })}
                    style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={() => setShowInviteEditor(false)}>Cancel</button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={handleUpdateDraft}>Save Draft</button>
                  <button className="btn btn-primary" onClick={handleDispatchDraft} disabled={inviting}>
                    {inviting ? 'Sending...' : 'Approve & Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Convert Modal */}"""

    if "{/* Invite Editor Modal */}" not in content:
        content = content.replace(invite_modal_end_str, editor_modal_jsx)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("CandidateProfile.jsx patched successfully!")
except Exception as e:
    print("Error:", e)
