import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, RefreshCw, Filter, Trash2, Edit3, Search, UploadCloud, Library } from 'lucide-react';
import { toast } from 'react-hot-toast';

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 relative shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImport }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/verify/question-bank/import-file', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message);
        onImport();
        onClose();
      } else {
        toast.error(d.detail || 'Import failed');
      }
    } catch {
      toast.error('Network error during import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Import Questions with AI">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="text-sm text-gray-600">
          Upload a PDF or text file containing questions. Our AI will automatically parse and add them to your Question Bank.
        </p>
        <div className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center bg-purple-50">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.txt,.docx"
            onChange={e => setFile(e.target.files[0])}
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
            <UploadCloud size={32} className="text-purple-500" />
            <span className="text-sm font-medium text-purple-700">
              {file ? file.name : "Click to select a file"}
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={importing || !file} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50">
            {importing ? <Loader2 size={16} className="animate-spin" /> : "Extract & Import"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/verify/question-bank', { credentials: 'include' });
      const d = await r.json();
      setQuestions(d.data || []);
    } catch {
      toast.error('Failed to load question bank');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question from the bank?')) return;
    try {
      const r = await fetch(`/api/verify/question-bank/${id}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) {
        toast.success('Question deleted');
        fetchQuestions();
      } else {
        toast.error('Delete failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const filtered = questions.filter(q => 
    q.question_text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchQuestions} className="p-2.5 rounded-xl border text-gray-500 hover:bg-gray-50"><RefreshCw size={16} /></button>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 border border-purple-200">
            <UploadCloud size={16} /> AI Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 shadow-sm">
            <Plus size={16} /> Manual Entry
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border border-gray-200">
          <Library size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-800">Bank is Empty</h3>
          <p className="text-sm text-gray-500 mt-1">Import questions or add them manually.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(q => (
            <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-200 flex gap-4 items-start shadow-sm hover:shadow-md transition">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 mb-2">{q.question_text}</p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded">{q.question_type}</span>
                  {q.tags?.map((t, idx) => (
                    <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold uppercase rounded">{t}</span>
                  ))}
                  <span className="text-xs text-gray-400">Pts: {q.marks}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="p-2 text-gray-400 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 rounded-lg"><Edit3 size={14} /></button>
                <button onClick={() => handleDelete(q.id)} className="p-2 text-gray-400 hover:text-rose-600 bg-gray-50 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={fetchQuestions} />}
    </div>
  );
}
