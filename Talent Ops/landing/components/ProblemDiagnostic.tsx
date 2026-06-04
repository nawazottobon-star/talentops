import { useEffect, useRef, useState } from 'react';
import './ProblemDiagnostic.css';

const problems = [
  {
    id: 'burnout',
    code: 'ERR_001',
    severity: 'CRITICAL',
    label: 'Burnout Detection',
    headline: "You don't know who's burning out",
    body: 'High-impact employees leave without warning. No visibility into workload distribution means you react after the damage is done.',
    metric: { value: 74, suffix: '%', label: 'of exits are preventable' },
    color: '#FF4D4D',
    glow: 'rgba(255,77,77,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: 'accountability',
    code: 'ERR_002',
    severity: 'HIGH',
    label: 'Task Accountability',
    headline: 'No one knows who\'s doing what',
    body: 'Tasks fall through the gaps. Accountability is unclear. Managers spend hours chasing status updates instead of leading.',
    metric: { value: 31, suffix: 'hrs', label: 'lost per manager/week' },
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    id: 'hiring',
    code: 'ERR_003',
    severity: 'HIGH',
    label: 'Capacity Planning',
    headline: 'Hiring gaps are invisible until critical',
    body: 'Recruitment is driven by urgency, not data. Teams are over- or under-staffed before leaders even notice the problem.',
    metric: { value: 60, suffix: 'days', label: 'avg delay in hiring response' },
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    id: 'systems',
    code: 'ERR_004',
    severity: 'CRITICAL',
    label: 'System Integration',
    headline: 'Disconnected systems, wasted time',
    body: 'HR, finance, and operations live in separate tools. Data is scattered. Payroll, billing, and staffing never align.',
    metric: { value: 12, suffix: '+', label: 'tools the avg team juggles' },
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    id: 'cost',
    code: 'ERR_005',
    severity: 'MEDIUM',
    label: 'HR Overhead',
    headline: 'Building a full HR team is expensive',
    body: 'Hiring a recruiter, HR manager, payroll executive, and operations coordinator for 20 people is simply not cost-effective.',
    metric: { value: 280, suffix: 'K', label: 'avg annual HR team cost' },
    color: '#06B6D4',
    glow: 'rgba(6,182,212,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'performance',
    code: 'ERR_006',
    severity: 'HIGH',
    label: 'Performance Tracking',
    headline: 'Performance issues surface too late',
    body: "Problems emerge only after targets are missed or clients complain — making recovery costly and damaging to relationships.",
    metric: { value: 83, suffix: '%', label: 'of issues were predictable' },
    color: '#10B981',
    glow: 'rgba(16,185,129,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#FF4D4D',
  HIGH: '#F59E0B',
  MEDIUM: '#06B6D4',
};

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const interval = setInterval(() => {
            current = Math.min(current + increment, target);
            setCount(Math.floor(current));
            if (current >= target) clearInterval(interval);
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
}

export function ProblemDiagnostic() {
  const [active, setActive] = useState<string | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scanRef.current = setInterval(() => {
      setScanLine(prev => (prev + 1) % problems.length);
    }, 6000);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, []);

  const activeProblem = active ? problems.find(p => p.id === active) : problems[scanLine];

  return (
    <section className="pd-section">
      <div className="pd-container">

        {/* Header */}
        <div className="pd-header">
          <div className="pd-tag">
            <span className="pd-tag-dot" />
            SYSTEM DIAGNOSTIC
          </div>
          <h2 className="pd-title">
            Why Workforce Management<br />
            <em>Breaks at Scale</em>
          </h2>
          <p className="pd-subtitle">
            Small and mid-sized teams face the same painful gaps —<br />
            and most software only adds complexity instead of solving it.
          </p>
        </div>

        {/* Main layout */}
        <div className="pd-layout">

          {/* Left: Error list */}
          <div className="pd-list">
            <div className="pd-list-header">
              <span className="pd-list-title">DETECTED ISSUES</span>
              <span className="pd-list-count">{problems.length} ACTIVE</span>
            </div>
            <div className="pd-list-items">
              {problems.map((p, i) => (
                <div
                  key={p.id}
                  className={`pd-list-item ${(active === p.id || (!active && scanLine === i)) ? 'pd-list-item--active' : ''}`}
                  style={{ '--item-color': p.color, '--item-glow': p.glow } as React.CSSProperties}
                  onMouseEnter={() => { setActive(p.id); if (scanRef.current) clearInterval(scanRef.current); }}
                  onMouseLeave={() => {
                    setActive(null);
                    scanRef.current = setInterval(() => setScanLine(prev => (prev + 1) % problems.length), 6000);
                  }}
                >
                  <div className="pd-list-left">
                    <div className="pd-list-icon">{p.icon}</div>
                    <div className="pd-list-info">
                      <span className="pd-list-code">{p.code}</span>
                      <span className="pd-list-label">{p.label}</span>
                    </div>
                  </div>
                  <div className="pd-list-right">
                    <span className="pd-severity" style={{ color: SEVERITY_COLOR[p.severity] }}>
                      <span className="pd-severity-dot" style={{ background: SEVERITY_COLOR[p.severity] }} />
                      {p.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail panel */}
          {activeProblem && (
            <div
              className="pd-detail"
              key={activeProblem.id}
              style={{ '--detail-color': activeProblem.color, '--detail-glow': activeProblem.glow } as React.CSSProperties}
            >
              {/* Top bar */}
              <div className="pd-detail-bar">
                <div className="pd-detail-dots">
                  <span /><span /><span />
                </div>
                <span className="pd-detail-path">talentops://diagnostic/{activeProblem.code}</span>
                <span className="pd-detail-live">
                  <span className="pd-live-dot" />
                  LIVE
                </span>
              </div>

              {/* Content */}
              <div className="pd-detail-body">
                <div className="pd-detail-severity">
                  <span style={{ color: SEVERITY_COLOR[activeProblem.severity] }}>
                    ◆ SEVERITY: {activeProblem.severity}
                  </span>
                  <span className="pd-detail-id">{activeProblem.code}</span>
                </div>

                <div className="pd-detail-icon-wrap">
                  {activeProblem.icon}
                </div>

                <h3 className="pd-detail-headline">{activeProblem.headline}</h3>
                <p className="pd-detail-body-text">{activeProblem.body}</p>

                {/* Metric */}
                <div className="pd-metric">
                  <div className="pd-metric-value">
                    <AnimatedCounter target={activeProblem.metric.value} suffix={activeProblem.metric.suffix} />
                  </div>
                  <div className="pd-metric-label">{activeProblem.metric.label}</div>
                </div>

                {/* Scan bar */}
                <div className="pd-scan-bar">
                  <div className="pd-scan-fill" style={{ '--bar-color': activeProblem.color } as React.CSSProperties} />
                </div>
                <div className="pd-scan-label">ANALYZING IMPACT...</div>

                {/* Resolution */}
                <div className="pd-resolution">
                  <span className="pd-resolution-label">TALENTOPS RESOLUTION</span>
                  <span className="pd-resolution-value">AI-powered early detection active</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom summary bar */}
        <div className="pd-summary-bar">
          {problems.map(p => (
            <div key={p.id} className="pd-summary-item" style={{ '--item-color': p.color } as React.CSSProperties}>
              <div className="pd-summary-dot" style={{ background: p.color }} />
              <span>{p.code}</span>
            </div>
          ))}
          <div className="pd-summary-status">
            <span className="pd-status-dot" />
            TalentOps monitoring active
          </div>
        </div>

      </div>
    </section>
  );
}

export default ProblemDiagnostic;
