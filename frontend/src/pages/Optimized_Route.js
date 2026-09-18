import React, { useState, useEffect } from 'react';
import { Search, Map, Plane, ArrowRight, Clock, DollarSign, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Shuffle, Calendar } from 'lucide-react';
import { flightSplicing } from '../api';

function OptimizedRoute() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [recentOrigins, setRecentOrigins] = useState([]);
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [showQuery, setShowQuery] = useState(false);

  useEffect(() => {
    const savedOrigins = JSON.parse(localStorage.getItem('recentOrigins') || '[]');
    const savedDestinations = JSON.parse(localStorage.getItem('recentDestinations') || '[]');
    setRecentOrigins(savedOrigins);
    setRecentDestinations(savedDestinations);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!origin || !destination) {
      setError('Please fill in Origin and Destination before searching.');
      return;
    }

    setError('');
    setIsLoading(true);
    setResults(null);

    // Save recent inputs
    const newOrigins = Array.from(new Set([origin, ...recentOrigins])).slice(0, 5);
    const newDestinations = Array.from(new Set([destination, ...recentDestinations])).slice(0, 5);
    localStorage.setItem('recentOrigins', JSON.stringify(newOrigins));
    localStorage.setItem('recentDestinations', JSON.stringify(newDestinations));
    setRecentOrigins(newOrigins);
    setRecentDestinations(newDestinations);

    try {
      const params = {
        origin,
        dest: destination,
        limit: 20,
      };
      if (date) params.date = date;

      const response = await flightSplicing(params);
      setResults(response.data);

      if (response.data.error) {
        setError(response.data.error);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to fetch optimized routes';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '—';
    return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="page-container">
      <style>{`
        @keyframes planeOrbit {
          0% { transform: rotate(0deg) translateX(20px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(20px) rotate(-360deg); }
        }
        .plane-spinner {
          display: inline-block;
          animation: planeOrbit 1.5s linear infinite;
          color: #f5a623;
        }
        .or-direct-card {
          background: rgba(110, 198, 255, 0.06);
          border: 1px solid rgba(110, 198, 255, 0.15);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          backdrop-filter: blur(8px);
        }
        .or-direct-label {
          font-size: 13px;
          color: rgba(200, 216, 232, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .or-direct-value {
          font-size: 28px;
          font-weight: 800;
          color: #6ec6ff;
          letter-spacing: -0.5px;
        }
        .or-direct-stat {
          text-align: center;
        }
        .or-direct-stat .stat-num {
          font-size: 20px;
          font-weight: 700;
          color: #e0e8f0;
        }
        .or-direct-stat .stat-lbl {
          font-size: 11px;
          color: rgba(200, 216, 232, 0.4);
          margin-top: 2px;
        }
        .or-itinerary-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 10px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(4px);
        }
        .or-itinerary-card:hover {
          border-color: rgba(245, 166, 35, 0.2);
          background: rgba(255, 255, 255, 0.06);
        }
        .or-itinerary-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(245, 166, 35, 0.3), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .or-itinerary-card:hover::before {
          opacity: 1;
        }
        .or-itinerary-card.cross-alliance {
          border-color: rgba(168, 85, 247, 0.2);
        }
        .or-itinerary-card.cross-alliance::before {
          background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.4), transparent);
        }
        .or-itin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 14px;
        }
        .or-route-visual {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .or-airport-badge {
          background: rgba(110, 198, 255, 0.1);
          border: 1px solid rgba(110, 198, 255, 0.2);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 16px;
          font-weight: 800;
          color: #6ec6ff;
          letter-spacing: 0.5px;
        }
        .or-hub-badge {
          background: rgba(245, 166, 35, 0.1);
          border-color: rgba(245, 166, 35, 0.25);
          color: #f5a623;
        }
        .or-arrow {
          color: rgba(200, 216, 232, 0.3);
        }
        .or-combined-fare {
          text-align: right;
        }
        .or-combined-fare .fare {
          font-size: 26px;
          font-weight: 900;
          color: #f5a623;
          letter-spacing: -1px;
          text-shadow: 0 0 20px rgba(245, 166, 35, 0.2);
        }
        .or-itin-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .or-detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .or-detail-item .icon {
          color: rgba(200, 216, 232, 0.3);
          flex-shrink: 0;
        }
        .or-detail-item .label {
          font-size: 11px;
          color: rgba(200, 216, 232, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .or-detail-item .value {
          font-size: 14px;
          color: #c8d8e8;
          font-weight: 600;
        }
        .or-savings-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
        }
        .or-savings-badge.positive {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #22c55e;
        }
        .or-cross-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.25);
          color: #a855f7;
          margin-left: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .or-no-results {
          text-align: center;
          padding: 60px 20px;
        }
        .or-no-results .icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
        }
        .or-no-results h3 {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }
        .or-no-results p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.35);
          max-width: 500px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .or-section-title {
          font-size: 16px;
          font-weight: 700;
          color: #e0e8f0;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .or-section-subtitle {
          font-size: 12px;
          color: rgba(200, 216, 232, 0.4);
          margin-left: 8px;
          font-weight: 400;
        }
        .or-rank {
          position: absolute;
          top: 12px;
          right: 16px;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(245, 166, 35, 0.1);
          border: 1px solid rgba(245, 166, 35, 0.2);
          color: #f5a623;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .or-info-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: rgba(110, 198, 255, 0.04);
          border: 1px solid rgba(110, 198, 255, 0.1);
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 12px;
          color: rgba(200, 216, 232, 0.5);
          flex-wrap: wrap;
        }
        .or-info-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── Eye-Catching Stats Grid ── */
        .or-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 28px;
        }
        @media (max-width: 900px) { .or-stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .or-stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 22px 18px;
          text-align: center;
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .or-stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 16px 16px 0 0;
        }
        .or-stat-card.gold::before { background: linear-gradient(90deg, transparent, #f5a623, transparent); }
        .or-stat-card.blue::before { background: linear-gradient(90deg, transparent, #6ec6ff, transparent); }
        .or-stat-card.green::before { background: linear-gradient(90deg, transparent, #22c55e, transparent); }
        .or-stat-card.purple::before { background: linear-gradient(90deg, transparent, #a855f7, transparent); }
        .or-stat-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }
        .or-stat-icon { font-size: 28px; margin-bottom: 8px; }
        .or-stat-number { font-size: 26px; font-weight: 900; letter-spacing: -1px; margin-bottom: 4px; }
        .or-stat-card.gold .or-stat-number { color: #f5a623; text-shadow: 0 0 20px rgba(245,166,35,0.2); }
        .or-stat-card.blue .or-stat-number { color: #6ec6ff; text-shadow: 0 0 20px rgba(110,198,255,0.2); }
        .or-stat-card.green .or-stat-number { color: #22c55e; text-shadow: 0 0 20px rgba(34,197,94,0.2); }
        .or-stat-card.purple .or-stat-number { color: #a855f7; text-shadow: 0 0 20px rgba(168,85,247,0.2); }
        .or-stat-label { font-size: 12px; font-weight: 700; color: rgba(224,232,240,0.7); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px; }
        .or-stat-sub { font-size: 11px; color: rgba(200,216,232,0.35); }

        /* ── Powered by PySpark Box ── */
        .or-spark-box {
          margin-top: 32px;
          background: linear-gradient(135deg, rgba(245,166,35,0.04), rgba(110,198,255,0.04));
          border: 1px solid rgba(245,166,35,0.15);
          border-radius: 16px;
          overflow: hidden;
        }
        .or-spark-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }
        .or-spark-header:hover { background: rgba(245,166,35,0.04); }
        .or-spark-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .or-spark-logo {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 20px;
          background: rgba(245,166,35,0.1);
          border: 1px solid rgba(245,166,35,0.25);
          font-size: 12px;
          font-weight: 800;
          color: #f5a623;
          letter-spacing: 0.5px;
        }
        .or-spark-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(224,232,240,0.8);
        }
        .or-spark-subtitle {
          font-size: 11px;
          color: rgba(200,216,232,0.35);
          margin-top: 2px;
        }
        .or-spark-chevron { color: rgba(200,216,232,0.3); transition: transform 0.2s; }
        .or-spark-chevron.open { transform: rotate(180deg); }
        .or-spark-body {
          padding: 0 20px 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .or-spark-tech {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 14px 0;
        }
        .or-spark-tag {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .or-spark-tag.spark { background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.2); color: #f5a623; }
        .or-spark-tag.hive { background: rgba(110,198,255,0.1); border: 1px solid rgba(110,198,255,0.2); color: #6ec6ff; }
        .or-spark-tag.yarn { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #22c55e; }
        .or-spark-tag.hdfs { background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); color: #a855f7; }
      `}</style>

      <div className="page-hero">
        <h1><Map size={30} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Route Optimization</h1>
        <p>Intelligent flight splicing engine — finds cost-saving virtual itineraries by combining disconnected segments</p>
      </div>

      <form onSubmit={handleSearch}>
        <div className="search-panel">
          <div className="search-row">
            <div className="input-group">
              <label>ORIGIN</label>
              <input
                type="text"
                list="origins-list"
                placeholder="e.g. ATL"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              />
              <datalist id="origins-list">
                {recentOrigins.map((org, i) => (
                  <option key={i} value={org} />
                ))}
              </datalist>
            </div>

            <div className="input-group">
              <label>DESTINATION</label>
              <input
                type="text"
                list="destinations-list"
                placeholder="e.g. SFO"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
              />
              <datalist id="destinations-list">
                {recentDestinations.map((dest, i) => (
                  <option key={i} value={dest} />
                ))}
              </datalist>
            </div>

            <div className="input-group">
              <label>FLIGHT DATE (OPTIONAL)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={isLoading}>
              {isLoading ? (
                <div style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plane size={14} className="plane-spinner" />
                </div>
              ) : (
                <Search size={18} />
              )}
              {isLoading ? 'Optimizing...' : 'Find Routes'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="error-banner" style={{ marginTop: '16px' }}><AlertCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />{error}</div>}

      {isLoading && (
        <div style={{ textAlign: 'center', marginTop: '40px', padding: '40px' }}>
          <Plane size={40} className="plane-spinner" />
          <p style={{ marginTop: '20px', color: '#a0aec0', fontFamily: 'inherit' }}>Scanning for optimized multi-segment routes...</p>
          <p style={{ marginTop: '8px', color: 'rgba(160, 174, 192, 0.5)', fontSize: '12px' }}>
            Analyzing flight segments, enforcing 90min–8hr layover window, comparing against direct fares
          </p>
          <p style={{ marginTop: '4px', color: 'rgba(245, 166, 35, 0.5)', fontSize: '11px' }}>
            ⏱ Hive queries may take 2–8 minutes on 80M rows
          </p>
        </div>
      )}

      {/* Results */}
      {results && !isLoading && (
        <div style={{ marginTop: '24px' }}>
          {/* Info bar */}
          <div className="or-info-bar">
            <div className="or-info-item">
              <Clock size={12} /> Layover: 90min – 8hr (auto)
            </div>
            <div className="or-info-item">
              <TrendingDown size={12} /> Only showing routes with savings
            </div>
            <div className="or-info-item">
              <Shuffle size={12} /> Cross-alliance detection active
            </div>
            {results.totalScanned > 0 && (
              <div className="or-info-item">
                Scanned {results.totalScanned} combinations
              </div>
            )}
          </div>

          {/* ── Eye-Catching Stats Dashboard ── */}
          {(() => {
            const bd = results.direct?.bestDirect || results.direct?.bestdirect;
            const ad = results.direct?.avgDirect || results.direct?.avgdirect;
            const dc = results.direct?.directCount || results.direct?.directcount || 0;
            const bestSaving = results.itineraries?.length > 0 ? results.itineraries[0]?.savings || 0 : 0;
            const bestPct = results.itineraries?.length > 0 ? results.itineraries[0]?.savingsPercent || 0 : 0;
            const crossCount = (results.itineraries || []).filter(i => i.crossAlliance).length;
            return (
              <div className="or-stats-grid">
                <div className="or-stat-card gold">
                  <div className="or-stat-icon">💰</div>
                  <div className="or-stat-number">{bd ? formatCurrency(bd) : '—'}</div>
                  <div className="or-stat-label">Best Direct Fare</div>
                  <div className="or-stat-sub">{results.origin} → {results.dest}</div>
                </div>
                <div className="or-stat-card blue">
                  <div className="or-stat-icon">📊</div>
                  <div className="or-stat-number">{ad ? formatCurrency(ad) : '—'}</div>
                  <div className="or-stat-label">Avg Direct Fare</div>
                  <div className="or-stat-sub">{Number(dc).toLocaleString()} flights found</div>
                </div>
                <div className="or-stat-card green">
                  <div className="or-stat-icon">🔥</div>
                  <div className="or-stat-number">{bestSaving > 0 ? formatCurrency(bestSaving) : '—'}</div>
                  <div className="or-stat-label">Max Saving</div>
                  <div className="or-stat-sub">{bestPct > 0 ? `${bestPct}% cheaper` : 'No savings found'}</div>
                </div>
                <div className="or-stat-card purple">
                  <div className="or-stat-icon">🔀</div>
                  <div className="or-stat-number">{results.totalScanned || 0}</div>
                  <div className="or-stat-label">Combos Scanned</div>
                  <div className="or-stat-sub">{crossCount > 0 ? `${crossCount} cross-alliance` : 'Same-airline only'}</div>
                </div>
              </div>
            );
          })()}

          {/* Spliced Itineraries */}
          {results.itineraries && results.itineraries.length > 0 ? (
            <>
              <div className="or-section-title">
                <TrendingDown size={18} style={{ color: '#22c55e' }} />
                {results.itineraries.length} Optimized Route{results.itineraries.length !== 1 ? 's' : ''} Found
                <span className="or-section-subtitle">sorted by highest savings</span>
              </div>

              {results.itineraries.map((it, idx) => {
                const hub = it.hub || it.Hub;
                const fare1 = it.fare1 || it.Fare1 || 0;
                const fare2 = it.fare2 || it.Fare2 || 0;
                const combined = it.combinedFare || it.combinedfare || 0;
                const savings = it.savings || 0;
                const savingsPct = it.savingsPercent || it.savingspercent || 0;
                const layover = it.layoverHours || it.layoverhours;
                const airline1 = it.airline1 || it.Airline1 || '—';
                const airline2 = it.airline2 || it.Airline2 || '—';
                const flightDate = it.flightDate || it.flightdate || '';
                const isCrossAlliance = it.crossAlliance || false;

                return (
                  <div key={idx} className={`or-itinerary-card ${isCrossAlliance ? 'cross-alliance' : ''}`}>
                    <div className="or-rank">#{idx + 1}</div>
                    <div className="or-itin-header">
                      <div className="or-route-visual">
                        <span className="or-airport-badge">{results.origin}</span>
                        <ArrowRight size={16} className="or-arrow" />
                        <span className="or-airport-badge or-hub-badge">{hub}</span>
                        <ArrowRight size={16} className="or-arrow" />
                        <span className="or-airport-badge">{results.dest}</span>
                        {isCrossAlliance && (
                          <span className="or-cross-badge">
                            <Shuffle size={10} /> Cross-Alliance
                          </span>
                        )}
                      </div>
                      <div className="or-combined-fare">
                        <div className="fare">{formatCurrency(combined)}</div>
                        {savings > 0 && (
                          <span className="or-savings-badge positive">
                            <TrendingDown size={13} />
                            Save {formatCurrency(savings)} ({savingsPct}%)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="or-itin-details">
                      <div className="or-detail-item">
                        <Plane size={14} className="icon" />
                        <div>
                          <div className="label">Leg 1 — {results.origin} → {hub}</div>
                          <div className="value">{airline1} — {formatCurrency(fare1)}</div>
                        </div>
                      </div>
                      <div className="or-detail-item">
                        <Plane size={14} className="icon" />
                        <div>
                          <div className="label">Leg 2 — {hub} → {results.dest}</div>
                          <div className="value">{airline2} — {formatCurrency(fare2)}</div>
                        </div>
                      </div>
                      {layover !== null && layover !== undefined && (
                        <div className="or-detail-item">
                          <Clock size={14} className="icon" />
                          <div>
                            <div className="label">Layover at {hub}</div>
                            <div className="value">{layover}h</div>
                          </div>
                        </div>
                      )}
                      {flightDate && (
                        <div className="or-detail-item">
                          <Calendar size={14} className="icon" />
                          <div>
                            <div className="label">Flight Date</div>
                            <div className="value">{flightDate}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            !error && (
              <div className="or-no-results">
                <div className="icon">✈️</div>
                <h3>No Cost-Saving Routes Found</h3>
                <p>
                  No multi-segment combinations beat the cheapest direct flight for {results.origin} → {results.dest}.
                  {!date ? ' Try specifying a flight date to narrow results.' : ' Try a different date or route.'}
                </p>
              </div>
            )
          )}

          {/* ── Powered by PySpark / HiveQL Query Viewer ── */}
          {(results.directQuery || results.spliceQuery) && (
            <div className="or-spark-box">
              <div className="or-spark-header" onClick={() => setShowQuery(!showQuery)}>
                <div className="or-spark-header-left">
                  <span className="or-spark-logo">⚡ APACHE SPARK™</span>
                  <div>
                    <div className="or-spark-title">View HiveQL / SparkSQL Queries</div>
                    <div className="or-spark-subtitle">Powered by PySpark on YARN • Hive Metastore • HDFS</div>
                  </div>
                </div>
                <ChevronDown size={18} className={`or-spark-chevron ${showQuery ? 'open' : ''}`} />
              </div>
              {showQuery && (
                <div className="or-spark-body">
                  <div className="or-spark-tech">
                    <span className="or-spark-tag spark">PySpark 3.5</span>
                    <span className="or-spark-tag hive">HiveQL</span>
                    <span className="or-spark-tag yarn">YARN</span>
                    <span className="or-spark-tag hdfs">HDFS</span>
                  </div>
                  {results.directQuery && (
                    <>
                      <div style={{ fontSize: '11px', color: '#f5a623', marginTop: '12px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ① Direct Baseline Query
                      </div>
                      <pre className="query-code">{results.directQuery}</pre>
                    </>
                  )}
                  {results.spliceQuery && (
                    <>
                      <div style={{ fontSize: '11px', color: '#6ec6ff', marginTop: '16px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ② Flight Splice Query (Self-JOIN)
                      </div>
                      <pre className="query-code">{results.spliceQuery}</pre>
                    </>
                  )}
                  <div style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(200,216,232,0.3)', lineHeight: 1.6 }}>
                    These queries execute on <strong style={{ color: 'rgba(245,166,35,0.6)' }}>Apache Spark™ 3.5.3</strong> via
                    YARN on a 3-node Hadoop cluster, reading from <strong style={{ color: 'rgba(110,198,255,0.6)' }}>Hive Metastore</strong> (ext_itineraries table, ~80M rows on HDFS).
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial state - no search yet */}
      {!results && !isLoading && !error && (
        <div className="or-no-results" style={{ marginTop: '40px' }}>
          <div className="icon">🗺️</div>
          <h3>Intelligent Flight Splicing Engine</h3>
          <p>
            Enter an origin and destination to discover hidden multi-segment routes
            that beat direct flight prices. The engine autonomously scans for disconnected
            flight segments, enforces safe layover windows (90min–8hr), detects cross-alliance
            "Frankenstein" routes mixing carriers, and only shows itineraries with real savings.
          </p>
        </div>
      )}
    </div>
  );
}

export default OptimizedRoute;
