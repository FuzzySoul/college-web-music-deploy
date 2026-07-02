'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Loader2 } from 'lucide-react';

interface ForbiddenWord {
  id: number;
  word: string;
  created_at: string;
}

export default function ForbiddenWordsPage() {
  const [words, setWords] = useState<ForbiddenWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadWords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/forbidden-words');
      if (res.ok) setWords(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWords(); }, []);

  const handleAdd = async () => {
    if (!newWord.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/forbidden-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim() }),
      });
      if (res.ok) {
        setNewWord('');
        loadWords();
      } else {
        const data = await res.json();
        setError(data.error || '添加失败');
      }
    } catch {
      setError('添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个违禁词吗？')) return;
    try {
      const res = await fetch(`/api/admin/forbidden-words?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadWords();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
      <div>
        <h1 className="text-2xl font-normal" style={{ color: 'var(--foreground)' }}>违禁词管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理评论系统中的违禁词过滤</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="输入新的违禁词..."
          className="flex-1 max-w-sm px-4 py-2 rounded-xl text-sm outline-none"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newWord.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all hover:scale-[1.05] disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          添加
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p style={{ color: 'var(--muted-foreground)' }}>暂无违禁词</p>
        </div>
      ) : (
        <div className="space-y-1 max-w-lg">
          {words.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>{w.word}</span>
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
