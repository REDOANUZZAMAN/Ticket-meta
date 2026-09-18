import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, ArrowLeft, TrendingUp, BarChart3, Calendar, Clock, Sun, Layers, Globe, MapPin, Navigation, Plane, Users, Building2, Armchair, Ruler, Cpu, DollarSign, Tag, Gem, Ban, Sunrise, Briefcase, AlertTriangle, Check } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import {
  analyticsOverview, analyticsTopAirlines, analyticsDayOfWeek,
  analyticsBookingWindow, analyticsWeekendMidweek, analyticsEconomyGap,
  analyticsNonstopPremium, analyticsNetworkOverview, analyticsLongestFlights,
  analyticsTopRoutes, analyticsTopMunicipalities, analyticsTopRegions,
  analyticsExpensiveDestinations, analyticsNonstopRoutes, analyticsHubVsRegional,
  analyticsRegionPricing, analyticsMonopolyRoutes, analyticsHubCarriers,
  analyticsAircraftOverview, analyticsSeatsPricing, analyticsRunwayPricing,
  analyticsAircraftPricing
} from '../api';

const COLORS = ['#f5a623', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

const DarkTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(110,198,255,0.15)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#c0c0c0', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(110,198,255,0.05) inset', backdropFilter: 'blur(16px)', transform: 'scale(1.02)', transition: 'all 0.2s ease', animation: 'fadeInUp 0.2s ease-out' }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#e8f0ff' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: {typeof p.value === 'number' ? (p.name.toLowerCase().includes('fare') || p.name.toLowerCase().includes('price') ? `$${p.value.toFixed(2)}` : p.value.toLocaleString()) : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, sub, color = '#f5a623', icon }) {
  return (
    <div className="search-panel" style={{ textAlign: 'center', flex: 1, minWidth: 180, padding: '20px 16px' }}>
      {icon && <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─────────────── ANALYTICS CARD DEFINITIONS ───────────────
const ANALYTICS_CARDS = [
  {
    key: 'overview',
    title: 'Pricing Overview',
    desc: 'Total flights, average fares, refundable vs non-refundable breakdown',
    icon: <TrendingUp size={32} />,
    color: '#f5a623',
    gradient: 'linear-gradient(135deg, #f5a623 0%, #ff6b35 100%)',
  },
  {
    key: 'topAirlines',
    title: 'Top 15 Airlines',
    desc: 'Airlines ranked by flight volume with average fare comparison',
    icon: <BarChart3 size={32} />,
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  },
  {
    key: 'dayOfWeek',
    title: 'Day of Week',
    desc: 'Flight volume and pricing patterns across weekdays',
    icon: <Calendar size={32} />,
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
  },
  {
    key: 'weekendMidweek',
    title: 'Weekend vs Midweek',
    desc: 'Price comparison between weekend and midweek travel',
    icon: <Sun size={32} />,
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
  },
  {
    key: 'bookingWindow',
    title: 'Booking Window',
    desc: 'How ticket prices change as flight date approaches',
    icon: <Clock size={32} />,
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
  {
    key: 'economyGap',
    title: 'Economy Price Gap',
    desc: 'Basic vs Standard economy fare differences by route',
    icon: <Layers size={32} />,
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  },
  // ─── Section I.10 ───
  {
    key: 'nonstopPremium',
    title: 'Nonstop Premium',
    desc: 'How much more travelers pay for direct flights vs multi-leg on top 20 routes',
    icon: <Plane size={32} />,
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  // ─── Section II: Network Analysis ───
  {
    key: 'networkOverview',
    title: 'Network Overview',
    desc: 'Unique airports, data quality check on missing distances',
    icon: <Globe size={32} />,
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  },
  {
    key: 'longestFlights',
    title: 'Longest Flights',
    desc: 'Top 10 longest flights by total travel distance',
    icon: <Navigation size={32} />,
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  },
  {
    key: 'topRoutes',
    title: 'Top 20 Routes',
    desc: 'Most frequent flight routes by origin-destination pairs',
    icon: <MapPin size={32} />,
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  },
  {
    key: 'topMunicipalities',
    title: 'Top Municipalities',
    desc: 'Top 10 cities with most outbound flights',
    icon: <Building2 size={32} />,
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  },
  {
    key: 'topRegions',
    title: 'Top Regions',
    desc: 'Top 5 states/regions with most active airports',
    icon: <Globe size={32} />,
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
  },
  {
    key: 'expensiveDestinations',
    title: 'Expensive Destinations',
    desc: 'Top 10 most expensive destination airports by average fare',
    icon: <TrendingUp size={32} />,
    color: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
  },
  {
    key: 'nonstopRoutes',
    title: 'Nonstop Route Volume',
    desc: 'Top 20 routes with highest volume of non-stop flights',
    icon: <Plane size={32} />,
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  },
  {
    key: 'hubVsRegional',
    title: 'Hub vs Regional Pricing',
    desc: 'Average fare comparison: small airports vs large international hubs',
    icon: <Building2 size={32} />,
    color: '#d946ef',
    gradient: 'linear-gradient(135deg, #d946ef 0%, #a21caf 100%)',
  },
  {
    key: 'regionPricing',
    title: 'Region Pricing',
    desc: 'Which state/region has the most expensive outbound flights',
    icon: <MapPin size={32} />,
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
  {
    key: 'monopolyRoutes',
    title: 'Monopoly vs Competition',
    desc: 'Price-per-mile on monopoly routes vs competitive routes (3+ airlines)',
    icon: <Users size={32} />,
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
  },
  {
    key: 'hubCarriers',
    title: 'Hub Carrier Pricing',
    desc: 'Legacy vs budget airline pricing at the 5 busiest departure hubs',
    icon: <BarChart3 size={32} />,
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
  },
  // ─── Section III: Aviation & Equipment ───
  {
    key: 'aircraftOverview',
    title: 'Aircraft Overview',
    desc: 'Total aircraft models, top 10 types, Boeing vs Airbus breakdown',
    icon: <Cpu size={32} />,
    color: '#78716c',
    gradient: 'linear-gradient(135deg, #78716c 0%, #57534e 100%)',
  },
  {
    key: 'seatsPricing',
    title: 'Seats vs Pricing',
    desc: 'Are flights with zero remaining seats priced higher?',
    icon: <Armchair size={32} />,
    color: '#fb923c',
    gradient: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
  },
  {
    key: 'runwayPricing',
    title: 'Runway Length vs Price',
    desc: 'Do shorter runways (restricting large planes) lead to higher fares?',
    icon: <Ruler size={32} />,
    color: '#4ade80',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
  },
  {
    key: 'aircraftPricing',
    title: 'Aircraft Category Pricing',
    desc: 'Wide-body vs narrow-body vs regional jet fare differences',
    icon: <Plane size={32} />,
    color: '#818cf8',
    gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
  },
];


// ─── GENERIC REUSABLE SECTIONS ───

function GenericTableSection({ data, columns, title }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="analytics-table">
          <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>{columns.map(c => <td key={c}>{typeof row[c] === 'number' ? row[c].toLocaleString() : row[c]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericBarSection({ data, xKey, bars, title }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(350, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis dataKey={xKey} type="category" tick={{ fill: '#ccc', fontSize: 11 }} width={75} />
          <Tooltip content={<DarkTooltip />} />
          <Legend />
          {bars.map(b => <Bar key={b.key} dataKey={b.key} fill={b.color} name={b.name} radius={[0,4,4,0]} />)}
        </BarChart>
      </ResponsiveContainer>
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="analytics-table">
          <thead><tr><th>{xKey}</th>{bars.map(b => <th key={b.key}>{b.name}</th>)}</tr></thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td style={{fontWeight:600}}>{row[xKey]}</td>
                {bars.map(b => <td key={b.key}>{typeof row[b.key] === 'number' ? row[b.key].toLocaleString() : row[b.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SPECIFIC NEW SECTIONS ───

function NonstopPremiumSection({ data }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Nonstop Premium — Top 20 Busiest Routes</h3>
      <ResponsiveContainer width="100%" height={500}>
        <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <YAxis dataKey="route" type="category" tick={{ fill: '#ccc', fontSize: 11 }} width={85} />
          <Tooltip content={<DarkTooltip />} />
          <Legend />
          <Bar dataKey="nonstop_avg" fill="#ef4444" name="Nonstop Avg" radius={[0,4,4,0]} />
          <Bar dataKey="connecting_avg" fill="#22c55e" name="Connecting Avg" radius={[0,4,4,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="stat-cards" style={{ marginTop: 16 }}>
        {data.slice(0, 5).map((r, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{r.route}</div>
            <div className="stat-value" style={{color:'#ef4444'}}>${r.premium?.toFixed(2)}</div>
            <div className="stat-sub">premium for nonstop</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetworkOverviewSection({ data }) {
  if (!data) return <div className="analytics-empty">No data available</div>;
  const d = data;
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Network Overview & Data Quality</h3>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-label">Unique Origins</div><div className="stat-value">{Number(d.unique_origins || 0).toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Unique Destinations</div><div className="stat-value">{Number(d.unique_destinations || 0).toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{Number(d.total_records || 0).toLocaleString()}</div></div>
        <div className="stat-card" style={{borderColor: Number(d.null_distance_records) > 0 ? '#ef4444' : '#22c55e'}}>
          <div className="stat-label">Missing Distance Records</div>
          <div className="stat-value" style={{color: Number(d.null_distance_records) > 0 ? '#ef4444' : '#22c55e'}}>{Number(d.null_distance_records || 0).toLocaleString()}</div>
          <div className="stat-sub">{d.total_records > 0 ? ((d.null_distance_records / d.total_records) * 100).toFixed(1) : 0}% of dataset</div>
        </div>
      </div>
    </div>
  );
}

function HubVsRegionalSection({ data }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  const typeLabels = { large_airport: 'Large International Hub', medium_airport: 'Medium Airport', small_airport: 'Small Regional' };
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Hub vs Regional Airport Pricing</h3>
      <div className="stat-cards">
        {data.map((d, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{typeLabels[d.airport_type] || d.airport_type}</div>
            <div className="stat-value">${Number(d.avgFare || 0).toFixed(2)}</div>
            <div className="stat-sub">{Number(d.flightCount || 0).toLocaleString()} flights</div>
            <div className="stat-sub">Min: ${Number(d.minFare || 0).toFixed(2)} | Max: ${Number(d.maxFare || 0).toFixed(2)}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.map(d => ({...d, label: typeLabels[d.airport_type] || d.airport_type}))} margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="label" tick={{ fill: '#ccc', fontSize: 12 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <Tooltip content={<DarkTooltip />} />
          <Bar dataKey="avgFare" fill="#d946ef" name="Avg Fare" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonopolySection({ data }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Monopoly vs Competitive Routes</h3>
      <div className="stat-cards">
        {data.map((d, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{d.competition}</div>
            <div className="stat-value">${Number(d.overallAvgFare || 0).toFixed(2)}</div>
            <div className="stat-sub">{Number(d.routeCount || 0)} routes</div>
            <div className="stat-sub">$/mile: {Number(d.avgPricePerMile || 0).toFixed(4)}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="competition" tick={{ fill: '#ccc', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip content={<DarkTooltip />} />
          <Legend />
          <Bar dataKey="overallAvgFare" fill="#7c3aed" name="Avg Fare ($)" radius={[4,4,0,0]} />
          <Bar dataKey="avgPricePerMile" fill="#22c55e" name="Price/Mile ($)" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HubCarriersSection({ data }) {
  if (!data || !data.length) return <div className="analytics-empty">No data available</div>;
  const hubs = [...new Set(data.map(d => d.hub))];
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Carrier Pricing at Top 5 Busiest Hubs</h3>
      {hubs.map(hub => {
        const hubData = data.filter(d => d.hub === hub).slice(0, 8);
        return (
          <div key={hub} style={{ marginBottom: 32 }}>
            <h4 style={{ color: '#3b82f6', marginBottom: 8 }}>{hub}</h4>
            <ResponsiveContainer width="100%" height={Math.max(200, hubData.length * 30)}>
              <BarChart data={hubData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <YAxis dataKey="airline" type="category" tick={{ fill: '#ccc', fontSize: 10 }} width={115} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="avgFare" fill="#2563eb" name="Avg Fare" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

function AircraftOverviewSection({ data }) {
  if (!data) return <div className="analytics-empty">No data available</div>;
  const mfr = data.manufacturers || {};
  const top = data.topAircraft || [];
  const pieData = [
    { name: 'Boeing', value: Number(mfr.boeing || 0), fill: '#3b82f6' },
    { name: 'Airbus', value: Number(mfr.airbus || 0), fill: '#ef4444' },
    { name: 'Other', value: Math.max(0, Number(mfr.total || 0) - Number(mfr.boeing || 0) - Number(mfr.airbus || 0)), fill: '#888' },
  ].filter(d => d.value > 0);
  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 16 }}>Aircraft Overview</h3>
      <div className="stat-cards">
        <div className="stat-card"><div className="stat-label">Total Aircraft Models</div><div className="stat-value">{Number(data.totalModels || 0)}</div></div>
        <div className="stat-card"><div className="stat-label">Boeing Flights</div><div className="stat-value" style={{color:'#3b82f6'}}>{Number(mfr.boeing || 0).toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">Airbus Flights</div><div className="stat-value" style={{color:'#ef4444'}}>{Number(mfr.airbus || 0).toLocaleString()}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h4 style={{ color: '#aaa', marginBottom: 8 }}>Boeing vs Airbus</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`}>
                {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h4 style={{ color: '#aaa', marginBottom: 8 }}>Top 10 Aircraft Types</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis dataKey="aircraft" type="category" tick={{ fill: '#ccc', fontSize: 10 }} width={95} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="flightCount" fill="#78716c" name="Flights" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────── MAIN COMPONENT ───────────────
function AnalyticsDashboard() {
  const [activeSection, setActiveSection] = useState(null); // null = card view
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [queries, setQueries] = useState({});
  const [showQuery, setShowQuery] = useState(false);

  const g = (obj, key) => {
    if (!obj) return 0;
    return Number(obj[key] || obj[key.toLowerCase()] || 0);
  };

  // Fetch data for a specific section
  const fetchSection = useCallback(async (key) => {
    if (data[key] && !errors[key]) return; // Already loaded, skip
    setLoading(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: '' }));

    const apiMap = {
      overview: { fn: analyticsOverview, extract: (d) => d.overview },
      topAirlines: { fn: analyticsTopAirlines, extract: (d) => d.airlines || [] },
      dayOfWeek: { fn: analyticsDayOfWeek, extract: (d) => d.days || [] },
      weekendMidweek: { fn: analyticsWeekendMidweek, extract: (d) => d.comparison || [] },
      bookingWindow: { fn: analyticsBookingWindow, extract: (d) => d.bookingWindow || [] },
      economyGap: { fn: analyticsEconomyGap, extract: (d) => d.routes || [] },
      nonstopPremium: { fn: analyticsNonstopPremium, extract: (d) => d.routes || [] },
      networkOverview: { fn: analyticsNetworkOverview, extract: (d) => d.overview || {} },
      longestFlights: { fn: analyticsLongestFlights, extract: (d) => d.flights || [] },
      topRoutes: { fn: analyticsTopRoutes, extract: (d) => d.routes || [] },
      topMunicipalities: { fn: analyticsTopMunicipalities, extract: (d) => d.municipalities || [] },
      topRegions: { fn: analyticsTopRegions, extract: (d) => d.regions || [] },
      expensiveDestinations: { fn: analyticsExpensiveDestinations, extract: (d) => d.destinations || [] },
      nonstopRoutes: { fn: analyticsNonstopRoutes, extract: (d) => d.routes || [] },
      hubVsRegional: { fn: analyticsHubVsRegional, extract: (d) => d.types || [] },
      regionPricing: { fn: analyticsRegionPricing, extract: (d) => d.regions || [] },
      monopolyRoutes: { fn: analyticsMonopolyRoutes, extract: (d) => d.data || [] },
      hubCarriers: { fn: analyticsHubCarriers, extract: (d) => d.carriers || [] },
      aircraftOverview: { fn: analyticsAircraftOverview, extract: (d) => d },
      seatsPricing: { fn: analyticsSeatsPricing, extract: (d) => d.data || [] },
      runwayPricing: { fn: analyticsRunwayPricing, extract: (d) => d.data || [] },
      aircraftPricing: { fn: analyticsAircraftPricing, extract: (d) => d.data || [] },
    };

    try {
      const res = await apiMap[key].fn();
      const extracted = apiMap[key].extract(res.data);
      setData(prev => ({ ...prev, [key]: extracted }));
      if (res.data.query) setQueries(prev => ({ ...prev, [key]: res.data.query }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [key]: err.response?.data?.error || err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [data, errors]);

  // When a section is opened, fetch its data
  const openSection = useCallback((key) => {
    setActiveSection(key);
    fetchSection(key);
  }, [fetchSection]);

  // Force refresh a section
  const refreshSection = useCallback((key) => {
    setData(prev => { const n = { ...prev }; delete n[key]; return n; });
    setErrors(prev => ({ ...prev, [key]: '' }));
    setTimeout(() => fetchSection(key), 100);
  }, [fetchSection]);

  // ─────────────── CARD VIEW (Landing) ───────────────
  if (!activeSection) {
    return (
      <div className="page-container">
        <title>Analytics Dashboard — Data Turbulence</title>
        <div className="page-hero">
          <h1><BarChart3 size={30} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 10 }} /> Analytics Dashboard</h1>
          <p>Choose an analytics section to explore. Data loads only when you open a section — fast & efficient.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 20px',
        }}>
          {ANALYTICS_CARDS.map(card => {
            const isCached = !!data[card.key];
            return (
              <div
                key={card.key}
                className="analytics-card"
                onClick={() => openSection(card.key)}
                style={{ '--card-color': card.color, '--card-gradient': card.gradient }}
              >
                <div className="analytics-card-icon" style={{ background: `${card.color}12`, color: card.color }}>
                  {card.icon}
                </div>

                <h3 className="analytics-card-title">{card.title}</h3>
                
                <p className="analytics-card-desc">{card.desc}</p>

                <div className="analytics-card-footer">
                  <span style={{ color: card.color, fontWeight: 600, fontSize: 14 }}>Explore →</span>
                  {isCached && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, background: '#22c55e15', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} /> Cached</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────── DETAIL VIEW (Single Section) ───────────────
  const card = ANALYTICS_CARDS.find(c => c.key === activeSection);
  const sectionData = data[activeSection];
  const isLoading = loading[activeSection];
  const error = errors[activeSection];
  const query = queries[activeSection];

  return (
    <div className="page-container">
      <title>{card.title} — Analytics</title>

      {/* Back button + Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setActiveSection(null)}
          style={{
            background: 'transparent', border: '1px solid #333', borderRadius: 10,
            color: '#ccc', padding: '8px 16px', cursor: 'pointer', fontSize: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.color = card.color; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#ccc'; }}
        >
          <ArrowLeft size={16} /> Back to Analytics
        </button>

        <div className="page-hero" style={{ paddingBottom: 10 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: card.color }}>{card.icon}</span> {card.title}
          </h1>
          <p>{card.desc}</p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            className="btn-primary"
            onClick={() => refreshSection(activeSection)}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            {isLoading ? 'Loading…' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="loading-container">
          <div className="spinner" />
          <div className="loading-text">Querying ~80M rows… This may take 1-3 minutes.</div>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {error}</div>}

      {/* ─── SECTION CONTENT ─── */}
      {activeSection === 'overview' && sectionData && <OverviewSection data={sectionData} g={g} />}
      {activeSection === 'topAirlines' && sectionData && <TopAirlinesSection data={sectionData} />}
      {activeSection === 'dayOfWeek' && sectionData && <DayOfWeekSection data={sectionData} />}
      {activeSection === 'weekendMidweek' && sectionData && <WeekendMidweekSection data={sectionData} />}
      {activeSection === 'bookingWindow' && sectionData && <BookingWindowSection data={sectionData} />}
      {activeSection === 'economyGap' && sectionData && <EconomyGapSection data={sectionData} />}

      {activeSection === 'nonstopPremium' && sectionData && <NonstopPremiumSection data={sectionData} />}
      {activeSection === 'networkOverview' && sectionData && <NetworkOverviewSection data={sectionData} />}
      {activeSection === 'longestFlights' && sectionData && <GenericTableSection data={sectionData} columns={['startingAirport','destinationAirport','distance','airline','fare','travelDuration']} title="Top 10 Longest Flights" />}
      {activeSection === 'topRoutes' && sectionData && <GenericBarSection data={sectionData} xKey="route" bars={[{key:'flightCount',color:'#3b82f6',name:'Flights'},{key:'avgFare',color:'#f5a623',name:'Avg Fare'}]} title="Top 20 Most Frequent Routes" />}
      {activeSection === 'topMunicipalities' && sectionData && <GenericBarSection data={sectionData} xKey="municipality" bars={[{key:'flightCount',color:'#3b82f6',name:'Flights'},{key:'avgFare',color:'#f5a623',name:'Avg Fare'}]} title="Top 10 Municipalities by Outbound Flights" />}
      {activeSection === 'topRegions' && sectionData && <GenericBarSection data={sectionData} xKey="region" bars={[{key:'airportCount',color:'#22c55e',name:'Airports'},{key:'flightCount',color:'#3b82f6',name:'Flights'}]} title="Top 5 Regions by Active Airports" />}
      {activeSection === 'expensiveDestinations' && sectionData && <GenericBarSection data={sectionData} xKey="destinationAirport" bars={[{key:'avgFare',color:'#ef4444',name:'Avg Fare'},{key:'minFare',color:'#22c55e',name:'Min Fare'},{key:'maxFare',color:'#f97316',name:'Max Fare'}]} title="Top 10 Most Expensive Destinations" />}
      {activeSection === 'nonstopRoutes' && sectionData && <GenericBarSection data={sectionData} xKey="route" bars={[{key:'nonstopCount',color:'#22c55e',name:'Nonstop'},{key:'totalFlights',color:'#3b82f6',name:'Total'}]} title="Top 20 Routes by Nonstop Volume" />}
      {activeSection === 'hubVsRegional' && sectionData && <HubVsRegionalSection data={sectionData} />}
      {activeSection === 'regionPricing' && sectionData && <GenericBarSection data={sectionData} xKey="region" bars={[{key:'avgFare',color:'#f59e0b',name:'Avg Fare'}]} title="Most Expensive Outbound Regions" />}
      {activeSection === 'monopolyRoutes' && sectionData && <MonopolySection data={sectionData} />}
      {activeSection === 'hubCarriers' && sectionData && <HubCarriersSection data={sectionData} />}
      {activeSection === 'aircraftOverview' && sectionData && <AircraftOverviewSection data={sectionData} />}
      {activeSection === 'seatsPricing' && sectionData && <GenericBarSection data={sectionData} xKey="seatCategory" bars={[{key:'avgFare',color:'#f97316',name:'Avg Fare'},{key:'flightCount',color:'#3b82f6',name:'Flights'}]} title="Seat Availability vs Pricing" />}
      {activeSection === 'runwayPricing' && sectionData && <GenericBarSection data={sectionData} xKey="runwayCategory" bars={[{key:'avgFare',color:'#4ade80',name:'Avg Fare'},{key:'flightCount',color:'#3b82f6',name:'Flights'}]} title="Runway Length vs Ticket Price" />}
      {activeSection === 'aircraftPricing' && sectionData && <GenericBarSection data={sectionData} xKey="aircraftCategory" bars={[{key:'avgFare',color:'#818cf8',name:'Avg Fare'},{key:'flightCount',color:'#3b82f6',name:'Flights'},{key:'avgDistance',color:'#22c55e',name:'Avg Distance'}]} title="Aircraft Category Pricing" />}

      {/* Query Debug */}
      {query && (
        <div className="query-debug" style={{ marginTop: 32 }}>
          <button className="query-toggle" onClick={() => setShowQuery(!showQuery)}>
            {showQuery ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showQuery ? 'Hide' : 'Show'} HiveQL Query
          </button>
          {showQuery && <pre className="query-code" style={{ marginTop: 8 }}>{query}</pre>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════

function OverviewSection({ data, g }) {
  const refPieData = [
    { name: 'Refundable', value: g(data, 'refundableCount'), color: '#22c55e' },
    { name: 'Non-Refundable', value: g(data, 'nonRefundableCount'), color: '#ef4444' },
  ];
  const ecoPieData = [
    { name: 'Basic Economy', value: g(data, 'basicEconomyCount'), color: '#3b82f6' },
    { name: 'Standard Economy', value: g(data, 'standardEconomyCount'), color: '#f5a623' },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Total Flights" value={g(data, 'totalFlights').toLocaleString()} icon={<Plane size={22} />} color="#3b82f6" />
        <StatCard label="Avg Fare" value={`$${g(data, 'avgFare').toFixed(2)}`} icon={<DollarSign size={22} />} color="#f5a623" />
        <StatCard label="Min Fare" value={`$${g(data, 'minFare').toFixed(2)}`} icon={<Tag size={22} />} color="#22c55e" />
        <StatCard label="Max Fare" value={`$${g(data, 'maxFare').toFixed(2)}`} icon={<Gem size={22} />} color="#ef4444" />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Avg Refundable" value={`$${g(data, 'avgFareRefundable').toFixed(2)}`} sub={`${g(data, 'refundableCount').toLocaleString()} tickets`} color="#22c55e" icon={<RefreshCw size={22} />} />
        <StatCard label="Avg Non-Refundable" value={`$${g(data, 'avgFareNonRefundable').toFixed(2)}`} sub={`${g(data, 'nonRefundableCount').toLocaleString()} tickets`} color="#ef4444" icon={<Ban size={22} />} />
        <StatCard label="Flexibility Premium" value={`$${(g(data, 'avgFareRefundable') - g(data, 'avgFareNonRefundable')).toFixed(2)}`} sub="refundable − non-refundable" color="#a855f7" icon={<TrendingUp size={22} />} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="chart-container" style={{ flex: 1, minWidth: 300 }}>
          <div className="chart-title">Refundable vs Non-Refundable</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={refPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`} labelLine={false} fontSize={11}>
              {refPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie><Tooltip content={<DarkTooltip />} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-container" style={{ flex: 1, minWidth: 300 }}>
          <div className="chart-title">Basic Economy vs Standard</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={ecoPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`} labelLine={false} fontSize={11}>
              {ecoPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie><Tooltip content={<DarkTooltip />} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function TopAirlinesSection({ data }) {
  const chartData = data.map(a => ({
    name: (a.airline || 'Unknown').length > 18 ? (a.airline || 'Unknown').substring(0, 16) + '…' : (a.airline || 'Unknown'),
    avgFare: Number(a.avgFare || a.avgfare || 0),
    flightCount: Number(a.flightCount || a.flightcount || 0),
  }));
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={480}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="name" stroke="#8899aa" fontSize={11} angle={-35} textAnchor="end" height={100} />
          <YAxis yAxisId="left" stroke="#f5a623" tickFormatter={(v) => `$${v}`} />
          <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
          <Tooltip content={<DarkTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="avgFare" name="Avg Fare ($)" fill="#f5a623" radius={[4,4,0,0]} />
          <Bar yAxisId="right" dataKey="flightCount" name="Flight Count" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayOfWeekSection({ data }) {
  const chartData = data.map(d => ({
    day: d.dayName || d.dayname || `Day ${d.dayNum || d.daynum}`,
    flights: Number(d.flightCount || d.flightcount || 0),
    avgFare: Number(d.avgFare || d.avgfare || 0),
  }));
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div className="chart-container" style={{ flex: 1, minWidth: 350 }}>
        <div className="chart-title">Flight Volume by Day</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="day" stroke="#8899aa" fontSize={12} />
            <YAxis stroke="#8899aa" tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`} />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="flights" name="Flights" fill="#3b82f6" radius={[4,4,0,0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-container" style={{ flex: 1, minWidth: 350 }}>
        <div className="chart-title">Average Fare by Day</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="day" stroke="#8899aa" fontSize={12} />
            <YAxis stroke="#8899aa" tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="avgFare" name="Avg Fare" fill="#f5a623" radius={[4,4,0,0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeekendMidweekSection({ data }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {data.map((w, i) => {
        const type = w.travelType || w.traveltype || 'Unknown';
        const isWeekend = type.toLowerCase().includes('weekend');
        return (
          <StatCard key={i}
            label={type}
            value={`$${Number(w.avgFare || w.avgfare || 0).toFixed(2)}`}
            sub={`${Number(w.flightCount || w.flightcount || 0).toLocaleString()} flights | Min $${Number(w.minFare || w.minfare || 0).toFixed(0)} | Max $${Number(w.maxFare || w.maxfare || 0).toFixed(0)}`}
            color={isWeekend ? '#ef4444' : '#22c55e'}
            icon={isWeekend ? <Sunrise size={22} /> : <Briefcase size={22} />}
          />
        );
      })}
    </div>
  );
}

function BookingWindowSection({ data }) {
  const chartData = data
    .filter(b => Number(b.bookingWindow || b.bookingwindow) <= 120)
    .map(b => ({
      days: Number(b.bookingWindow || b.bookingwindow),
      avgFare: Number(b.avgFare || b.avgfare || 0),
      minFare: Number(b.minFare || b.minfare || 0),
    }));
  return (
    <>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
        How does ticket price change as the flight date approaches?
      </p>
      <div className="chart-container">
        <div className="chart-title">Average Fare vs Days Before Departure</div>
        <ResponsiveContainer width="100%" height={420}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="bwGradAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3} /><stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bwGradMin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="days" stroke="#8899aa" fontSize={12} label={{ value: 'Days Before Departure', position: 'insideBottom', offset: -5, fill: '#8899aa' }} />
            <YAxis stroke="#8899aa" tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="avgFare" name="Avg Fare" stroke="#f5a623" fill="url(#bwGradAvg)" strokeWidth={2} />
            <Area type="monotone" dataKey="minFare" name="Min Fare" stroke="#22c55e" fill="url(#bwGradMin)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function EconomyGapSection({ data }) {
  const chartData = data.slice(0, 15).map(r => ({
    route: `${r.startingAirport || r.startingairport}→${r.destinationAirport || r.destinationairport}`,
    basic: Number(r.avgBasic || r.avgbasic || 0),
    standard: Number(r.avgStandard || r.avgstandard || 0),
    gap: Number(r.priceGap || r.pricegap || 0),
  }));
  return (
    <>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="route" stroke="#8899aa" fontSize={10} angle={-40} textAnchor="end" height={100} />
            <YAxis stroke="#8899aa" tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="basic" name="Basic Economy" fill="#3b82f6" radius={[4,4,0,0]} />
            <Bar dataKey="standard" name="Standard Economy" fill="#f5a623" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="data-table-wrapper" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead><tr><th>Route</th><th>Avg Basic</th><th>Avg Standard</th><th>Price Gap</th></tr></thead>
          <tbody>
            {chartData.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.route}</td>
                <td style={{ color: '#3b82f6' }}>${r.basic.toFixed(2)}</td>
                <td style={{ color: '#f5a623' }}>${r.standard.toFixed(2)}</td>
                <td style={{ color: r.gap > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{r.gap > 0 ? '+' : ''}${r.gap.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default AnalyticsDashboard;
