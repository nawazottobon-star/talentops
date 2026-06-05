import { useEffect, useState, useRef } from 'react';
import './OperationsEngine.css';

export default function OperationsEngine() {
  const [activeTier, setActiveTier] = useState('ai');
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const tiers = ['ai', 'human', 'expert'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % tiers.length;
      setActiveTier(tiers[idx]);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="oe-section arch-section" id="how-it-works" ref={sectionRef}>
      <div className="arch-bg-glow"></div>
      <div className="oe-wrap">
        <div className={`arch-header ${visible ? 'oe-in' : ''}`}>
          <div className="section-tag">Our Operating Model</div>
          <h2 className="section-title">Three Layers. Zero Gaps.<br/>One Seamless Operations Team.</h2>
          <p className="section-sub">Most software gives you a tool. TalentOps gives you an entire workforce operations team — one that never sleeps, never misses an escalation, and gets smarter every day.</p>
        </div>
        <div className={`arch-diagram ${visible ? 'oe-in' : ''}`}>
          <div className="arch-horiz">
            <div 
              className={`arch-card tier-ai ${activeTier === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTier('ai')}
              onMouseEnter={() => setActiveTier('ai')}
            >
              <div className="arch-tier-label ai"><span className="tl-dot"></span>Layer 01</div>
              <h3>Deputy AI Manager</h3>
              <p>Handles the majority of daily workforce operations automatically — 24/7, without bottlenecks or human fatigue.</p>
              <div className="arch-coverage">Covers <span>~80%</span> of all daily operations</div>
              <div className="arch-chips">
                <span className="arch-chip">Hiring workflows</span>
                <span className="arch-chip">Onboarding</span>
                <span className="arch-chip">Task tracking</span>
                <span className="arch-chip">Leave management</span>
                <span className="arch-chip">Payroll prep</span>
                <span className="arch-chip">Billing support</span>
                <span className="arch-chip">Performance tracking</span>
                <span className="arch-chip">Ticket management</span>
              </div>
            </div>
            <div className="arch-conn">
              <div className="arch-conn-line"><div className="arch-conn-particle" style={{ '--pc': 'rgba(74,142,250,0.8)' } as React.CSSProperties}></div></div>
              <div className="arch-conn-text">escalates<br/>exceptions</div>
            </div>
            <div 
              className={`arch-card tier-human ${activeTier === 'human' ? 'active' : ''}`}
              onClick={() => setActiveTier('human')}
              onMouseEnter={() => setActiveTier('human')}
            >
              <div className="arch-tier-label human"><span className="tl-dot"></span>Layer 02</div>
              <h3>Intermediary Operators</h3>
              <p>Human operators work alongside the AI — monitoring, reviewing edge cases, and applying judgment where it matters.</p>
              <div className="arch-coverage">Manages <span>~15%</span> of exceptions &amp; oversight</div>
              <div className="arch-chips">
                <span className="arch-chip">Monitor AI activity</span>
                <span className="arch-chip">Review exceptions</span>
                <span className="arch-chip">Correct issues</span>
                <span className="arch-chip">Verify critical actions</span>
                <span className="arch-chip">Employee support</span>
                <span className="arch-chip">Process verification</span>
              </div>
            </div>
            <div className="arch-conn">
              <div className="arch-conn-line"><div className="arch-conn-particle" style={{ '--pc': 'rgba(0,184,160,0.8)', animationDelay: '-0.9s' } as React.CSSProperties}></div></div>
              <div className="arch-conn-text">escalates<br/>complexity</div>
            </div>
            <div 
              className={`arch-card tier-expert ${activeTier === 'expert' ? 'active' : ''}`}
              onClick={() => setActiveTier('expert')}
              onMouseEnter={() => setActiveTier('expert')}
            >
              <div className="arch-tier-label expert"><span className="tl-dot"></span>Layer 03</div>
              <h3>Domain Experts</h3>
              <p>Seasoned specialists handle complex situations requiring deep domain knowledge — legal, payroll, compliance, and strategy.</p>
              <div className="arch-coverage">Resolves <span>~5%</span> of complex escalations</div>
              <div className="arch-chips">
                <span className="arch-chip">Payroll disputes</span>
                <span className="arch-chip">Legal &amp; compliance</span>
                <span className="arch-chip">Policy decisions</span>
                <span className="arch-chip">Complex clients</span>
                <span className="arch-chip">Escalated issues</span>
                <span className="arch-chip">Workforce strategy</span>
              </div>
            </div>
          </div>
          <div className="arch-esc">
            <span className="esc-note" style={{ width: '100%', textAlign: 'center', marginTop: '8px', display: 'block' }}>Every operation is covered. Nothing falls through the gaps.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
