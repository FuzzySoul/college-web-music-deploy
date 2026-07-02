'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  cover: string;
  type: 'track' | 'artist' | 'album';
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onResultClick: (result: SearchResult) => void;
}

export function SearchBar({ onSearch, onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 模拟搜索结果
  useEffect(() => {
    if (query.length > 1) {
      // 模拟搜索
      const mockResults: SearchResult[] = [
        { id: '1', title: '夜空中最亮的星', artist: '逃跑计划', cover: 'https://picsum.photos/seed/song1/200', type: 'track' as const },
        { id: '2', title: '周杰伦', artist: '歌手', cover: 'https://picsum.photos/seed/artist1/200', type: 'artist' as const },
        { id: '3', title: '七里香', artist: '周杰伦', cover: 'https://picsum.photos/seed/album1/200', type: 'album' as const },
        { id: '4', title: '晴天', artist: '周杰伦', cover: 'https://picsum.photos/seed/song2/200', type: 'track' as const },
      ].filter((r): r is SearchResult => r.title.toLowerCase().includes(query.toLowerCase()) || r.artist.toLowerCase().includes(query.toLowerCase()));
      
      setResults(mockResults);
    } else {
      setResults([]);
    }
  }, [query]);

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* 搜索框 - 毛玻璃效果 */}
      <div className={`relative flex items-center bg-[var(--card)]/70 backdrop-blur-xl border border-[var(--border)]/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-400 ease-out ${
        isFocused ? 'scale-[1.01] border-[var(--primary)]/30 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(var(--primary),0.1)]' : 'hover:border-[var(--border)]/60 hover:shadow-[0_6px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]'
      }`}>
        <Search className={`absolute left-4 w-5 h-5 transition-colors duration-400 ease-out ${
          isFocused ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
        }`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="搜索歌曲、歌手、专辑..."
          className="w-full pl-12 pr-12 py-4 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-[15px] tracking-wide"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 p-1.5 rounded-full bg-[var(--muted)]/50 hover:bg-[var(--primary)]/20 transition-all duration-300 group"
          >
            <X className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors duration-300" />
          </button>
        )}
      </div>

      {/* 搜索建议 - 毛玻璃效果 */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[var(--card)]/80 backdrop-blur-2xl border border-[var(--border)]/30 rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden z-50 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {/* 热门搜索 */}
          {!query && (
            <div className="p-5">
              <h4 className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] mb-4 tracking-wide">
                <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
                热门搜索
              </h4>
              <div className="flex flex-wrap gap-2">
                {['周杰伦', '陈奕迅', '林俊杰', '蔡依林', '五月天'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      onSearch(tag);
                    }}
                    className="px-4 py-2 bg-[var(--muted)]/40 backdrop-blur-sm border border-[var(--border)]/20 rounded-full text-sm text-[var(--foreground)] hover:bg-[var(--primary)]/15 hover:border-[var(--primary)]/30 hover:text-[var(--primary)] transition-all duration-300"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 搜索结果 */}
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onResultClick(result)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--primary)]/5 transition-all duration-300 text-left group"
                >
                  <img
                    src={result.cover}
                    alt={result.title}
                    className="w-12 h-12 rounded-lg object-cover shadow-md group-hover:shadow-lg transition-shadow duration-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors duration-300">{result.title}</p>
                    <p className="text-sm text-[var(--muted-foreground)] truncate">{result.artist}</p>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)] capitalize px-3 py-1.5 bg-[var(--muted)]/40 backdrop-blur-sm border border-[var(--border)]/20 rounded-full">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 最近搜索 */}
          {!query && (
            <div className="p-5 border-t border-[var(--border)]/20">
              <h4 className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] mb-4 tracking-wide">
                <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
                最近搜索
              </h4>
              <div className="space-y-1">
                {['夜空中最亮的星', '七里香', '晴天'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setQuery(item);
                      onSearch(item);
                    }}
                    className="block w-full text-left px-3 py-2.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30 rounded-lg transition-all duration-300"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
