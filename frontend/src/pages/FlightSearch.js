import React, { useState, useTransition, useId, useCallback, useMemo, useEffect, useRef } from 'react';
import { Search, Plane, ChevronDown, ChevronUp, MoreHorizontal, DollarSign, Star, CheckCircle, XCircle, Armchair, Eye, AlertTriangle, Clock } from 'lucide-react';
import { searchFlights } from '../api';

// Custom Dropdown Component
function CustomSelect({ label, value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="custom-select" ref={ref}>
      {label && <label className="custom-select-label">{label}</label>}
      <div className={`custom-select-trigger ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span>{selected?.label || value}</span>
        <ChevronDown size={14} className={`custom-select-arrow ${isOpen ? 'rotated' : ''}`} />
      </div>
      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`custom-select-option ${opt.value === value ? 'active' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
              {opt.value === value && <span className="custom-select-check" style={{ display: 'inline-flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlightSearch() {
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [date, setDate] = useState('');
  const [nonstop, setNonstop] = useState(false);
  const [sort, setSort] = useState('cheapest');
  const [limit, setLimit] = useState(20);
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showQuery, setShowQuery] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);

  const [isPending, startTransition] = useTransition();

  const originId = useId();
  const destId = useId();
  const dateId = useId();
  const limitId = useId();
  const nonstopId = useId();

  const doSearch = useCallback(async (sortOverride) => {
    if (!origin || !dest) return;
    setError('');
    setFlights([]);
    setSearched(true);
    setOpenMenu(null);

    const sortToUse = sortOverride || sort;

    startTransition(async () => {
      try {
        const res = await searchFlights({ origin, dest, nonstop, sort: sortToUse, limit, date });
        setFlights(res.data.flights || []);
        setQuery(res.data.query || '');
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setQuery(err.response?.data?.query || '');
      }
    });
  }, [origin, dest, nonstop, sort, limit, date]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    doSearch();
  }, [doSearch]);

  // Re-fetch when sort changes (only if already searched)
  const prevSort = useRef(sort);
  useEffect(() => {
    if (prevSort.current !== sort && searched && origin && dest) {
      prevSort.current = sort;
      doSearch(sort);
    }
  }, [sort, searched, origin, dest, doSearch]);

  const formatTime = (raw) => {
    if (!raw) return '--:--';
    const parts = raw.split('||');
    const match = parts[0]?.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '--:--';
  };

  const getArrivalTime = (raw) => {
    if (!raw) return '--:--';
    const parts = raw.split('||');
    const last = parts[parts.length - 1];
    const match = last?.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '--:--';
  };

  const formatDuration = (dur) => {
    if (!dur) return '';
    const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) return `${match[1] || '0'}h ${match[2] || '0'}m`;
    return dur;
  };

  const getFlightStatus = (f) => {
    const isNonstop = (f.isnonstop || f.isNonStop) === 'True';
    const seats = Number(f.seatsremaining || f.seatsRemaining || 99);
    if (seats <= 2) return 'critical';
    if (isNonstop) return 'success';
    return 'pending';
  };

  const getStatusLabel = (status) => {
    if (status === 'success') return 'Nonstop';
    if (status === 'critical') return 'Few Left';
    return 'Connecting';
  };

  const getFare = (f) => Number(f.totalfare || f.totalFare || 0);
  const getDurMins = (f) => {
    const dur = f.travelduration || f.travelDuration || '';
    const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) return (parseInt(match[1] || '0', 10) * 60) + parseInt(match[2] || '0', 10);
    return 99999;
  };
  const isNonstopFlight = (f) => (f.isnonstop || f.isNonStop) === 'True';

  // Filter by status
  const statusFiltered = flights.filter(f => {
    if (statusFilter === 'All') return true;
    const status = getFlightStatus(f);
    if (statusFilter === 'Nonstop') return status === 'success';
    if (statusFilter === 'Connecting') return status === 'pending';
    if (statusFilter === 'Few Left') return status === 'critical';
    return true;
  });

  // Sort by selected criteria
  const filteredFlights = [...statusFiltered].sort((a, b) => {
    if (sort === 'cheapest') {
      return getFare(a) - getFare(b);
    }
    if (sort === 'fastest') {
      return getDurMins(a) - getDurMins(b);
    }
    if (sort === 'best') {
      // Best = nonstop first, then cheapest + fastest combined
      const nsA = isNonstopFlight(a) ? 0 : 1;
      const nsB = isNonstopFlight(b) ? 0 : 1;
      if (nsA !== nsB) return nsA - nsB;
      const scoreA = getFare(a) * 0.6 + getDurMins(a) * 0.4;
      const scoreB = getFare(b) * 0.6 + getDurMins(b) * 0.4;
      return scoreA - scoreB;
    }
    return 0;
  });

  return (
    <div className="page-container">
      <title>Search Flights — SkyQuery</title>

      <div className="page-hero">
        <h1><Plane size={30} style={{ display: 'inline', verticalAlign: 'middle' }} /> Search Flights</h1>
        <p>Search through 80M+ flight itineraries powered by Hive</p>
      </div>

      <form onSubmit={handleSearch}>
        <div className="search-panel">
          <div className="search-row">
            <div className="input-group">
              <label htmlFor={originId}>From</label>
              <input id={originId} type="text" placeholder="e.g. ATL" value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())} maxLength={3} required />
            </div>
            <div className="input-group">
              <label htmlFor={destId}>To</label>
              <input id={destId} type="text" placeholder="e.g. LAX" value={dest}
                onChange={(e) => setDest(e.target.value.toUpperCase())} maxLength={3} required />
            </div>
            <div className="input-group">
              <label htmlFor={dateId}>Date (optional)</label>
              <input id={dateId} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <CustomSelect
              label="Limit"
              value={limit}
              onChange={(v) => setLimit(v)}
              options={[
                { value: 10, label: '10 results' },
                { value: 20, label: '20 results' },
                { value: 50, label: '50 results' },
              ]}
            />
            <button className="btn-primary" type="submit" disabled={isPending || !origin || !dest}>
              <Search size={18} />
              {isPending ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="checkbox-group">
            <input type="checkbox" id={nonstopId} checked={nonstop} onChange={(e) => setNonstop(e.target.checked)} />
            <label htmlFor={nonstopId}>Nonstop flights only</label>
          </div>
        </div>
      </form>

      {error && <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {error}</div>}

      {isPending && (
        <div className="loading-container">
          <div className="spinner" />
          <div className="loading-text">
            Scanning flight database...
            <span className="warning"><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Hive queries may take 2–8 minutes on 80M rows</span>
          </div>
        </div>
      )}

      {!isPending && searched && flights.length > 0 && (
        <>
          {/* Filter bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="sort-buttons">
              {['cheapest', 'fastest', 'best'].map(s => (
                <button key={s} className={`sort-btn ${sort === s ? 'active' : ''}`} onClick={() => setSort(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { value: 'All', label: 'Show: All' },
                { value: 'Nonstop', label: 'Nonstop' },
                { value: 'Connecting', label: 'Connecting' },
                { value: 'Few Left', label: 'Few Left' },
              ]}
            />
          </div>

          <div className="result-count">
            Showing <strong>{filteredFlights.length}</strong> of <strong>{flights.length}</strong> flights
          </div>

          {/* Table */}
          <div className="data-table-wrapper">
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Airline</th>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlights.map((f, i) => {
                  const isNonstop = (f.isnonstop || f.isNonStop) === 'True';
                  const isRefundable = (f.isrefundable || f.isRefundable) === 'True';
                  const seats = Number(f.seatsremaining || f.seatsRemaining || 99);
                  const status = getFlightStatus(f);
                  const statusLabel = getStatusLabel(status);
                  const fare = Number(f.totalfare || f.totalFare || 0);
                  const airline = f.segmentsairlinename || f.segmentsAirlineName || 'Unknown';
                  const depTime = formatTime(f.segmentsdeparturetimeraw || f.segmentsDepartureTimeRaw);
                  const arrTime = getArrivalTime(f.segmentsarrivaltimeraw || f.segmentsArrivalTimeRaw);
                  const duration = formatDuration(f.travelduration || f.travelDuration);
                  const orig = f.startingairport || f.startingAirport;
                  const destination = f.destinationairport || f.destinationAirport;
                  const flightDate = f.flightdate || f.flightDate || '';

                  return (
                    <tr key={`${i}-${f.legid || f.legId}`} className="flight-row-anim" style={{ animationDelay: `${i * 0.06}s` }}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#c0c0c0', fontSize: 13 }}>{airline.split('||')[0]}</div>
                        <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>
                          {f.segmentsairlinecode || f.segmentsAirlineCode || ''}
                          {flightDate && <span style={{ marginLeft: 8 }}>{flightDate}</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#f5a623', fontWeight: 700, letterSpacing: 0.5 }}>{orig}</span>
                        <span style={{ color: '#333', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#f5a623', fontWeight: 700, letterSpacing: 0.5 }}>{destination}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#e0e0e0', fontSize: 15 }}>{depTime}</td>
                      <td style={{ fontWeight: 700, color: '#e0e0e0', fontSize: 15 }}>{arrTime}</td>
                      <td style={{ color: '#666', fontSize: 13 }}>{duration}</td>
                      <td>
                        <span style={{
                          fontWeight: 900, fontSize: 18, color: '#f5a623',
                          textShadow: '0 0 20px rgba(245,166,35,0.15)',
                          letterSpacing: -0.5
                        }}>
                          ${fare.toFixed(0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${status}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', position: 'relative' }}>
                        <button className="manage-btn"
                          onClick={() => setOpenMenu(openMenu === i ? null : i)}>
                          Manage <ChevronDown size={14} />
                        </button>
                        {openMenu === i && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', zIndex: 50,
                            background: 'rgba(13,13,13,0.95)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 10, padding: '6px 0', minWidth: 180,
                            boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)'
                          }}>
                            {[
                              { icon: <Eye size={14} />, label: 'View Details' },
                              { icon: isRefundable ? <CheckCircle size={14} /> : <XCircle size={14} />, label: isRefundable ? 'Refundable' : 'Non-refundable' },
                              { icon: <Armchair size={14} />, label: `${seats} seats left` },
                              { icon: <DollarSign size={14} />, label: `Base: $${Number(f.basefare || f.baseFare || 0).toFixed(0)}` },
                            ].map((item, idx) => (
                              <div key={idx} style={{
                                padding: '10px 16px', fontSize: 13, color: '#888', cursor: 'pointer',
                                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8
                              }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,166,35,0.05)'; e.currentTarget.style.color = '#bbb'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                              >
                                <span>{item.icon}</span> {item.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stat Summary Cards — Midnight Voyager style */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-icon"><Plane size={18} /></div>
              <div className="stat-value">{filteredFlights.length}</div>
              <div className="stat-label">Flights found</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><DollarSign size={18} /></div>
              <div className="stat-value">
                ${filteredFlights.length > 0
                  ? Math.min(...filteredFlights.map(f => Number(f.totalfare || f.totalFare || 0))).toFixed(0)
                  : '—'}
              </div>
              <div className="stat-label">Lowest fare</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Star size={18} /></div>
              <div className="stat-value">
                {filteredFlights.filter(f => (f.isnonstop || f.isNonStop) === 'True').length}
              </div>
              <div className="stat-label">Nonstop options</div>
            </div>
          </div>
        </>
      )}

      {!isPending && searched && flights.length === 0 && !error && (
        <div className="empty-state">
          <div className="icon"><Search size={48} /></div>
          <h3>No flights found</h3>
          <p>Try different airports or remove the nonstop filter</p>
        </div>
      )}

      {!searched && !isPending && (
        <div className="empty-state">
          <div className="icon"><Plane size={48} /></div>
          <h3>Search for flights</h3>
          <p>Enter origin and destination airport codes (e.g., ATL → LAX)</p>
        </div>
      )}

      {query && (
        <div className="query-debug">
          <button className="query-toggle" onClick={() => setShowQuery(!showQuery)}>
            {showQuery ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showQuery ? 'Hide' : 'Show'} HiveQL Query
          </button>
          {showQuery && <pre className="query-code">{query}</pre>}
        </div>
      )}
    </div>
  );
}

export default FlightSearch;
