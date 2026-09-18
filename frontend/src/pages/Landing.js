
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Plus, Mic, Volume2, ArrowUp, Star,
  X, Facebook, Twitter, Instagram, Linkedin, Plane,
  Search, MapPin, Calendar, BarChart3, MessageSquare, Building2,
  Database, Zap, Shield, Globe, Image, Maximize2, ChevronLeft, ChevronRight, Users,
  Settings, Lock, Camera, Grid, List, LayoutGrid, Columns
} from 'lucide-react';

// Scroll-triggered animation hook
function useScrollAnim() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('anim-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function AnimDiv({ className = '', children, ...props }) {
  const ref = useScrollAnim();
  return <div ref={ref} className={`anim-hidden ${className}`} {...props}>{children}</div>;
}

const teamMembers = [
  { name: 'Md. Mihraz Hossain Niloy', role: 'Internal Data Analysis Lead', id: '2023521460116', photo: '/Mihraz.png' },
  { name: 'Redoanuzzaman', role: 'Full-Stack Development Lead', id: '2023521460126', photo: '/Redoan.png' },
  { name: 'Md. Motasaddik Azmine', role: 'External Data Analysis & Enrichment Lead', id: '2023521460118', photo: '/Azmine.png' },
  { name: 'Md. Arafat Hosen', role: 'Project Manager', id: '2023521460122', photo: '/Arafat.png' },
];

const faqs = [
  { q: 'What data sources power Ticket Meta?', a: 'We ingest over 1.2 million itinerary fare records from the Bureau of Transportation Statistics (BTS/DOT), airport metadata from FAA and OurAirports covering 50,000+ airports worldwide, and airline delay-cause breakdowns — all stored and optimized in Apache Hive with ORC partitioning.' },
  { q: 'How does the AI chatbot convert my questions to queries?', a: 'Our NL→SQL engine uses a fine-tuned LLM to translate natural language questions into HiveQL queries in real time. Just type something like "cheapest nonstop flights from JFK to LAX in Q3" and watch it generate the SQL, execute it against Hive, and return results in seconds.' },
  { q: 'What kind of analytics can I explore?', a: 'You can compare airline pricing across 50+ carriers, discover cheapest destinations from any origin airport, analyze fare trends by quarter, explore delay-cause breakdowns by carrier and airport, and visualize enrichment data like runways, navaids, and weather patterns.' },
  { q: 'How is the data processed and enriched?', a: 'Raw CSV data flows through PySpark ETL pipelines for cleansing, joins, and enrichment — merging weather data, airport coordinates, runway specs, and regional classifications. The enriched data is stored in optimized ORC tables partitioned by year and quarter for sub-second query performance.' },
  { q: 'Is the platform updated with live data?', a: 'The platform is built on batch-processed BTS datasets updated quarterly. Our Flask REST API serves the enriched data to the React frontend via PyHive connections, ensuring you always query the latest available fare and delay records.' },
];

/* ── Workflow steps — mapped to real website pages ── */
const workflowSteps = [
  { icon: Search,        title: 'Flight Search',      desc: 'Search 50+ airlines by origin, destination & dates.',   detail: 'Compare fares, stops, times, and cabin classes across 150+ destinations. Filter by price range, airline, and departure window. Results update in real-time from our Hive data warehouse.', color: '#6ec6ff',  route: '/flights' },
  { icon: BarChart3,     title: 'Analytics Dashboard', desc: 'Explore pricing trends and airline rankings.',           detail: 'Interactive charts showing fare trends over time, delay heatmaps by airport, carrier performance scores, and route profitability analysis with drill-down capabilities.', color: '#34d399',  route: '/analytics' },
  { icon: Zap,           title: 'Optimized Route',    desc: 'Find the most efficient travel routes.',     detail: 'Our algorithm analyzes multiple route combinations and optimizations to find the most cost-effective and time-efficient paths for your journey.', color: '#f59e0b',  route: '/optimized-route' },
  { icon: Globe,         title: 'Data Enrichment',    desc: 'Layer in weather, runways & delay data.',          detail: 'Enrich flight data with live weather conditions, airport infrastructure details (runways, navaids), regional economic indicators, and DOT delay-cause breakdowns.', color: '#f472b6',  route: '/enrichment' },
  { icon: MessageSquare, title: 'AI Chat Assistant',   desc: 'Ask questions in natural language.',       detail: 'Powered by AI that converts your questions to Hive SQL queries. Ask things like "cheapest flights to Tokyo next month" and get instant data-driven answers with visualizations.', color: '#c084fc',  route: '/chatbot' },
];

