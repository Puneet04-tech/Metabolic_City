import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      <nav className="homepage-nav">
        <div className="nav-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DC2626" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <circle cx="20" cy="20" r="18" stroke="url(#logoGradient)" strokeWidth="3" fill="none" />
            <path d="M20 8 L20 32 M8 20 L32 20" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="logo-text">
            <h1>Metabolic City</h1>
            <p>Urban Intelligence Platform</p>
          </span>
        </div>
        <div className="nav-buttons">
          <button className="btn-secondary" onClick={() => navigate('/login')}>Login</button>
          <button className="btn-submit" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-badge">AI-Powered Urban Risk Management</span>
          <h1 className="hero-title">Real-Time City Intelligence & Emergency Response</h1>
          <p className="hero-description">
            Advanced spatial analytics, real-time incident detection, and automated field crew dispatch for modern municipalities.
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span>Real-time Detection</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Spatial Analytics</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚀</span>
              <span>Automated Response</span>
            </div>
          </div>
        </div>
      </section>

      <section className="info-section">
        <div className="info-card">
          <div className="info-icon">🏛️</div>
          <h3>For Municipalities</h3>
          <p>City-wide risk monitoring, data-driven governance, and automated emergency coordination for smarter urban management.</p>
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
      </section>

      <section className="stats-section">
        <div className="stat-item">
          <div className="stat-value">10,000+</div>
          <div className="stat-label">Active H3 Cells</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">24/7</div>
          <div className="stat-label">Real-time Monitoring</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">&lt;5s</div>
          <div className="stat-label">Detection Time</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">AI</div>
          <div className="stat-label">Risk Assessment</div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Transform Your City's Emergency Response?</h2>
        <p>Join hundreds of municipalities using Metabolic City for smarter, faster urban risk management.</p>
        <div className="cta-buttons">
          <button className="btn-submit" onClick={() => navigate('/signup')}>Get Started</button>
          <button className="btn-secondary" onClick={() => navigate('/login')}>Existing User</button>
        </div>
      </section>

      <footer className="homepage-footer">
        <div className="footer-content">
          <p>&copy; 2024 Metabolic City. All rights reserved.</p>
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
