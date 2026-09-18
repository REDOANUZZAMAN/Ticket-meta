import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Plus, Search, Mic, MessageSquare, Sparkles, Copy, Check, Maximize2, Minimize2, Lock, Plane, MapPin, DollarSign, TrendingUp, Zap, Compass, X, Square } from 'lucide-react';
import { chatbotStream, getRecommendations } from '../api';

/* ──────── Mac-Window AI Chat ──────── */
function Chatbot() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState([
    { id: 1, title: 'New Conversation', messages: [] }
  ]);
  const [activeConv, setActiveConv] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [streamSql, setStreamSql] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  // Gemini-style tool state
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);   // "+" dropdown visible
  const [activeTool, setActiveTool] = useState(null);        // null = normal chat, 'recommend' = recommendation mode

  const abortRef = useRef(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const plusRef = useRef(null);
  const activeConvRef = useRef(activeConv);

  // Keep ref in sync with state so SSE callbacks always use the latest value
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  const activeMessages = conversations.find(c => c.id === activeConv)?.messages || [];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, statusMsg, streamSql]);

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (plusRef.current && !plusRef.current.contains(e.target)) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateConvMessages = useCallback((convId, updater) => {
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, messages: updater(c.messages) } : c)
    );
  }, []);

  const updateConvTitle = useCallback((convId, title) => {
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, title } : c)
    );
  }, []);

  const handleNewConversation = () => {
    const newId = Date.now();
    setConversations(prev => [{ id: newId, title: 'New Conversation', messages: [] }, ...prev]);
    setActiveConv(newId);
    setInput('');
    setActiveTool(null);
  };

  /* ── Select recommendation tool from "+" menu ── */
  const handleSelectTool = (tool) => {
    setActiveTool(tool);
    setPlusMenuOpen(false);
    inputRef.current?.focus();
  };

  /* ── Clear active tool ── */
  const handleClearTool = () => {
    setActiveTool(null);
    inputRef.current?.focus();
  };

  /* ── Handle recommendation send (when activeTool === 'recommend') ── */
  const handleRecSend = async (prompt) => {
    setLoading(true);
    setStatusMsg('Running recommendation engine...');

    // Parse origin from prompt — look for 3-letter airport code
    const codeMatch = prompt.match(/\b([A-Z]{3})\b/i);
    const origin = codeMatch ? codeMatch[1].toUpperCase() : prompt.trim().toUpperCase().split(/\s+/)[0];

    // Parse optional budget
    const budgetMatch = prompt.match(/\$\s*(\d+)/);
    const budget = budgetMatch ? budgetMatch[1] : null;

    // Check for nonstop keyword
    const nonstop = /nonstop|non-stop|direct/i.test(prompt);

    const budgetStr = budget ? ` under $${budget}` : '';
    const nsStr = nonstop ? ' (nonstop only)' : '';

    // Add user message
    updateConvMessages(activeConv, msgs => [...msgs, { role: 'user', text: `🎯 ${prompt}` }]);

    const conv = conversations.find(c => c.id === activeConv);
    if (conv && (conv.title === 'New Conversation' || conv.messages.length === 0)) {
      updateConvTitle(activeConv, `Recs from ${origin}${budgetStr}`);
    }

    try {
      const params = { origin, limit: 10 };
      if (budget) params.budget = budget;
      if (nonstop) params.nonstop = true;

      const res = await getRecommendations(params);
      const data = res.data;

      if (data.error) {
        updateConvMessages(activeConv, msgs => [...msgs, {
          role: 'bot', text: data.error, sql: null, results: null
        }]);
      } else {
        const recs = data.recommendations || [];
        const summary = recs.length > 0
          ? `Found ${recs.length} recommended destinations from ${origin}${budgetStr}${nsStr}`
          : `No recommendations found from ${origin}. Try a different airport.`;

        updateConvMessages(activeConv, msgs => [...msgs, {
          role: 'bot',
          text: summary,
          sql: null,
          results: null,
          recommendations: recs,
          recOrigin: origin,
          recModel: data.model || 'Smart Route Scoring',
        }]);
      }
    } catch (err) {
      updateConvMessages(activeConv, msgs => [...msgs, {
        role: 'bot',
        text: `Recommendation error: ${err.response?.data?.error || err.message}`,
        sql: null, results: null
      }]);
    }

    setLoading(false);
    setStatusMsg('');
    setActiveTool(null); // Reset after sending
  };

  /* ── Normal AI chat send ── */
  const handleNormalSend = (question) => {
    updateConvMessages(activeConv, msgs => [...msgs, { role: 'user', text: question }]);

    const conv = conversations.find(c => c.id === activeConv);
    if (conv && (conv.title === 'New Conversation' || conv.messages.length === 0)) {
      updateConvTitle(activeConv, question.slice(0, 40) + (question.length > 40 ? '...' : ''));
    }

    setLoading(true);
    setStatusMsg('Thinking...');
    setStreamSql(null);

    const history = [...(conv?.messages || []), { role: 'user', text: question }]
      .slice(-10)
      .map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text + (m.sql ? `\n[SQL: ${m.sql}]` : '')
      }));

    const convId = activeConvRef.current; // capture once, use ref to avoid stale closure
    abortRef.current = chatbotStream(question, history, (event) => {
      console.log('[Chatbot Event]', event.type, event.type === 'answer' ? `results=${event.results?.length || 0}` : '');
      switch (event.type) {
        case 'status':
          setStatusMsg(event.message || 'Processing...');
          break;
        case 'sql':
          setStreamSql(event.sql);
          setStatusMsg('Running query on Hive...');
          break;
        case 'answer':
          console.log('[Chatbot] Adding answer to conv', convId, 'answer:', event.answer?.substring(0, 80));
          updateConvMessages(convId, msgs => [...msgs, {
            role: 'bot',
            text: event.answer || 'Done.',
            sql: event.sql || null,
            results: event.results || null,
          }]);
          setStreamSql(null);
          setStatusMsg('');
          break;
        case 'recommendation':
          updateConvMessages(convId, msgs => [...msgs, {
            role: 'bot',
            text: event.answer || 'Here are your recommendations:',
            sql: null,
            results: null,
            recommendations: event.recommendations || [],
            recOrigin: event.origin || '',
            recModel: event.model || 'ALS',
          }]);
          setStreamSql(null);
          setStatusMsg('');
          break;
        case 'error':
          updateConvMessages(convId, msgs => [...msgs, {
            role: 'bot',
            text: `${event.message || 'Something went wrong'}`,
            sql: null, results: null,
          }]);
          setStreamSql(null);
          setStatusMsg('');
          break;
        case 'done':
          setLoading(false);
          setStatusMsg('');
          setStreamSql(null);
          break;
        default: break;
      }
    });
  };

  /* ── Main send handler — routes based on activeTool ── */
  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setPlusMenuOpen(false);

    if (activeTool === 'recommend') {
      handleRecSend(text);
    } else {
      handleNormalSend(text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, activeConv, activeTool, conversations]);

  /* ── Stop / Cancel handler ── */
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setStatusMsg('');
    setStreamSql(null);
    updateConvMessages(activeConv, msgs => [...msgs, {
      role: 'bot',
      text: '⏹ Generation stopped.',
      sql: null,
      results: null,
    }]);
  }, [activeConv, updateConvMessages]);

  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  /* ── SQL code block ── */
  const renderCodeBlock = (sql, idx) => {
    if (!sql) return null;
    const lines = sql.trim().split('\n');
    return (
      <div className="mac-code-block">
        <div className="mac-code-header">
          <span className="mac-code-lang">&lt;&gt; sql</span>
          <button className="mac-copy-btn" onClick={() => copyToClipboard(sql, idx)}>
            {copiedIdx === idx ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Code</>}
          </button>
        </div>
        <div className="mac-code-body">
          {lines.map((line, i) => (
            <div key={i} className="mac-code-line">
              <span className="mac-line-num">{i + 1}</span>
              <span className="mac-line-text">{highlightSQL(line)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const highlightSQL = (line) => {
    const keywords = /\b(SELECT|FROM|WHERE|AND|OR|GROUP BY|ORDER BY|LIMIT|AS|JOIN|ON|LEFT|RIGHT|INNER|HAVING|COUNT|AVG|MIN|MAX|ROUND|CAST|LIKE|IN|NOT|NULL|IS|BETWEEN|DESC|ASC|DISTINCT|UNION|CASE|WHEN|THEN|END|ELSE|INSERT|INTO|VALUES|CREATE|TABLE|DROP|ALTER|UPDATE|DELETE|SET|WITH|OVER|PARTITION BY|SUBSTR|DOUBLE|INT|STRING|FLOAT)\b/gi;
    const strings = /('[^']*')/g;
    const numbers = /\b(\d+\.?\d*)\b/g;
    let result = line
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(strings, '<span class="sql-string">$1</span>')
      .replace(keywords, '<span class="sql-keyword">$1</span>')
      .replace(numbers, '<span class="sql-number">$1</span>');
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  /* ── Recommendation cards ── */
  const renderRecommendations = (recs, origin, model) => {
    if (!recs || recs.length === 0) return null;
    return (
      <div className="rec-container">
        <div className="rec-header">
          <Zap size={16} className="rec-header-icon" />
          <span>Powered by <strong>{model || 'Smart Route Scoring'}</strong></span>
        </div>
        <div className="rec-grid">
          {recs.map((r, i) => {
            const dest = r.destinationAirport || '?';
            const city = r.city || dest;
            const minFare = r.minFare != null ? `$${Math.round(r.minFare)}` : '—';
            const avgFare = r.avgFare != null ? `$${Math.round(r.avgFare)}` : '—';
            const flights = r.flightCount || 0;
            const nonstop = r.nonstopCount || 0;
            const airlines = r.airlineCount || 0;
            const score = r.alsScore || 0;
            const nsPct = flights > 0 ? Math.round((nonstop / flights) * 100) : 0;
            return (
              <div key={i} className="rec-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="rec-card-rank">#{i + 1}</div>
                <div className="rec-card-top">
                  <div className="rec-route">
                    <span className="rec-origin">{origin}</span>
                    <Plane size={14} className="rec-plane-icon" />
                    <span className="rec-dest">{dest}</span>
                  </div>
                  <div className="rec-city"><MapPin size={12} /> {city}</div>
                </div>
                <div className="rec-card-price">
                  <span className="rec-price-main">{minFare}</span>
                  <span className="rec-price-avg">avg {avgFare}</span>
                </div>
                <div className="rec-card-stats">
                  <div className="rec-stat"><Plane size={11} /> {flights.toLocaleString()} flights</div>
                  <div className="rec-stat"><TrendingUp size={11} /> {nsPct}% nonstop</div>
                  <div className="rec-stat"><DollarSign size={11} /> {airlines} airlines</div>
                </div>
                <div className="rec-card-score">
                  <div className="rec-score-bar">
                    <div className="rec-score-fill" style={{ width: `${Math.min(score / 2, 100)}%` }} />
                  </div>
                  <span className="rec-score-label">Score: {score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Data table ── */
  const renderResults = (results) => {
    if (!results || results.length === 0) return null;
    const cols = Object.keys(results[0]);
    return (
      <div className="mac-data-table-wrap">
        <table className="mac-data-table">
          <thead>
            <tr>{cols.map((col, i) => <th key={i}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {results.slice(0, 20).map((row, ri) => (
              <tr key={ri}>
                {cols.map((col, ci) => (
                  <td key={ci}>{row[col] != null ? String(row[col]) : '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {results.length > 20 && (
          <div className="mac-table-footer">Showing 20 of {results.length} results</div>
        )}
      </div>
    );
  };

  const suggestions = [
    "Cheapest flights from ATL to LAX",
    "Average fare by airline from JFK to SFO",
    "How many nonstop flights from ORD?",
    "Show flights under $200 from MIA",
  ];

  const placeholder = activeTool === 'recommend'
    ? 'Type airport code, e.g. "ATL" or "LAX under $300 nonstop"...'
    : 'Ask about flights, prices, airports...';

  return (
    <div className={`mac-window-wrapper ${zoomed ? 'mac-zoomed' : ''}`}>
      {/* ═══ Mac Chrome ═══ */}
      <div className="mac-chrome">
        <div className="mac-chrome-left">
          <div className="mac-dots">
            <span className="mac-dot red" />
            <span className="mac-dot yellow" />
            <span className="mac-dot green" />
          </div>
          <button className="mac-zoom-btn" onClick={() => setZoomed(z => !z)} title={zoomed ? 'Exit fullscreen' : 'Fullscreen'}>
            {zoomed ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
        <div className="mac-url-bar">
          <span className="mac-lock"><Lock size={12} /></span> dataturbulence.ai/chat
        </div>
      </div>

      <div className="mac-body">
        {/* ═══ Sidebar ═══ */}
        <aside className="mac-sidebar">
          <div className="mac-sidebar-top">
            <div className="mac-brand">
              <Sparkles size={18} className="mac-brand-icon" />
              <span className="mac-brand-text">DataTurbulence</span>
            </div>

            <button className="mac-new-conv" onClick={handleNewConversation}>
              <Plus size={16} /> New Conversation
            </button>

            <div className="mac-search-box">
              <Search size={14} />
              <input type="text" placeholder="Search chats..." />
            </div>

            <div className="mac-recent-label">RECENT ACTIVITY</div>
            <div className="mac-conv-list">
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`mac-conv-item ${c.id === activeConv ? 'active' : ''}`}
                  onClick={() => { setActiveConv(c.id); setInput(''); }}
                >
                  <MessageSquare size={14} />
                  <span className="mac-conv-title">{c.title}</span>
                  {c.id === activeConv && <span className="mac-conv-dot" />}
                </div>
              ))}
            </div>
          </div>

          <div className="mac-sidebar-bottom">
            <div className="mac-hive-status">
              <span className="mac-hive-dot" />
              <span className="mac-hive-label">HIVE CONNECTED</span>
            </div>
          </div>
        </aside>

        {/* ═══ Chat Area ═══ */}
        <main className="mac-chat-main">
          {/* Messages */}
          <div className="mac-messages">
            {activeMessages.length === 0 && !loading && (
              <div className="mac-welcome">
                <div className="mac-welcome-icon"><Bot size={48} /></div>
                <h2>Ask me anything about flights</h2>
                <p>I query databases, recommend destinations, or just chat. Use the <strong>+</strong> button to pick a tool like Recommendations.</p>
                <div className="mac-suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} className="mac-suggestion-btn" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeMessages.map((msg, i) => (
              <div key={i} className={`mac-msg ${msg.role}`}>
                <div className="mac-msg-avatar">
                  {msg.role === 'bot' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className="mac-msg-content">
                  <div className="mac-msg-text">{msg.text}</div>
                  {msg.sql && renderCodeBlock(msg.sql, i)}
                  {msg.recommendations && renderRecommendations(msg.recommendations, msg.recOrigin, msg.recModel)}
                  {msg.results && renderResults(msg.results)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="mac-msg bot">
                <div className="mac-msg-avatar"><Bot size={18} /></div>
                <div className="mac-msg-content">
                  <div className="mac-msg-text mac-loading">
                    <div className="mac-typing-dots">
                      <span /><span /><span />
                    </div>
                    <span>{statusMsg || 'Thinking...'}</span>
                  </div>
                  {streamSql && renderCodeBlock(streamSql, 'stream')}
                </div>
              </div>
            )}

            <div ref={messagesEnd} />
          </div>

          {/* ═══ DeepSeek-style Input Area ═══ */}
          <div className="ds-input-area">
            <div className="ds-input-container">
              {/* Text input row */}
              <div className="ds-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="ds-text-input"
                />
              </div>
              {/* Bottom row: pills on left, actions on right */}
              <div className="ds-bottom-row">
                <div className="ds-pills">
                  <button
                    className={`ds-pill ${activeTool === 'recommend' ? 'active' : ''}`}
                    onClick={() => setActiveTool(prev => prev === 'recommend' ? null : 'recommend')}
                    disabled={loading}
                  >
                    <Compass size={14} />
                    <span>Recommendations</span>
                  </button>
                </div>
                <div className="ds-actions">
                  <Mic size={18} className="ds-action-icon" />
                  {loading ? (
                    <button
                      className="ds-stop-btn"
                      onClick={handleStop}
                      title="Stop generating"
                    >
                      <Square size={14} />
                    </button>
                  ) : (
                    <button
                      className={`ds-send-btn ${input.trim() ? 'active' : ''}`}
                      onClick={handleSend}
                      disabled={!input.trim()}
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mac-powered">
            POWERED BY <span className="mac-powered-highlight">DATATURBULENCE</span> • AI CAN MAKE MISTAKES
          </div>
        </main>
      </div>
    </div>
  );
}

export default Chatbot;