const footerLinks = {
  releases: ['Integrations', 'Smart Routes', 'AI Itineraries', 'Vision Maps', '100M Destinations'],
  resources: ['Travel Stories', 'Our Apps', 'Travel Library', 'Tutorials'],
  company: ['About', 'Careers', 'Blog', 'Contact'],
};

/* ═══ Animated Stars Canvas Background ═══ */
function StarsCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const stars = [];
    const STAR_COUNT = 180;

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();

    // Create stars
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.8 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      t += 1;

      stars.forEach((s) => {
        // Twinkle
        const twinkle = Math.sin(t * s.twinkleSpeed + s.phase) * 0.4 + 0.6;
        const alpha = s.opacity * twinkle;

        // Slow drift
        s.y -= s.speed;
        s.x += Math.sin(t * 0.003 + s.phase) * 0.15;
        if (s.y < -5) { s.y = h + 5; s.x = Math.random() * w; }
        if (s.x < -5) s.x = w + 5;
        if (s.x > w + 5) s.x = -5;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${alpha})`;
        ctx.fill();

        // Glow for bigger stars
        if (s.r > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(110, 198, 255, ${alpha * 0.1})`;
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="wf-stars-canvas" />;
}

/* ═══ Workflow Map with scroll-driven airplane ═══ */
function WorkflowMap({ navigate }) {
  const sectionRef = useRef(null);
  const pathRef = useRef(null);
  const planeRef = useRef(null);
  const trailRef = useRef(null);
  const [activeStep, setActiveStep] = useState(-1);

  // Smooth rounded serpentine path — nice wide arcs through 5 stops
  // viewBox 1200×800
  const flightPath = [
    'M 150,160',                        // ① start
    'C 300,160 450,160 600,160',        // straight to ②
    'C 750,160 950,160 1050,240',       // gentle curve to ③
    'C 1150,320 1100,440 950,480',      // big round U-turn right
    'C 700,540 400,560 250,580',        // sweep left to ④
    'C 100,600 80,680 200,720',         // round U-turn left
    'C 400,780 750,740 1050,700',       // sweep right to ⑤
  ].join(' ');

  // 5 stop positions along the path (0→1)
  const stepPositions = [0.0, 0.18, 0.36, 0.62, 0.92];

  // SVG marker positions (on the actual path)
  const markerPositions = [
    { x: 150, y: 160 },
    { x: 600, y: 160 },
    { x: 1050, y: 240 },
    { x: 250, y: 580 },
    { x: 1050, y: 700 },
  ];

  // Card positions near markers
  const cardPositions = [
    { top: '4%',   left: '2%'  },
    { top: '4%',   left: '38%' },
    { top: '14%',  left: '74%' },
    { top: '55%',  left: '74%' },
    { top: '70%',  left: '2%'  },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    const path = pathRef.current;
    const plane = planeRef.current;
    const trail = trailRef.current;
    if (!section || !path || !plane || !trail) return;

    const totalLength = path.getTotalLength();
    trail.style.strokeDasharray = totalLength;
    trail.style.strokeDashoffset = totalLength;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionH = rect.height;
      const viewH = window.innerHeight;
      // Plane starts at 0% when section top reaches viewport top
      // Plane reaches 100% when section bottom reaches viewport bottom
      // This ensures the full animation plays while the section is visible on screen
      const scrollableDistance = sectionH - viewH;
      const raw = scrollableDistance > 0 ? (-rect.top / scrollableDistance) : 0;
      const progress = Math.max(0, Math.min(1, raw));

      // Airplane position
      const point = path.getPointAtLength(progress * totalLength);
      const delta = 2;
      const p1 = path.getPointAtLength(Math.max(0, progress * totalLength - delta));
      const p2 = path.getPointAtLength(Math.min(totalLength, progress * totalLength + delta));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

      plane.style.transform = `translate(${point.x}px, ${point.y}px) rotate(${angle}deg)`;
      trail.style.strokeDashoffset = totalLength * (1 - progress);

      let step = -1;
      for (let i = stepPositions.length - 1; i >= 0; i--) {
        if (progress >= stepPositions[i] - 0.04) { step = i; break; }
      }
      setActiveStep(step);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="wf-map-section" ref={sectionRef} id="workflow">
      {/* Animated stars background */}
      <StarsCanvas />

      <div className="wf-map-header">
        <span className="tl-section-badge">How It Works</span>
        <h2>Your Flight Intelligence Pipeline</h2>
        <p>Scroll to follow the airplane through each stage of our platform</p>
      </div>

      <div className="wf-map-container">
        <svg className="wf-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="mapDots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.8" fill="rgba(110,198,255,0.06)" />
            </pattern>
            <filter id="planeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="trailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6ec6ff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <rect width="1200" height="800" fill="url(#mapDots)" />

          {/* Dashed route (background) */}
          <path d={flightPath} fill="none" stroke="rgba(110,198,255,0.1)" strokeWidth="2" strokeDasharray="10 8" />

          {/* Animated trail */}
          <path ref={trailRef} d={flightPath} fill="none" stroke="url(#trailGrad)" strokeWidth="3" strokeLinecap="round" />

          {/* Hidden path for calculations */}
          <path ref={pathRef} d={flightPath} fill="none" stroke="transparent" strokeWidth="0" />

          {/* Stop markers */}
          {workflowSteps.map((step, i) => {
            const pos = markerPositions[i];
            return (
              <g key={i}>
                <circle cx={pos.x} cy={pos.y} r={activeStep >= i ? 20 : 10}
                  fill="none" stroke={step.color}
                  strokeWidth={activeStep >= i ? 2 : 1}
                  opacity={activeStep >= i ? 0.6 : 0.15}
                  className={activeStep >= i ? 'wf-stop-ring-active' : ''} />
                <circle cx={pos.x} cy={pos.y} r={activeStep >= i ? 7 : 4}
                  fill={activeStep >= i ? step.color : 'rgba(110,198,255,0.25)'}
                  className={activeStep >= i ? 'wf-stop-dot-active' : ''} />
              </g>
            );
          })}

          {/* ✈ Real airplane shape — centered at (0,0) */}
          <g ref={planeRef} filter="url(#planeGlow)" className="wf-plane">
            <g transform="translate(-18,-16) scale(1.5)">
              <path
                d="M12,2 L14,8 L22,10 C23,10.3 23,11.7 22,12 L14,14 L12,20 L10,20 L11,14 L4,12.5 L3,15 L1,15 L1.5,11 L1,9 L3,9 L4,11.5 L11,10 L10,4 L12,2 Z"
                fill="#f5a623"
                stroke="rgba(255,200,80,0.5)"
                strokeWidth="0.5"
              />
            </g>
          </g>
        </svg>

        {/* Step cards — hover to see details */}
        <div className="wf-step-cards">
          {workflowSteps.map((step, i) => {
            const Icon = step.icon;
            const pos = cardPositions[i];
            return (
              <div
                key={i}
                className={`wf-step-card ${activeStep >= i ? 'active' : ''}`}
                style={{ top: pos.top, left: pos.left, '--step-color': step.color }}
                onClick={() => navigate(step.route)}
              >
                <div className="wf-step-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="wf-step-icon" style={{ background: `${step.color}15`, borderColor: `${step.color}30` }}>
                  <Icon size={20} style={{ color: step.color }} />
                </div>
                <h4 className="wf-step-title">{step.title}</h4>
                <p className="wf-step-desc">{step.desc}</p>
                {/* Hover detail popup — cards 2,3 show below */}
                <div className={`wf-step-popup ${i === 1 || i === 2 ? 'popup-bottom' : ''}`} style={{ '--step-color': step.color }}>
                  <div className="wf-popup-header">
                    <Icon size={16} style={{ color: step.color }} />
                    <span style={{ color: step.color }}>{step.title}</span>
                  </div>
                  <p className="wf-popup-detail">{step.detail}</p>
                  <span className="wf-popup-hint">Click to explore →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(1);
  const [macScreen, setMacScreen] = useState('launchpad'); // 'launchpad' | 'gallery' | number (fullscreen photo index)
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'columns' | 'gallery'
  const [typedText, setTypedText] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const line1 = 'Turning Volatility';
  const line2 = 'Into Visibility';
  const fullText = line1 + ' ' + line2;

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, []);

  // Show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="tl-landing">
      {/* ===== NAVBAR ===== */}
      <nav className="tl-nav">
        <div className="tl-nav-inner">
          <div className="tl-nav-logo" onClick={() => navigate('/')}>
            <img src="/logo192.png" alt="Data Turbulence" className="tl-logo-img" />
            <span className="tl-logo-text">Data Turbulence</span>
          </div>
          <div className="tl-nav-links">
            <span className="tl-nav-link" onClick={() => navigate('/flights')}><Search size={14} /> Flights</span>
            <span className="tl-nav-link" onClick={() => navigate('/analytics')}><BarChart3 size={14} /> Analytics</span>
            <span className="tl-nav-link" onClick={() => navigate('/optimized-route')}><MapPin size={14} /> Optimized Route</span>
            <span className="tl-nav-link" onClick={() => navigate('/chatbot')}><MessageSquare size={14} /> AI Chat</span>
            <span className="tl-nav-link" onClick={() => navigate('/enrichment')}><Building2 size={14} /> Enrichment</span>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="tl-hero" id="hero">
        <div className="tl-hero-bg" />
        <video
          className="tl-hero-video"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/herovideo.mp4" type="video/mp4" />
        </video>
        <div className="tl-hero-video-overlay" />
        {/* Slogan - centered on the plane */}
        <div className="tl-hero-slogan-area">
          <h1 className="tl-hero-title">
            {typedText.length <= 18 ? typedText : line1}
            {typedText.length > 19 && <><br />{typedText.slice(19)}</>}
            <span className="tl-typing-cursor">.</span>
          </h1>
        </div>

        {/* Buttons - below the airplane */}
        <div className="tl-hero-btn-area">
          <button className="tl-hero-btn-primary" onClick={() => navigate('/flights')}>
            Explore Flights <ArrowUpRight size={16} />
          </button>
          <button className="tl-hero-btn-ghost" onClick={() => navigate('/chatbot')}>
            Ask AI Assistant
          </button>
        </div>

        {/* Floating Stats */}
        <div className="tl-hero-stats">
          <div className="tl-hero-stat">
            <span className="tl-hero-stat-value">150+</span>
            <span className="tl-hero-stat-label">Destinations</span>
          </div>
          <div className="tl-hero-stat-divider" />
          <div className="tl-hero-stat">
            <span className="tl-hero-stat-value">50+</span>
            <span className="tl-hero-stat-label">Airlines</span>
          </div>
          <div className="tl-hero-stat-divider" />
          <div className="tl-hero-stat">
            <span className="tl-hero-stat-value">1M+</span>
            <span className="tl-hero-stat-label">Flights Analyzed</span>
          </div>
          <div className="tl-hero-stat-divider" />
          <div className="tl-hero-stat">
            <span className="tl-hero-stat-value">24/7</span>
            <span className="tl-hero-stat-label">AI Monitoring</span>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="tl-scroll-indicator">
          <div className="tl-scroll-line" />
        </div>

      </section>

      {/* ===== DATA PIPELINE & ARCHITECTURE SECTION ===== */}
      <section className="tl-ai-section" id="about">
        <AnimDiv className="tl-capabilities">
          <div className="tl-cap-header">
            <span className="tl-section-badge">Under the Hood</span>
            <h2>From Raw Data to<br />Actionable Intelligence</h2>
            <p>See how we transform millions of raw flight records into the insights you explore on every page of this platform.</p>
          </div>

          {/* Data Pipeline Flow */}
          <div className="tl-pipeline">
            {/* Row 1: Data Sources */}
            <div className="tl-pipe-label">Data Sources</div>
            <div className="tl-pipe-row">
              <div className="tl-pipe-card source">
                <div className="tl-pipe-icon" style={{ background: 'rgba(110,198,255,0.1)', borderColor: 'rgba(110,198,255,0.25)' }}>
                  <Globe size={20} style={{ color: '#6ec6ff' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>BTS / DOT</h5>
                  <p>U.S. domestic itinerary fares, carrier data, and route-level pricing from the Bureau of Transportation Statistics.</p>
                </div>
              </div>
              <div className="tl-pipe-card source">
                <div className="tl-pipe-icon" style={{ background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.25)' }}>
                  <Building2 size={20} style={{ color: '#34d399' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>FAA / OurAirports</h5>
                  <p>Airport metadata — runways, navaids, frequencies, elevation, and GPS coordinates for 50,000+ airports worldwide.</p>
                </div>
              </div>
              <div className="tl-pipe-card source">
                <div className="tl-pipe-icon" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' }}>
                  <Zap size={20} style={{ color: '#f59e0b' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>Airline Delay Causes</h5>
                  <p>DOT delay-cause breakdowns — carrier, weather, NAS, security, and late aircraft — by airline and airport.</p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="tl-pipe-arrow">
              <svg width="40" height="40" viewBox="0 0 40 40"><path d="M20 8 L20 28 M12 22 L20 30 L28 22" stroke="#6ec6ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/></svg>
            </div>

            {/* Row 2: Processing */}
            <div className="tl-pipe-label">Processing & Storage</div>
            <div className="tl-pipe-row">
              <div className="tl-pipe-card processing">
                <div className="tl-pipe-icon" style={{ background: 'rgba(192,132,252,0.1)', borderColor: 'rgba(192,132,252,0.25)' }}>
                  <Database size={20} style={{ color: '#c084fc' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>Apache Hive Warehouse</h5>
                  <p>All data ingested into optimized ORC tables with partitioning by year/quarter. HiveQL powers every query on this platform.</p>
                </div>
              </div>
              <div className="tl-pipe-card processing">
                <div className="tl-pipe-icon" style={{ background: 'rgba(244,114,182,0.1)', borderColor: 'rgba(244,114,182,0.25)' }}>
                  <Zap size={20} style={{ color: '#f472b6' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>Spark + Python ETL</h5>
                  <p>Data cleansing, enrichment joins (weather × delays × airports), and table optimization run through PySpark pipelines.</p>
                </div>
              </div>
              <div className="tl-pipe-card processing">
                <div className="tl-pipe-icon" style={{ background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' }}>
                  <Shield size={20} style={{ color: '#22c55e' }} />
                </div>
                <div className="tl-pipe-info">
                  <h5>Flask REST API</h5>
                  <p>Python Flask serves enriched data to the React frontend via REST endpoints with PyHive connections to Hive.</p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="tl-pipe-arrow">
              <svg width="40" height="40" viewBox="0 0 40 40"><path d="M20 8 L20 28 M12 22 L20 30 L28 22" stroke="#f5a623" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/></svg>
            </div>

            {/* Row 3: Output */}
            <div className="tl-pipe-label">What You Get</div>
            <div className="tl-pipe-row">
              <div className="tl-pipe-card output">
                <div className="tl-pipe-stat">1.2M+</div>
                <p>Itinerary fare records indexed and queryable in under 2 seconds.</p>
              </div>
              <div className="tl-pipe-card output">
                <div className="tl-pipe-stat">50+</div>
                <p>Airlines with delay-cause breakdowns across 300+ U.S. airports.</p>
              </div>
              <div className="tl-pipe-card output">
                <div className="tl-pipe-stat">6</div>
                <p>Enrichment datasets (runways, navaids, regions, weather, delays, frequencies).</p>
              </div>
              <div className="tl-pipe-card output">
                <div className="tl-pipe-stat">NL→SQL</div>
                <p>Natural language questions converted to Hive queries via AI in real time.</p>
              </div>
            </div>
          </div>
        </AnimDiv>
      </section>

      {/* ===== WORKFLOW MAP ===== */}
      <WorkflowMap navigate={navigate} />

      {/* ===== MEET THE TEAM — Mac Window Gallery ===== */}
      <section className="tl-testimonials" id="team">
        <div className="tl-testimonials-inner">
          <AnimDiv className="tl-testimonials-header">
            <div>
              <span className="tl-section-badge">Our Team</span>
              <h2>Meet the Pilots Behind<br />Data Turbulence</h2>
            </div>
            <p className="tl-testimonials-desc">
              The engineers, designers, and data scientists who built this flight intelligence platform from the ground up.
            </p>
          </AnimDiv>

          <AnimDiv className="tm-mac-window">
            {/* Mac Chrome Bar */}
            <div className="tm-chrome">
              <div className="tm-dots">
                <span className="tm-dot red" onClick={() => setMacScreen('launchpad')} />
                <span className="tm-dot yellow" />
                <span className="tm-dot green" />
              </div>
              <div className="tm-url-bar">
                <Lock size={11} style={{ marginRight: 6, opacity: 0.6 }} />
                {macScreen === 'launchpad' ? 'team://launchpad' : typeof macScreen === 'number' ? `team://gallery/${teamMembers[macScreen]?.name}` : 'team://gallery'}
              </div>
              <div style={{ width: 52 }} />
            </div>

            {/* Mac Body — no sidebar, full-width content */}
            <div className="tm-body-full">
              {macScreen === 'launchpad' ? (
                /* ── macOS Launchpad Home Screen ── */
                <div className="tm-launchpad">
                  <div className="tm-launchpad-bg" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/mac-wallpaper.jpg)` }} />
                  <div className="tm-lp-search">
                    <Search size={14} />
                    <span>Search</span>
                  </div>
                  <div className="tm-lp-grid">
                    {/* Gallery App — Photos */}
                    <div className="tm-lp-app" onClick={() => setMacScreen('gallery')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #FF6B6B 0%, #C0392B 100%)' }}>
                          <Image size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Photos</span>
                    </div>
                    {/* Flights App */}
                    <div className="tm-lp-app" onClick={() => navigate('/flights')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #56CCF2 0%, #2563EB 100%)' }}>
                          <Plane size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Flights</span>
                    </div>
                    {/* Analytics App */}
                    <div className="tm-lp-app" onClick={() => navigate('/analytics')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #4ADE80 0%, #16A34A 100%)' }}>
                          <BarChart3 size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Analytics</span>
                    </div>
                    {/* AI Chat App */}
                    <div className="tm-lp-app" onClick={() => navigate('/chatbot')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)' }}>
                          <MessageSquare size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>AI Chat</span>
                    </div>
                    {/* Splicing App */}
                    <div className="tm-lp-app" onClick={() => navigate('/optimized-route')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #FB923C 0%, #EA580C 100%)' }}>
                          <Zap size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Optimized</span>
                    </div>
                    {/* Enrichment App */}
                    <div className="tm-lp-app" onClick={() => navigate('/enrichment')}>
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #C084FC 0%, #7C3AED 100%)' }}>
                          <Globe size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Enrichment</span>
                    </div>
                    {/* Hive DB App */}
                    <div className="tm-lp-app">
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #FBBF24 0%, #D97706 100%)' }}>
                          <Database size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Hive DB</span>
                    </div>
                    {/* Settings App */}
                    <div className="tm-lp-app">
                      <div className="tm-lp-icon-wrap">
                        <div className="tm-lp-icon" style={{ background: 'linear-gradient(180deg, #9CA3AF 0%, #4B5563 100%)' }}>
                          <Settings size={34} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="tm-lp-icon-shine" />
                      </div>
                      <span>Settings</span>
                    </div>
                  </div>
                  {/* Dock */}
                  <div className="tm-dock">
                    <div className="tm-dock-item" onClick={() => setMacScreen('gallery')}>
                      <div className="tm-dock-icon" style={{ background: 'linear-gradient(180deg, #FF6B6B, #C0392B)' }}>
                        <Image size={22} color="#fff" strokeWidth={1.8} />
                      </div>
                    </div>
                    <div className="tm-dock-item" onClick={() => navigate('/flights')}>
                      <div className="tm-dock-icon" style={{ background: 'linear-gradient(180deg, #56CCF2, #2563EB)' }}>
                        <Plane size={22} color="#fff" strokeWidth={1.8} />
                      </div>
                    </div>
                    <div className="tm-dock-item" onClick={() => navigate('/chatbot')}>
                      <div className="tm-dock-icon" style={{ background: 'linear-gradient(180deg, #60A5FA, #2563EB)' }}>
                        <MessageSquare size={22} color="#fff" strokeWidth={1.8} />
                      </div>
                    </div>
                    <div className="tm-dock-item" onClick={() => navigate('/analytics')}>
                      <div className="tm-dock-icon" style={{ background: 'linear-gradient(180deg, #4ADE80, #16A34A)' }}>
                        <BarChart3 size={22} color="#fff" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : macScreen === 'gallery' ? (
                /* ── macOS Finder-style Gallery ── */
                <div className="tm-finder">
                  {/* Finder Toolbar */}
                  <div className="tm-finder-toolbar">
                    <div className="tm-finder-toolbar-left">
                      <button className="tm-finder-nav-btn" onClick={() => setMacScreen('launchpad')}>
                        <ChevronLeft size={16} />
                      </button>
                      <span className="tm-finder-title">Team Gallery</span>
                    </div>
                    <div className="tm-finder-toolbar-center">
                      <div className="tm-finder-view-btns">
                        <button className={`tm-finder-view-btn${viewMode === 'grid' ? ' active' : ''}`} title="Grid view" onClick={() => setViewMode('grid')}><LayoutGrid size={14} /></button>
                        <button className={`tm-finder-view-btn${viewMode === 'list' ? ' active' : ''}`} title="List view" onClick={() => setViewMode('list')}><List size={14} /></button>
                        <button className={`tm-finder-view-btn${viewMode === 'columns' ? ' active' : ''}`} title="Columns view" onClick={() => setViewMode('columns')}><Columns size={14} /></button>
                        <button className={`tm-finder-view-btn${viewMode === 'gallery' ? ' active' : ''}`} title="Gallery view" onClick={() => setViewMode('gallery')}><Image size={14} /></button>
                      </div>
                    </div>
                    <div className="tm-finder-toolbar-right">
                      <div className="tm-finder-search">
                        <Search size={12} />
                        <span>Search</span>
                      </div>
                    </div>
                  </div>

                  {/* ── VIEW: Grid ── */}
                  {viewMode === 'grid' && (
                    <div className="tm-finder-grid">
                      {teamMembers.map((member, i) => (
                        <div key={i} className="tm-finder-item" onClick={() => setMacScreen(i)}>
                          <div className="tm-finder-thumb">
                            <img src={member.photo} alt={member.name} />
                          </div>
                          <span className="tm-finder-name">{member.name}</span>
                          <span className="tm-finder-role">{member.role}</span>
                          <span className="tm-finder-id">ID: {member.id}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── VIEW: List ── */}
                  {viewMode === 'list' && (
                    <div className="tm-finder-list">
                      <div className="tm-list-header">
                        <span className="tm-list-col-name">Name</span>
                        <span className="tm-list-col-role">Role</span>
                        <span className="tm-list-col-id">Student ID</span>
                      </div>
                      {teamMembers.map((member, i) => (
                        <div key={i} className="tm-list-row" onClick={() => setMacScreen(i)}>
                          <div className="tm-list-cell-name">
                            <img src={member.photo} alt={member.name} className="tm-list-avatar" />
                            <span>{member.name}</span>
                          </div>
                          <span className="tm-list-cell-role">{member.role}</span>
                          <span className="tm-list-cell-id">{member.id}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── VIEW: Columns ── */}
                  {viewMode === 'columns' && (
                    <div className="tm-finder-columns">
                      {teamMembers.map((member, i) => (
                        <div key={i} className="tm-col-card" onClick={() => setMacScreen(i)}>
                          <div className="tm-col-photo">
                            <img src={member.photo} alt={member.name} />
                          </div>
                          <div className="tm-col-info">
                            <h4>{member.name}</h4>
                            <p>{member.role}</p>
                            <span className="tm-finder-id">ID: {member.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── VIEW: Gallery (large preview + thumbnails) ── */}
                  {viewMode === 'gallery' && (
                    <div className="tm-finder-gallery-view">
                      <div className="tm-gv-preview">
                        <img src={teamMembers[0].photo} alt={teamMembers[0].name} id="tm-gv-main" />
                      </div>
                      <div className="tm-gv-thumbs">
                        {teamMembers.map((member, i) => (
                          <div key={i} className="tm-gv-thumb" onClick={(e) => {
                            document.getElementById('tm-gv-main').src = member.photo;
                            document.getElementById('tm-gv-main').alt = member.name;
                            document.querySelectorAll('.tm-gv-thumb').forEach(t => t.classList.remove('active'));
                            e.currentTarget.classList.add('active');
                          }}>
                            <img src={member.photo} alt={member.name} />
                            <span>{member.name.split(' ').pop()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Finder Status Bar */}
                  <div className="tm-finder-status">
                    {teamMembers.length} items — {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view
                  </div>
                </div>
              ) : (
                /* ── Fullscreen Photo Viewer ── */
                <div className="tm-viewer">
                  <div className="tm-viewer-top">
                    <button className="tm-viewer-back" onClick={() => setMacScreen('gallery')}>
                      <ChevronLeft size={16} /> Back to Gallery
                    </button>
                    <span className="tm-viewer-counter">{macScreen + 1} / {teamMembers.length}</span>
                  </div>
                  <div className="tm-viewer-img-wrap">
                    {macScreen > 0 && (
                      <button className="tm-viewer-nav prev" onClick={() => setMacScreen(macScreen - 1)}>
                        <ChevronLeft size={24} />
                      </button>
                    )}
                    <img src={teamMembers[macScreen].photo} alt={teamMembers[macScreen].name} className="tm-viewer-img" />
                    {macScreen < teamMembers.length - 1 && (
                      <button className="tm-viewer-nav next" onClick={() => setMacScreen(macScreen + 1)}>
                        <ChevronRight size={24} />
                      </button>
                    )}
                  </div>
                  <div className="tm-viewer-info">
                    <h3>{teamMembers[macScreen].name}</h3>
                    <p>{teamMembers[macScreen].role}</p>
                    <span className="tm-viewer-id">ID: {teamMembers[macScreen].id}</span>
                  </div>
                </div>
              )}
            </div>
          </AnimDiv>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="tl-faq">
        <div className="tl-faq-inner">
          <AnimDiv className="tl-faq-header">
            <h2>Frequently Asked<br />Questions</h2>
            <p>Everything you need to know about how Ticket Meta processes, enriches, and serves flight intelligence data at scale.</p>
          </AnimDiv>
          <div className="tl-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`tl-faq-item ${openFaq === i ? 'open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                <div className="tl-faq-question">
                  <span>{faq.q}</span>
                  <button className="tl-faq-toggle">
                    {openFaq === i ? <X size={16} /> : <Plus size={16} />}
                  </button>
                </div>
                {openFaq === i && (
                  <div className="tl-faq-answer">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY DATA TURBULENCE — VALUE PROPOSITION ===== */}
      <section className="tl-why" id="why">
        <div className="tl-why-bg-overlay" />
        <AnimDiv className="tl-why-inner">
          <span className="tl-section-badge">Why Data Turbulence?</span>
          <h2 className="tl-why-title">Save Smarter.<br />Fly Further.</h2>
          <p className="tl-why-subtitle">
            Traditional booking sites show you what airlines want you to see.
            We show you what the <em>data</em> reveals — hidden deals, optimal timing, and routes you'd never find on your own.
          </p>

          {/* Comparison Cards */}
          <div className="tl-why-grid">
            <div className="tl-why-card">
              <div className="tl-why-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                <X size={22} style={{ color: '#ef4444' }} />
              </div>
              <h4>Traditional Booking</h4>
              <ul className="tl-why-list negative">
                <li>Fixed prices, no transparency</li>
                <li>Limited to single-airline results</li>
                <li>No historical fare context</li>
                <li>Hidden fees surprise you later</li>
              </ul>
            </div>
            <div className="tl-why-card highlight">
              <div className="tl-why-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
                <Zap size={22} style={{ color: '#22c55e' }} />
              </div>
              <h4>With Data Turbulence</h4>
              <ul className="tl-why-list positive">
                <li>1.2M+ fares analyzed for best price</li>
                <li>Cross-airline splicing saves up to 40%</li>
                <li>AI finds patterns humans can't see</li>
                <li>Delay predictions before you book</li>
              </ul>
            </div>
          </div>

          {/* Impact Stats */}
          <div className="tl-why-stats">
            <div className="tl-why-stat-item">
              <span className="tl-why-stat-number">$127</span>
              <span className="tl-why-stat-desc">Avg. savings per trip with flight splicing</span>
            </div>
            <div className="tl-why-stat-divider" />
            <div className="tl-why-stat-item">
              <span className="tl-why-stat-number">3.2×</span>
              <span className="tl-why-stat-desc">More route options than traditional search</span>
            </div>
            <div className="tl-why-stat-divider" />
            <div className="tl-why-stat-item">
              <span className="tl-why-stat-number">89%</span>
              <span className="tl-why-stat-desc">Delay prediction accuracy with enriched data</span>
            </div>
          </div>

          {/* CTA */}
          <div className="tl-why-cta">
            <button className="tl-hero-btn-primary" onClick={() => navigate('/flights')}>
              Start Exploring <ArrowUpRight size={16} />
            </button>
            <button className="tl-hero-btn-ghost" onClick={() => navigate('/optimized-route')}>
              Try Optimized Route
            </button>
          </div>
        </AnimDiv>
      </section>

      {/* ===== SCROLL TO TOP BUTTON ===== */}
      <button
        className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ArrowUp size={20} />
      </button>

      {/* ===== SIMPLE FOOTER ===== */}
      <footer className="tl-footer-simple" id="contact">
        <div className="tl-footer-simple-inner">
          <div className="tl-footer-simple-left">
            <div className="tl-nav-logo">
              <img src="/logo192.png" alt="Data Turbulence" className="tl-logo-img" />
              <span className="tl-logo-text">Data Turbulence</span>
            </div>
            <p>Flight intelligence powered by big data & AI.</p>
          </div>
          <div className="tl-footer-simple-social">
            <a href="#"><Facebook size={16} /></a>
            <a href="#"><Twitter size={16} /></a>
            <a href="#"><Instagram size={16} /></a>
            <a href="#"><Linkedin size={16} /></a>
          </div>
        </div>
        <div className="tl-footer-simple-bottom">
          <span>© 2026 Data Turbulence. All rights reserved.</span>
          <div className="tl-footer-simple-links">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
