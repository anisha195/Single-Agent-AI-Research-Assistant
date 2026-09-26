/**
 * Single-Agent AI Research Assistant
 * Frontend Interface
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Globe,
  FileText,
  Database,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Download,
  RotateCw,
  Layers,
  Sparkles,
  Terminal,
  ChevronRight,
  BookOpen,
  Cpu,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { marked } from 'marked';

interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, any>;
  status: 'success' | 'error';
  duration_ms: number;
  output_summary?: string;
  timestamp: string;
}

interface Source {
  title: string;
  url?: string;
  document?: string;
  source_type: 'web' | 'internal_document' | 'external_api';
  snippet?: string;
  used: boolean;
  metadata?: Record<string, any>;
}

interface ActivityStep {
  id: string;
  type: string;
  message: string;
  tool?: string;
  status?: string;
  duration_ms?: number;
  time: string;
}

interface DocumentInfo {
  filename: string;
  chunks: number;
  sizeBytes: number;
}

interface DocumentsStatus {
  totalDocuments: number;
  totalChunks: number;
  documents: DocumentInfo[];
  lastIndexedAt: string;
}

const PRESET_QUERIES = [
  'Compare IEEE conference formatting standards with arXiv preprint submission and moderation guidelines.',
  'What are the abstract word limits, citation formats, and plagiarism policies for IEEE publications?',
  'Explain arXiv endorsement requirements, license options (CC BY vs arXiv perpetual), and versioning rules.',
  'Compare the growth of electric vehicles in India and the US from 2020 to 2025.',
];

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityStep[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [activeTab, setActiveTab] = useState<'report' | 'activity' | 'sources' | 'tools' | 'knowledge'>('report');
  const [copied, setCopied] = useState(false);
  const [docsStatus, setDocsStatus] = useState<DocumentsStatus | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activityEndRef = useRef<HTMLDivElement>(null);

  // Load document stats on mount
  useEffect(() => {
    fetchDocumentsStatus();
  }, []);

  const fetchDocumentsStatus = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocsStatus(data);
      }
    } catch (err) {
      console.error('Failed to load documents status', err);
    }
  };

  const handleReingest = async () => {
    setIsIngesting(true);
    try {
      const res = await fetch('/api/ingest', { method: 'POST' });
      if (res.ok) {
        await fetchDocumentsStatus();
      }
    } catch (err) {
      console.error('Re-ingestion failed', err);
    } finally {
      setIsIngesting(false);
    }
  };

  // Scroll activity automatically
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activity]);

  const startResearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q || loading) return;

    setLoading(true);
    setErrorMsg(null);
    setReport(null);
    setSources([]);
    setToolCalls([]);
    setActivity([]);
    setActiveTab('activity');
    setElapsedTime(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const addActivityItem = (type: string, message: string, tool?: string, duration_ms?: number, status?: string) => {
      setActivity((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          type,
          message,
          tool,
          duration_ms,
          status,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    };

    try {
      // Connect to SSE stream
      const response = await fetch('/api/research?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ query: q }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = 'message';
          let eventData = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) {
              eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              eventData = line.replace('data:', '').trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);

              if (eventType === 'step') {
                if (parsed.type === 'status') {
                  addActivityItem('status', parsed.message || 'Processing...');
                } else if (parsed.type === 'tool_start') {
                  addActivityItem('tool_start', parsed.message || `Executing ${parsed.tool}`, parsed.tool);
                } else if (parsed.type === 'tool_end') {
                  addActivityItem('tool_end', parsed.message || `Finished ${parsed.tool}`, parsed.tool, parsed.duration_ms, parsed.status);
                } else if (parsed.type === 'source_added' && parsed.source) {
                  setSources((prev) => {
                    const exists = prev.some((s) => s.title === parsed.source.title || (s.url && s.url === parsed.source.url));
                    return exists ? prev : [...prev, parsed.source];
                  });
                }
              } else if (eventType === 'complete') {
                if (parsed.answer) {
                  setReport(parsed.answer);
                  setActiveTab('report');
                }
                if (Array.isArray(parsed.sources)) {
                  setSources(parsed.sources);
                }
                if (Array.isArray(parsed.tool_calls)) {
                  setToolCalls(parsed.tool_calls);
                }
                addActivityItem('status', 'Research report completed successfully.');
              } else if (eventType === 'error') {
                throw new Error(parsed.error || 'Server reported an agent error.');
              }
            } catch (jsonErr: any) {
              console.warn('Error parsing SSE event:', jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Research error:', err);
      setErrorMsg(err.message || 'An error occurred during research.');
      addActivityItem('error', `Error: ${err.message || 'Failed'}`);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getToolIcon = (toolName?: string) => {
    switch (toolName) {
      case 'web_search':
        return <Globe className="w-4 h-4 text-sky-500" />;
      case 'fetch_webpage':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'search_documents':
        return <Database className="w-4 h-4 text-emerald-500" />;
      case 'call_external_api':
        return <Cpu className="w-4 h-4 text-amber-500" />;
      case 'calculator':
        return <Calculator className="w-4 h-4 text-purple-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base tracking-tight text-white">
                Single-Agent AI Research Assistant
              </h1>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Single-Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous multi-tool reasoning powered by Gemini
            </p>
          </div>
        </div>

        {/* System Capabilities & Knowledge Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setActiveTab('knowledge')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">RAG Knowledge:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {docsStatus?.totalDocuments ?? 3} docs
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800/40 border border-slate-700/50 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>gemini-3.8-flash</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Research Input Box */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 relative">
          <div className="flex flex-col gap-3">
            <label htmlFor="query-input" className="text-sm font-medium text-slate-200 flex items-center justify-between">
              <span>Enter your research topic or question:</span>
              <span className="text-xs text-slate-400 font-normal">
                Single agent will execute sequential tools autonomously
              </span>
            </label>

            <div className="relative">
              <textarea
                id="query-input"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    startResearch(query);
                  }
                }}
                placeholder="e.g. Compare the growth of electric vehicles in India and the US from 2020 to 2025."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm leading-relaxed transition"
                disabled={loading}
              />

              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  onClick={() => startResearch(query)}
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin text-white" />
                      <span>Researching... ({elapsedTime}s)</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Start Research</span>
                      <ArrowRight className="w-4 h-4 hidden sm:inline" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Presets and Guidelines */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Quick Examples:</span>
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(preset);
                    startResearch(preset);
                  }}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50 hover:border-indigo-500/30 transition text-left"
                >
                  {preset.length > 55 ? preset.slice(0, 55) + '...' : preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'report'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Research Report</span>
              {report && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Agent Activity</span>
              {activity.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                  {activity.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'sources'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Sources</span>
              {sources.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-emerald-400">
                  {sources.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'tools'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Tool Logs</span>
              {toolCalls.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-sky-400">
                  {toolCalls.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'knowledge'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Knowledge Base</span>
            </button>
          </div>

          {/* Action buttons when report exists */}
          {report && activeTab === 'report' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700 transition"
                title="Copy Markdown"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadReport}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 border border-slate-700 transition"
                title="Download .md"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Final Research Report */}
        {activeTab === 'report' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 sm:p-8 min-h-[400px]">
            {report ? (
              <article
                className="prose prose-invert prose-indigo max-w-none 
                  prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-3 prose-h1:text-white
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:text-indigo-300 prose-h2:mt-6
                  prose-h3:text-lg prose-h3:font-medium prose-h3:text-slate-200
                  prose-p:text-slate-300 prose-p:leading-relaxed
                  prose-li:text-slate-300
                  prose-table:w-full prose-table:border-collapse prose-table:border prose-table:border-slate-800 prose-table:my-6
                  prose-th:bg-slate-800/80 prose-th:p-3 prose-th:text-left prose-th:text-slate-200 prose-th:border prose-th:border-slate-700
                  prose-td:p-3 prose-td:border prose-td:border-slate-800 prose-td:text-slate-300
                  prose-strong:text-white"
                dangerouslySetInnerHTML={{ __html: marked.parse(report) as string }}
              />
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <RotateCw className="w-6 h-6 text-indigo-400 animate-spin absolute -bottom-2 -right-2 bg-slate-950 rounded-full p-1 border border-indigo-500/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-white">
                    Agent is Conducting In-Depth Research...
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md">
                    The single Gemini agent is executing sequential tool calls (web search, reading sources, querying internal RAG documents, and calculating metrics).
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 underline underline-offset-4"
                >
                  <span>View Live Tool Activity</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center text-slate-500">
                <FileText className="w-12 h-12 text-slate-700" />
                <p className="text-sm font-medium text-slate-400">
                  No research report yet
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Enter a research question above and click "Start Research" to begin autonomous investigation.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Agent Activity Log */}
        {activeTab === 'activity' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Agent Execution Stream</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {activity.length} steps recorded
              </span>
            </div>

            {activity.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                No activity yet. Start a research session to see real-time tool execution.
              </div>
            ) : (
              <div className="space-y-2.5 font-mono text-xs">
                {activity.map((step) => {
                  const isEnd = step.type === 'tool_end';
                  const isStart = step.type === 'tool_start';
                  const isError = step.type === 'error' || step.status === 'error';

                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition ${
                        isError
                          ? 'bg-red-950/20 border-red-900/40 text-red-300'
                          : isEnd
                          ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                          : isStart
                          ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-300'
                          : 'bg-slate-950/30 border-slate-800/50 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isError ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : isEnd ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          getToolIcon(step.tool)
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">
                            {step.tool ? `tool: ${step.tool}` : 'agent'}
                          </span>
                          <span className="text-[10px] text-slate-500">{step.time}</span>
                        </div>
                        <p className="text-slate-300 font-sans text-xs">{step.message}</p>
                        {step.duration_ms !== undefined && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Execution duration: {step.duration_ms}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={activityEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sources Panel */}
        {activeTab === 'sources' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Tracked & Verified Sources</h3>
                <p className="text-xs text-slate-400">
                  Every source retrieved by the agent during research is strictly verified and documented.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                {sources.length} sources
              </span>
            </div>

            {sources.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                No sources captured yet. Sources will automatically appear as tools run.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sources.map((src, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                            src.source_type === 'web'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : src.source_type === 'internal_document'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {src.source_type.replace('_', ' ')}
                        </span>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                          >
                            <span>Visit</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-slate-100 line-clamp-2">
                        {src.title}
                      </h4>

                      {src.snippet && (
                        <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                          {src.snippet}
                        </p>
                      )}
                    </div>

                    {src.document && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>file: {src.document}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Tool Execution Logs */}
        {activeTab === 'tools' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Tool Invocation History</h3>
                <p className="text-xs text-slate-400">
                  Sanitized structured logs of every tool call decided and dispatched by Gemini.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                {toolCalls.length} tool calls
              </span>
            </div>

            {toolCalls.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                No tool calls logged for the current run yet.
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {toolCalls.map((tc, idx) => (
                  <div
                    key={tc.id || idx}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">#{idx + 1}</span>
                        {getToolIcon(tc.tool)}
                        <span className="font-bold text-slate-200">{tc.tool}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded-full uppercase ${
                            tc.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {tc.status}
                        </span>
                        <span className="text-slate-400 text-[11px]">{tc.duration_ms}ms</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block mb-1">Arguments:</span>
                      <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(tc.arguments, null, 2)}
                      </pre>
                    </div>

                    {tc.output_summary && (
                      <div className="text-[11px] text-slate-400">
                        <span className="text-slate-400">Output Summary: </span>
                        <span className="text-slate-300">{tc.output_summary}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Internal Knowledge Base */}
        {activeTab === 'knowledge' && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Internal RAG Knowledge Base</h3>
                <p className="text-xs text-slate-400">
                  Documents indexed in <code className="text-slate-300">data/documents/</code> for similarity search.
                </p>
              </div>
              <button
                onClick={handleReingest}
                disabled={isIngesting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isIngesting ? 'animate-spin' : ''}`} />
                <span>{isIngesting ? 'Re-indexing...' : 'Re-index Documents'}</span>
              </button>
            </div>

            {docsStatus?.documents && docsStatus.documents.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Total Documents</span>
                    <p className="text-lg font-bold text-white mt-1">
                      {docsStatus.totalDocuments}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Total Indexed Chunks</span>
                    <p className="text-lg font-bold text-emerald-400 mt-1">
                      {docsStatus.totalChunks}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400">Vector Search</span>
                    <p className="text-lg font-bold text-sky-400 mt-1">
                      TF-IDF Cosine
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {docsStatus.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">
                            {doc.filename}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            {(doc.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                          {doc.chunks} chunks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-sm">
                No documents found in knowledge base.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-2">
        <div className="flex items-center gap-2">
          <span>Single-Agent Architecture</span>
          <span>•</span>
          <span>Gemini Native Function Calling</span>
          <span>•</span>
          <span>Max Tool Calls: 10</span>
        </div>
        <div className="flex items-center gap-2">
          <span>RAG</span>
          <span>•</span>
          <span>Web Search</span>
          <span>•</span>
          <span>Webpage Fetch</span>
          <span>•</span>
          <span>External API</span>
          <span>•</span>
          <span>Calculator</span>
        </div>
      </footer>
    </div>
  );
}
