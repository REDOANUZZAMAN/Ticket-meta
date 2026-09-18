import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, MessageSquare, Plane, TrendingUp, Map, FlaskConical } from 'lucide-react';
import { healthCheck } from '../api';

function Navbar() {
  const [health, setHealth] = useState('checking');

  useEffect(() => {
    healthCheck()
      .then(res => setHealth(res.data.status === 'connected' ? 'connected' : 'error'))
      .catch(() => setHealth('error'));

    const interval = setInterval(() => {
      healthCheck()
        .then(res => setHealth(res.data.status === 'connected' ? 'connected' : 'error'))
        .catch(() => setHealth('error'));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="tl-nav tl-nav-pages">
      <div className="tl-nav-inner">
        <NavLink to="/" className="tl-nav-logo">
          <img src="/logo192.png" alt="Data Turbulence" className="tl-logo-img" />
          <span className="tl-logo-text">Data Turbulence</span>
        </NavLink>
        <div className="tl-nav-links">
          <NavLink to="/flights" className={({ isActive }) => `tl-nav-link ${isActive ? 'active' : ''}`}>
            <Search size={14} /> Flights
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `tl-nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp size={14} /> Analytics
          </NavLink>
          <NavLink to="/optimized-route" className={({ isActive }) => `tl-nav-link ${isActive ? 'active' : ''}`}>
            <Map size={14} /> Optimized Route
          </NavLink>
          <NavLink to="/chatbot" className={({ isActive }) => `tl-nav-link ${isActive ? 'active' : ''}`}>
            <MessageSquare size={14} /> AI Chat
          </NavLink>
          <NavLink to="/enrichment" className={({ isActive }) => `tl-nav-link ${isActive ? 'active' : ''}`}>
            <FlaskConical size={14} /> Enrichment
          </NavLink>
        </div>
        <div className={`health-dot ${health}`} title={`Backend: ${health}`} />
      </div>
    </nav>
  );
}

export default Navbar;
