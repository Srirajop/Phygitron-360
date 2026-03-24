import React, { useState } from 'react';
import { forgeApi } from '../../api';
import { PlusCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const blankSection = () => ({ title: '', order_index: 0, content_type: 'video', content_url: '', duration_minutes: 30, pass_score: 60, quizzes: [] });

export default function CourseBuilder() {
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
  const [difficulty, setDifficulty] = useState('beginner'); const [hours, setHours] = useState(4);
  const [sections, setSections] = useState([blankSection()]);
  const [loading, setLoading] = useState(false);

  const addSection = () => setSections(s => [...s, { ...blankSection(), order_index: s.length }]);
  const updateSection = (i, k, v) => setSections(s => s.map((sec, si) => si === i ? { ...sec, [k]: v } : sec));
  const removeSection = (i) => setSections(s => s.filter((_, si) => si !== i));

  const save = async (publish = false) => {
    if (!title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const res = await forgeApi.createCourse({ title, description: desc, difficulty, estimated_hours: hours, sections });
      if (publish) await forgeApi.publishCourse(res.data.data.id);
      toast.success(publish ? 'Course published!' : 'Draft saved!');
    } catch (err) { toast.error(err?.response?.data?.detail || 'Save failed'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Course Builder</h1><p>Create engaging learning content with video, articles, and quizzes</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => save(false)} disabled={loading}>Save Draft</button>
          <button className="btn btn-shimmer" onClick={() => save(true)} disabled={loading}>🚀 Publish</button>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div>
            {sections.map((s, i) => (
              <div key={i} className="card animate-fade-in" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Section {i + 1}</strong>
                  <button className="btn btn-danger btn-sm" onClick={() => removeSection(i)}><Trash2 size={13} /></button>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Section Title</label>
                      <input className="form-control" value={s.title} onChange={e => updateSection(i, 'title', e.target.value)} placeholder="e.g., Introduction to Hooks" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Content Type</label>
                      <select className="form-control" value={s.content_type} onChange={e => updateSection(i, 'content_type', e.target.value)}>
                        <option value="video">🎬 Video</option>
                        <option value="article">📄 Article</option>
                        <option value="quiz">📝 Quiz</option>
                      </select>
                    </div>
                  </div>
                  {s.content_type !== 'quiz' && (
                    <div className="form-group">
                      <label className="form-label">Content URL</label>
                      <input className="form-control" value={s.content_url} onChange={e => updateSection(i, 'content_url', e.target.value)} placeholder="https://youtube.com/watch?v=…" />
                    </div>
                  )}
                  {s.content_type !== 'quiz' && (
                    <div className="form-group">
                      <label className="form-label">Duration (minutes)</label>
                      <input type="number" className="form-control" value={s.duration_minutes} onChange={e => updateSection(i, 'duration_minutes', parseInt(e.target.value))} min={1} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-block" onClick={addSection}><PlusCircle size={16} /> Add Section</button>
          </div>
          <div>
            <div className="card animate-fade-in">
              <div className="card-header"><h4>Course Settings</h4></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., React Fundamentals" /></div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={4} value={desc} onChange={e => setDesc(e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="form-label">Difficulty</label>
                    <select className="form-control" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                      {['beginner', 'intermediate', 'advanced', 'expert'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Est. Hours</label><input type="number" className="form-control" value={hours} min={0.5} step={0.5} onChange={e => setHours(parseFloat(e.target.value))} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
