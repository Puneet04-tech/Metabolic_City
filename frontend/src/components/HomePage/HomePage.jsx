import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      <header className="homepage-header">
        <div className="homepage-nav">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="url(#logo-gradient)" />
                <path d="M20 10L20 15M20 25L20 30" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.8)"/>
                <defs>
                  <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563EB"/>
                    <stop offset="1" stopColor="#EF4444"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="logo-text">
              <h1>Metabolic City</h1>
              <p>Urban Intelligence Platform</p>
            </div>
          </div>
          <div className="auth-buttons">
            <button onClick={() => navigate('/login')} className="home-btn primary-btn">Login</button>
            <button onClick={() => navigate('/signup')} className="home-btn secondary-btn">Sign Up</button>
          </div>
        </div>
      </header>

      <main className="homepage-main">
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              AI-Powered Urban Risk Management
            </div>
            <h2 className="hero-title">
              Real-time City Intelligence for <span className="gradient-text">Critical Incident Response</span>
            </h2>
            <p className="hero-description">
              Metabolic City uses advanced spatial analytics and machine learning to detect, assess, and respond to urban emergencies in real-time. 
              Our H3-based spatial indexing system provides granular risk assessment across the entire city.
            </p>
            <div className="hero-features">
              <div className="feature-item">
                <div className="feature-icon">🎯</div>
                <div className="feature-text">
                  <h3>Real-time Detection</h3>
                  <p>AI-powered incident detection using telemetry data from multiple sources</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">�️</div>
                <div className="feature-text">
                  <h3>Spatial Analytics</h3>
                  <p>H3 hexagonal grid system for precise location-based risk assessment</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <div className="feature-text">
                  <h3>Automated Response</h3>
                  <p>Intelligent dispatch and resource allocation for emergency situations</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">�️</div>
              <h3>For Municipalities</h3>
              <p>Monitor city-wide risk patterns, allocate emergency resources efficiently, and respond to incidents faster with data-driven decision making.</p>
            </div>
            <div className="info-card">
              <div className="info-icon">👷</div>
              <h3>For Operators</h3>
              <p>Real-time incident monitoring, AI-assisted response planning, and automated dispatch coordination for rapid emergency response.</p>
            </div>
            <div className="info-card">
              <div className="info-icon">🚑</div>
              <h3>For Field Crew</h3>
              <p>Mobile task management, geotagged incident resolution, and seamless communication with dispatch operators in the field.</p>
            </div>
            <div className="info-card">
              <div className="info-icon">📊</div>
              <h3>For Administrators</h3>
              <p>Comprehensive analytics, risk threshold configuration, and system performance monitoring for informed governance.</p>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">37</div>
              <div className="stat-label">Active H3 Cells</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Real-time Monitoring</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">&lt;1s</div>
              <div className="stat-label">Detection Time</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">AI</div>
              <div className="stat-label">Risk Assessment</div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-content">
            <h2>Ready to Transform Your City's Emergency Response?</h2>
            <p>Join municipalities using Metabolic City to save lives and resources through intelligent urban risk management.</p>
            <div className="cta-buttons">
              <button onClick={() => navigate('/signup')} className="cta-btn primary-cta">Get Started</button>
              <button onClick={() => navigate('/login')} className="cta-btn secondary-cta">Existing User</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="homepage-footer">
        <div className="footer-content">
          <p>&copy; 2024 Metabolic City. Urban Intelligence Platform.</p>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
