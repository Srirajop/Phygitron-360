import sys

file_path = "d:\\Downloads\\Phygitron360\\frontend\\src\\pages\\source\\CandidateProfile.jsx"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    old_text = """                  <textarea 
                    className="form-control" 
                    rows={10}
                    value={(draftForm?.body_paragraphs || []).join('\\n\\n')}
                    onChange={(e) => setDraftForm({ ...draftForm, body_paragraphs: e.target.value.split('\\n\\n') })}
                    style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                  />
                </div>"""
                
    new_text = """                  <textarea 
                    className="form-control" 
                    rows={10}
                    value={(draftForm?.body_paragraphs || []).join('\\n\\n')}
                    onChange={(e) => setDraftForm({ ...draftForm, body_paragraphs: e.target.value.split('\\n\\n') })}
                    style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                  />
                  <small style={{ display: 'block', marginTop: 8, color: 'var(--primary)', fontWeight: 500, fontSize: '0.8rem' }}>
                    * Note: A secure login box containing the portal link, username, and temporary password will be automatically appended to the bottom of this message before sending.
                  </small>
                </div>"""

    content = content.replace(old_text, new_text)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("CandidateProfile patched successfully!")
except Exception as e:
    print("Error:", e)
