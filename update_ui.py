import codecs
file_path = r'd:\Downloads\Phygitron360\frontend\src\pages\source\ActiveCandidates.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the grid string
old_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 20, marginBottom: 24 }}>"
new_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>"
text = text.replace(old_grid, new_grid)

# Insert the Recent Results section after the Leaderboard section
search_str = '''                      ))}
                    </div>
                  )}
                </div>'''

recent_results_html = '''
              <div className="card animate-fade-in" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Recent Results</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Latest completed assessments</p>
                  </div>
                  <ClipboardCheck size={20} color="var(--primary)" />
                </div>
                {(dashboard.recent_results || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 28 }}><p>No recent results.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(dashboard.recent_results || []).slice(0, 8).map(res => (
                      <Link key={res.result_id} to={`/source/candidates/${res.user_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.trainee?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, color: scoreColor(res.score) }}>{formatScore(res.score)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(res.submitted_at)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>'''

if search_str in text:
    text = text.replace(search_str, search_str + recent_results_html)
    print('Recent results inserted successfully!')
else:
    print('Could not find search string!')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
