import React, { useEffect, useState } from 'react';
import { verifyApi } from '../../api';
import { PlusCircle, Trash2, Tag, Database, Search, X, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';

const QTYPES = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'mcq_multi', label: 'MCQ Multi' },
  { value: 'written', label: 'Written' },
  { value: 'coding', label: 'Coding' },
  { value: 'file_upload', label: 'File Upload' },
];

const TAG_COLORS = ['badge-primary','badge-success','badge-info','badge-warning'];
const tagColor = (t) => TAG_COLORS[t.charCodeAt(0) % TAG_COLORS.length];

function AddItemModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ question_text:'', question_type:'mcq', options:['','','',''], correct_answer:'', model_answer:'', marks:1, tags:[], images:[] });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const save = async () => {
    if(!form.question_text) { toast.error('Question text required'); return; }
    
    // Auto-flush pending tag
    const currentTags = [...form.tags];
    if (tagInput.trim() && !currentTags.includes(tagInput.trim())) {
      currentTags.push(tagInput.trim());
    }

    setSaving(true);
    try {
      await verifyApi.createBankItem({ ...form, tags: currentTags });
      toast.success('Added to bank');
      onSaved();
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal card animate-scale-in" style={{maxWidth:600}}>
        <div className="card-header" style={{display:'flex',justifyContent:'space-between'}}>
          <h3>Add to Question Bank</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body">
          <div className="form-group" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
            <div>
              <label className="form-label">Question Type</label>
              <select className="form-control" value={form.question_type} onChange={e=>set('question_type',e.target.value)}>
                {QTYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Marks</label>
              <input type="number" className="form-control" min={0.5} step={0.5} value={form.marks} onChange={e=>set('marks',parseFloat(e.target.value))}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Question Text *</label>
            <textarea className="form-control" rows={3} value={form.question_text} onChange={e=>set('question_text',e.target.value)} placeholder="Enter question…"/>
          </div>
          {(form.question_type==='mcq'||form.question_type==='mcq_multi') && (
            <div className="form-group">
              <label className="form-label">Options</label>
              {(form.options||[]).map((opt,oi)=>(
                <div key={oi} style={{display:'flex',gap:8,marginBottom:8}}>
                  <input type={form.question_type==='mcq'?'radio':'checkbox'} name="correct" checked={form.question_type==='mcq'?form.correct_answer===opt:(() => { try { return JSON.parse(form.correct_answer||'[]').includes(opt); } catch { return false; } })()} onChange={()=>{
                    if(form.question_type==='mcq') set('correct_answer',opt);
                    else { try { let a=JSON.parse(form.correct_answer||'[]'); a=a.includes(opt)?a.filter(x=>x!==opt):[...a,opt]; set('correct_answer',JSON.stringify(a)); } catch { set('correct_answer',JSON.stringify([opt])); } }
                  }} style={{accentColor:'var(--primary)',marginTop:8}}/>
                  <input className="form-control" value={opt} onChange={e=>{const o=[...form.options];o[oi]=e.target.value;set('options',o);}} placeholder={`Option ${String.fromCharCode(65+oi)}`}/>
                  <button className="btn btn-ghost btn-sm" onClick={()=>set('options',form.options.filter((_,i)=>i!==oi))}><Trash2 size={13}/></button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={()=>set('options',[...form.options,''])}><PlusCircle size={13}/> Add Option</button>
            </div>
          )}
          {form.question_type==='written' && (
            <div className="form-group">
              <label className="form-label">Model Answer</label>
              <textarea className="form-control" rows={2} value={form.model_answer} onChange={e=>set('model_answer',e.target.value)} placeholder="Ideal answer…"/>
            </div>
          )}
          <div className="form-group">
            <label className="form-label"><Tag size={13} style={{verticalAlign:'middle',marginRight:4}}/>Tags</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:6}}>
              {form.tags.map((tag,ti)=>(
                <span key={ti} className={`badge ${tagColor(tag)}`} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px'}}>
                  {tag}<button onClick={()=>set('tags',form.tags.filter((_,i)=>i!==ti))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,display:'flex'}}><X size={10}/></button>
                </span>
              ))}
            </div>
            <input className="form-control" value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="Type tag and press Enter (e.g. Java)"
              onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();if(!form.tags.includes(tagInput.trim()))set('tags',[...form.tags,tagInput.trim()]);setTagInput('');}}}
              onBlur={()=>{if(tagInput.trim()&&!form.tags.includes(tagInput.trim())){set('tags',[...form.tags,tagInput.trim()]);setTagInput('');}}}/>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Add to Bank'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportUrlModal({ onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!url.trim()) { toast.error('URL required'); return; }
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const res = await verifyApi.importUrlToBank(url, tags);
      toast.success(`Imported ${res.data.data.added} questions!`);
      onSaved();
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed to import URL'); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal card animate-scale-in" style={{maxWidth:500}}>
        <div className="card-header" style={{display:'flex',justifyContent:'space-between'}}>
          <h3>Import from URL</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-body">
          <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:16}}>
            Paste a URL to a coding problem (e.g., LeetCode) or any web page with questions. The AI will extract and add them to the bank.
          </p>
          <div className="form-group">
            <label className="form-label">Page URL *</label>
            <input type="url" className="form-control" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://leetcode.com/problems/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Default Tags (Optional)</label>
            <input className="form-control" value={tagsInput} onChange={e=>setTagsInput(e.target.value)} placeholder="Comma separated (e.g. Java, Easy)" />
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Extracting…':'Import'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestionBank() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const load = async () => {
    setLoading(true);
    try { const r = await verifyApi.listQuestionBank(); setItems(r.data.data||[]); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const allTags = [...new Set(items.flatMap(i=>i.tags||[]))].sort();

  const filtered = items.filter(i => {
    if (filterTag && !(i.tags||[]).includes(filterTag)) return false;
    if (filterType && i.question_type !== filterType) return false;
    if (search && !i.question_text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const deleteItem = async (id) => {
    if (!window.confirm('Remove from bank?')) return;
    try { await verifyApi.deleteBankItem(id); setItems(prev=>prev.filter(i=>i.id!==id)); toast.success('Removed'); }
    catch { toast.error('Failed'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    const toastId = toast.loading('Extracting questions from file...');
    try {
      const res = await verifyApi.importFileToBank(file);
      toast.success(`Imported ${res.data.data.added} questions!`, { id: toastId });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to import file', { id: toastId });
    }
    setFileUploading(false);
    e.target.value = ''; // reset input
  };

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1><Database size={22} style={{verticalAlign:'middle',marginRight:8}}/>Question Bank</h1>
          <p>Reusable question pool — tag, search, and import into any assessment</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <label className={`btn btn-secondary ${fileUploading ? 'disabled' : ''}`} style={{cursor:fileUploading?'not-allowed':'pointer'}}>
            {fileUploading ? 'Extracting...' : '📄 Import File'}
            <input type="file" style={{display:'none'}} accept=".pdf,.doc,.docx,.txt,.csv,.json" onChange={handleFileUpload} disabled={fileUploading} />
          </label>
          <button className="btn btn-secondary" onClick={()=>setShowImportUrl(true)}>🔗 Import URL</button>
          <button className="btn btn-shimmer" onClick={()=>setShowAdd(true)}><PlusCircle size={16}/> Add Question</button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="card animate-fade-in" style={{marginBottom:16}}>
          <div className="card-body" style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
              <input className="form-control" style={{paddingLeft:32}} placeholder="Search questions…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="form-control" style={{width:160}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {QTYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="form-control" style={{width:160}} value={filterTag} onChange={e=>setFilterTag(e.target.value)}>
              <option value="">All Tags</option>
              {allTags.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4, padding: 4, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)' }}>
              <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 10px' }} onClick={() => setViewMode('list')} title="List view"><List size={16} /></button>
              <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 10px' }} onClick={() => setViewMode('grid')} title="Card view"><LayoutGrid size={16} /></button>
            </div>
            {(filterTag||filterType||search) && <button className="btn btn-ghost btn-sm" onClick={()=>{setFilterTag('');setFilterType('');setSearch('');}}><X size={13}/> Clear</button>}
          </div>
        </div>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
            {allTags.map(t=>(
              <button key={t} className={`badge ${tagColor(t)}`} style={{cursor:'pointer',border:'none',padding:'5px 12px',fontSize:'0.78rem',opacity:filterTag&&filterTag!==t?0.4:1}}
                onClick={()=>setFilterTag(filterTag===t?'':t)}>
                <Tag size={10} style={{marginRight:4,verticalAlign:'middle'}}/>{t}
              </button>
            ))}
          </div>
        )}

        {/* Count */}
        <div style={{marginBottom:12,fontSize:'0.82rem',color:'var(--text-muted)'}}>
          Showing {filtered.length} of {items.length} questions
        </div>

        {loading ? <div className="spinner" style={{margin:'48px auto'}}/> : filtered.length === 0 ? (
          <div className="card animate-fade-in" style={{textAlign:'center',padding:48,color:'var(--text-muted)'}}>
            <Database size={40} style={{marginBottom:12,opacity:0.3}}/>
            <div style={{fontWeight:600}}>No questions found</div>
            <div style={{fontSize:'0.85rem',marginTop:4}}>Try different filters or add a new question</div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="card animate-fade-in">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Question</th><th>Type</th><th>Marks</th><th>Tags</th><th>Answer</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td style={{ maxWidth: 520 }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.45 }}>
                          {item.question_text?.length > 140 ? item.question_text.slice(0, 140) + '...' : item.question_text}
                        </div>
                        {item.options && item.options.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.options.slice(0, 4).map((o, i) => (
                              <span key={i} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{String.fromCharCode(65+i)}. {o.slice(0, 24)}{o.length > 24 ? '...' : ''}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td><span className="badge badge-muted">{item.question_type}</span></td>
                      <td>{item.marks} mark{item.marks !== 1 ? 's' : ''}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(item.tags || []).length > 0 ? (item.tags || []).map(t => <span key={t} className={`badge ${tagColor(t)}`}>{t}</span>) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </div>
                      </td>
                      <td style={{ maxWidth: 220, color: 'var(--text-muted)' }}>
                        {(item.correct_answer || item.model_answer || '-').toString().slice(0, 80)}{(item.correct_answer || item.model_answer || '').toString().length > 80 ? '...' : ''}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',padding:4}} onClick={()=>deleteItem(item.id)} title="Delete"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
            {filtered.map(item=>(
              <div key={item.id} className="card animate-fade-in" style={{border:'1px solid var(--border)'}}>
                <div className="card-body">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <span className="badge badge-muted" style={{fontSize:'0.65rem'}}>{item.question_type}</span>
                      <span className="badge badge-muted" style={{fontSize:'0.65rem'}}>{item.marks} mark{item.marks!==1?'s':''}</span>
                      {(item.tags||[]).map(t=><span key={t} className={`badge ${tagColor(t)}`} style={{fontSize:'0.65rem'}}>{t}</span>)}
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',padding:4}} onClick={()=>deleteItem(item.id)}><Trash2 size={14}/></button>
                  </div>
                  <p style={{fontSize:'0.88rem',lineHeight:1.5,color:'var(--text-primary)',margin:0}}>
                    {item.question_text.length>200?item.question_text.slice(0,200)+'...':item.question_text}
                  </p>
                  {item.options && item.options.length>0 && (
                    <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:4}}>
                      {item.options.slice(0,4).map((o,i)=>(
                        <span key={i} style={{fontSize:'0.72rem',padding:'2px 8px',background:'var(--bg-hover)',borderRadius:4,color:item.correct_answer===o?'var(--success)':'var(--text-muted)',fontWeight:item.correct_answer===o?700:400}}>
                          {String.fromCharCode(65+i)}. {o.slice(0,30)}{o.length>30?'...':''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddItemModal onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load();}}/>}
      {showImportUrl && <ImportUrlModal onClose={()=>setShowImportUrl(false)} onSaved={()=>{setShowImportUrl(false);load();}}/>}
    </div>
  );
}
