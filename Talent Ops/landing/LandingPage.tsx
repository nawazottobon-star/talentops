import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import GridScan from './components/GridScan';
import ProblemDiagnostic from './components/ProblemDiagnostic';
import OperationsEngine from './components/OperationsEngine';
import './LandingPage.css';

export function LandingPage() {
  const [activeModule, setActiveModule] = useState('tasks');

  return (
    <div className="landing-page-wrapper">


      {/**/}
      <nav>
        <a href="#" className="nav-logo">Talent<span>Ops</span></a>
        <div className="nav-links">
          <a href="#problem">Problem</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#modules">Modules</a>
          <a href="#industries">Industries</a>
          <a href="#results">Results</a>
          <Link to="/pricing">Pricing</Link>
        </div>
        <div className="nav-cta">
          <Link to="/login" className="btn btn-ghost">Sign In</Link>
          <Link to="/wizard" className="btn btn-primary">Partner with Us →</Link>
        </div>
      </nav>

      {/**/}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>

        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#1e293b"
          gridScale={0.1}
          scanColor="#1B6BF5"
          scanOpacity={0.4}
          enablePost
          bloomIntensity={0.6}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-badge"><span className="dot"></span> AI-Powered Workforce Operations</div>
          <h1>Stop Managing Talent <em>by Instinct.</em><br />Start Operating with Intelligence.</h1>
          <p>TalentOps combines AI automation, human operators, and expert guidance to run your entire workforce — hiring, tasks, payroll, attendance, and more.</p>
          <div className="hero-btns">
            <Link to="/wizard" className="btn btn-primary btn-lg">Partner with an AI-Powered Ops Team</Link>
            <a href="#modules" className="btn btn-outline-white btn-lg">See the Platform</a>
          </div>
          <div className="hero-trust">
            <span>✓ No large HR team needed</span>
            <span className="hero-trust-dot"></span>
            <span>✓ AI handles 80% of daily ops</span>
            <span className="hero-trust-dot"></span>
            <span>✓ Experts on call for complex cases</span>
          </div>
        </div>
      </section>

      {/**/}

      {/**/}
      <ProblemDiagnostic />

      {/**/}
      <OperationsEngine />

      {/**/}
      <section className="modules-section" id="modules">
        <div className="container">
          <div className="section-tag">Platform Modules</div>
          <h2 className="section-title">Every Workforce Function. One System.</h2>
          <p className="section-sub">Real modules built for how your team actually operates — not abstract feature lists.</p>

          <div className="module-tabs">
            <div className={`module-tab ${activeModule === "tasks" ? "active" : ""}`} onClick={() => setActiveModule("tasks")}>Task Management</div>
            <div className={`module-tab ${activeModule === "people" ? "active" : ""}`} onClick={() => setActiveModule("people")}>People Operations</div>
            <div className={`module-tab ${activeModule === "finance" ? "active" : ""}`} onClick={() => setActiveModule("finance")}>Finance &amp; Billing</div>
            <div className={`module-tab ${activeModule === "hiring" ? "active" : ""}`} onClick={() => setActiveModule("hiring")}>Hiring Pipeline</div>
            <div className={`module-tab ${activeModule === "comms" ? "active" : ""}`} onClick={() => setActiveModule("comms")}>Communications</div>
          </div>

          {/**/}
          <div className={`module-showcase ${activeModule === "tasks" ? "active" : ""}`} id="mod-tasks">
            <div className="module-info">
              <h3>Task Management</h3>
              <p>Know exactly who is doing what, when it's due, and where things stand — without chasing anyone for updates.</p>
              <ul className="module-features">
                <li>Assign tasks with owners, deadlines, and priority levels</li>
                <li>Real-time progress tracking across every team</li>
                <li>Automatic escalation when tasks are overdue</li>
                <li>Identify overloaded team members before burnout hits</li>
                <li>Link tasks to clients, projects, or billing records</li>
              </ul>
            </div>
            <div className="module-screen">
              <div className="screen-topbar">
                <div className="screen-dots"><div className="screen-dot" style={{ background: '#FF5F57' }}></div><div className="screen-dot" style={{ background: '#FEBC2E' }}></div><div className="screen-dot" style={{ background: '#28C840' }}></div></div>
                <span className="screen-title">TalentOps — Task Module</span>
              </div>
              <div className="screen-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy)' }}>Active Tasks <span style={{ background: 'var(--blue-light)', color: 'var(--blue-brand)', borderRadius: '100px', padding: '2px 8px', fontSize: '0.72rem', marginLeft: '6px' }}>24</span></div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className="mini-badge badge-blue">My Tasks</span>
                    <span className="mini-badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>All Teams</span>
                  </div>
                </div>
                <table className="mini-table">
                  <tr><th>Task</th><th>Assignee</th><th>Progress</th><th>Status</th></tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Onboard Priya S.</strong><br /><span style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Due: Today</span></td>
                    <td>Raj K.</td>
                    <td><div style={{ width: '80px' }}><div className="mini-prog-bar"><div className="mini-prog-fill" style={{ width: '70%' }}></div></div></div></td>
                    <td><span className="mini-badge badge-amber">In Progress</span></td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Q3 Payroll Review</strong><br /><span style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Due: Tomorrow</span></td>
                    <td>Meera T.</td>
                    <td><div style={{ width: '80px' }}><div className="mini-prog-bar"><div className="mini-prog-fill" style={{ width: '100%', background: 'var(--teal)' }}></div></div></div></td>
                    <td><span className="mini-badge badge-green">Done</span></td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Interview — Dev Role</strong><br /><span style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Due: Jun 5</span></td>
                    <td>Arjun M.</td>
                    <td><div style={{ width: '80px' }}><div className="mini-prog-bar"><div className="mini-prog-fill" style={{ width: '30%' }}></div></div></div></td>
                    <td><span className="mini-badge badge-red">Overdue</span></td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Client Billing — June</strong><br /><span style={{ color: 'var(--gray-400)', fontSize: '0.7rem' }}>Due: Jun 10</span></td>
                    <td>AI Manager</td>
                    <td><div style={{ width: '80px' }}><div className="mini-prog-bar"><div className="mini-prog-fill" style={{ width: '50%' }}></div></div></div></td>
                    <td><span className="mini-badge badge-blue">Automated</span></td>
                  </tr>
                </table>
              </div>
            </div>
          </div>

          {/**/}
          <div className={`module-showcase ${activeModule === "people" ? "active" : ""}`} id="mod-people">
            <div className="module-info">
              <h3>People Operations</h3>
              <p>Manage attendance, leave, and employee records — with full visibility into who's in, who's out, and who's overloaded.</p>
              <ul className="module-features">
                <li>Real-time attendance tracking and timesheets</li>
                <li>Leave request and approval workflows</li>
                <li>Employee lifecycle management from offer to exit</li>
                <li>Workload heatmaps to spot burnout risk early</li>
                <li>Contractor and full-time employee support</li>
              </ul>
            </div>
            <div className="module-screen">
              <div className="screen-topbar">
                <div className="screen-dots"><div className="screen-dot" style={{ background: '#FF5F57' }}></div><div className="screen-dot" style={{ background: '#FEBC2E' }}></div><div className="screen-dot" style={{ background: '#28C840' }}></div></div>
                <span className="screen-title">TalentOps — People Operations</span>
              </div>
              <div className="screen-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy)' }}>Team Attendance — Today</div>
                  <span className="mini-badge badge-green">18 / 22 Present</span>
                </div>
                <table className="mini-table">
                  <tr><th>Employee</th><th>Role</th><th>Status</th><th>Hours Today</th></tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Ananya R.</strong></td>
                    <td style={{ color: 'var(--gray-400)' }}>Developer</td>
                    <td><span className="mini-badge badge-green">Present</span></td>
                    <td>6h 42m</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Siddharth P.</strong></td>
                    <td style={{ color: 'var(--gray-400)' }}>Designer</td>
                    <td><span className="mini-badge badge-amber">Leave</span></td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Kavitha M.</strong></td>
                    <td style={{ color: 'var(--gray-400)' }}>HR Ops</td>
                    <td><span className="mini-badge badge-green">Present</span></td>
                    <td>7h 10m</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--navy)' }}>Vikram S.</strong></td>
                    <td style={{ color: 'var(--gray-400)' }}>Analyst</td>
                    <td><span className="mini-badge badge-red">⚠ Overloaded</span></td>
                    <td>9h 55m</td>
                  </tr>
                </table>
                <div style={{ marginTop: '14px', padding: '10px 12px', background: '#FEF3DC', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: '#92600A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠</span> <strong>Burnout alert:</strong> Vikram S. has worked 50+ hours this week. AI has flagged for review.
                </div>
              </div>
            </div>
          </div>

          {/**/}
          <div className={`module-showcase ${activeModule === "finance" ? "active" : ""}`} id="mod-finance">
            <div className="module-info">
              <h3>Finance &amp; Billing</h3>
              <p>Track hours, prepare payroll data, and manage client billing — all synced with your workforce records.</p>
              <ul className="module-features">
                <li>Automated payroll data compilation and review</li>
                <li>Client billing tied directly to project hours</li>
                <li>Invoice tracking and payment status</li>
                <li>Expense management and approvals</li>
                <li>Contractor payment reconciliation</li>
              </ul>
            </div>
            <div className="module-screen">
              <div className="screen-topbar">
                <div className="screen-dots"><div className="screen-dot" style={{ background: '#FF5F57' }}></div><div className="screen-dot" style={{ background: '#FEBC2E' }}></div><div className="screen-dot" style={{ background: '#28C840' }}></div></div>
                <span className="screen-title">TalentOps — Finance Module</span>
              </div>
              <div className="screen-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--navy)' }}>₹8.4L</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>Payroll This Month</div>
                  </div>
                  <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--blue-brand)' }}>₹12.2L</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--blue-brand)' }}>Client Billed</div>
                  </div>
                  <div style={{ background: '#E0F7F5', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0D7A5F' }}>5 Pending</div>
                    <div style={{ fontSize: '0.7rem', color: '#0D7A5F' }}>Invoices</div>
                  </div>
                </div>
                <table className="mini-table">
                  <tr><th>Client</th><th>Hours</th><th>Amount</th><th>Status</th></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>TechCorp India</strong></td><td>142h</td><td>₹3.6L</td><td><span className="mini-badge badge-green">Paid</span></td></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>MedPlus Clinics</strong></td><td>88h</td><td>₹2.1L</td><td><span className="mini-badge badge-amber">Pending</span></td></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>LegalEdge LLP</strong></td><td>60h</td><td>₹1.8L</td><td><span className="mini-badge badge-blue">Generated</span></td></tr>
                </table>
              </div>
            </div>
          </div>

          {/**/}
          <div className={`module-showcase ${activeModule === "hiring" ? "active" : ""}`} id="mod-hiring">
            <div className="module-info">
              <h3>Hiring Pipeline</h3>
              <p>Manage every open role from job posting to offer letter — with capacity data driving every hiring decision.</p>
              <ul className="module-features">
                <li>Capacity-based hiring recommendations</li>
                <li>Candidate tracking through every stage</li>
                <li>Interview scheduling and coordination</li>
                <li>Offer management and onboarding handoff</li>
                <li>Hiring gap alerts before they become critical</li>
              </ul>
            </div>
            <div className="module-screen">
              <div className="screen-topbar">
                <div className="screen-dots"><div className="screen-dot" style={{ background: '#FF5F57' }}></div><div className="screen-dot" style={{ background: '#FEBC2E' }}></div><div className="screen-dot" style={{ background: '#28C840' }}></div></div>
                <span className="screen-title">TalentOps — Hiring Pipeline</span>
              </div>
              <div className="screen-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy)' }}>Open Roles</div>
                  <span className="mini-badge badge-red">2 Critical Gaps</span>
                </div>
                <table className="mini-table">
                  <tr><th>Role</th><th>Stage</th><th>Candidates</th><th>Priority</th></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>Senior Developer</strong></td><td><span className="mini-badge badge-amber">Interview</span></td><td>4</td><td><span className="mini-badge badge-red">High</span></td></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>UX Designer</strong></td><td><span className="mini-badge badge-blue">Screening</span></td><td>11</td><td><span className="mini-badge badge-amber">Medium</span></td></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>Ops Coordinator</strong></td><td><span className="mini-badge badge-green">Offer Sent</span></td><td>1</td><td><span className="mini-badge badge-green">Filled</span></td></tr>
                  <tr><td><strong style={{ color: 'var(--navy)' }}>Data Analyst</strong></td><td><span className="mini-badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>Sourcing</span></td><td>2</td><td><span className="mini-badge badge-red">Urgent</span></td></tr>
                </table>
              </div>
            </div>
          </div>

          {/**/}
          <div className={`module-showcase ${activeModule === "comms" ? "active" : ""}`} id="mod-comms">
            <div className="module-info">
              <h3>Communications</h3>
              <p>Centralize all employee and client communication — announcements, requests, updates, and notifications in one place.</p>
              <ul className="module-features">
                <li>Broadcast announcements to teams or individuals</li>
                <li>Employee request and ticket management</li>
                <li>Automated notifications for key events</li>
                <li>Client communication logs and updates</li>
                <li>Escalation tracking and resolution</li>
              </ul>
            </div>
            <div className="module-screen">
              <div className="screen-topbar">
                <div className="screen-dots"><div className="screen-dot" style={{ background: '#FF5F57' }}></div><div className="screen-dot" style={{ background: '#FEBC2E' }}></div><div className="screen-dot" style={{ background: '#28C840' }}></div></div>
                <span className="screen-title">TalentOps — Communications</span>
              </div>
              <div className="screen-body">
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy)', marginBottom: '14px' }}>Recent Notifications <span className="mini-badge badge-red" style={{ marginLeft: '4px' }}>3 New</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>Leave Approved — Siddharth P.</div>
                    <div style={{ color: 'var(--gray-400)', fontSize: '0.72rem', marginTop: '2px' }}>AI Manager approved 2-day leave request • 10 min ago</div>
                  </div>
                  <div style={{ background: '#FEF3DC', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>⚠ Ticket Escalated</div>
                    <div style={{ color: 'var(--gray-400)', fontSize: '0.72rem', marginTop: '2px' }}>Payroll discrepancy escalated to Expert team • 1 hr ago</div>
                  </div>
                  <div style={{ background: '#E0F7F5', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>Announcement Sent</div>
                    <div style={{ color: 'var(--gray-400)', fontSize: '0.72rem', marginTop: '2px' }}>Q2 performance review cycle begins June 10 • 3 hr ago</div>
                  </div>
                  <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--navy)' }}>New Hire Onboarded</div>
                    <div style={{ color: 'var(--gray-400)', fontSize: '0.72rem', marginTop: '2px' }}>Priya S. has completed onboarding checklist • 5 hr ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE SECTION */}
      <div className="marquee-section">
        <div className="marquee-track">
          <div className="marquee-item"><span className="marquee-dot"></span>Task Management</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Payroll Automation</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Attendance Tracking</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Hiring Workflows</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Employee Onboarding</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Task Management</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Payroll Automation</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Attendance Tracking</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Hiring Workflows</div>
          <div className="marquee-item"><span className="marquee-dot"></span>Employee Onboarding</div>
        </div>
      </div>

      {/* Problem Diagnostic — replaces old pain section */}

      {/**/}
      <section className="industries-section" id="industries">
        <div className="container">
          <div className="section-head-center">
            <div className="section-tag">Industries</div>
            <h2 className="section-title">Built for Firms Where People Are the Product</h2>
            <p className="section-sub">TalentOps is purpose-built for professional services, tech, and knowledge-driven businesses managing complex contractor setups.</p>
          </div>
          <div className="industry-grid">
            <div className="industry-card">
              <div className="industry-icon">💻</div>
              <h3>Technology &amp; Software</h3>
              <p>Manage engineers, contractors, and product teams across sprint cycles and project deliverables.</p>
            </div>
            <div className="industry-card">
              <div className="industry-icon">⚖️</div>
              <h3>Legal &amp; Consulting</h3>
              <p>Track billable hours, client assignments, and partner utilization across practice areas.</p>
            </div>
            <div className="industry-card">
              <div className="industry-icon">🏥</div>
              <h3>Medical &amp; Healthcare</h3>
              <p>Manage shift scheduling, compliance requirements, and multi-location staff operations.</p>
            </div>
            <div className="industry-card">
              <div className="industry-icon">📈</div>
              <h3>Scaling Startups</h3>
              <p>Build operational discipline from day one — so your processes scale as fast as your team does.</p>
            </div>
          </div>
        </div>
      </section>

      {/**/}
      <section className="results-section" id="results">
        <div className="container">
          <div className="section-head-center">
            <div className="section-tag" style={{ background: 'rgba(27,107,245,0.15)', color: 'var(--blue-mid)' }}>Results</div>
            <h2 className="section-title">What Happens When You Bring Structure of Talent Ops</h2>
            <p className="section-sub">Numbers from organizations that moved from reactive chaos to proactive clarity.</p>
          </div>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-num">40%</div>
              <div className="metric-label">Faster time to hire</div>
            </div>
            <div className="metric-card">
              <div className="metric-num">3×</div>
              <div className="metric-label">Better retention rates</div>
            </div>
            <div className="metric-card">
              <div className="metric-num">65%</div>
              <div className="metric-label">More confident managers</div>
            </div>
            <div className="metric-card">
              <div className="metric-num">25%</div>
              <div className="metric-label">Higher team productivity</div>
            </div>
          </div>
          <div className="testimonials">
            <div className="testimonial">
              <p>"TalentOps gave us the structure we were missing. We went from reactive chaos to proactive clarity — and we did it without adding a single HR headcount."</p>
              <div className="testimonial-author">
                <div className="author-avatar">SM</div>
                <div>
                  <div className="author-name">Sarah Mitchell</div>
                  <div className="author-role">COO, TechFlow Solutions</div>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <p>"Their frameworks scaled with us. What worked at 30 people still works at 200. We didn't have to rebuild everything when we hit growth inflection points."</p>
              <div className="testimonial-author">
                <div className="author-avatar">DC</div>
                <div>
                  <div className="author-name">David Chen</div>
                  <div className="author-role">Founder, GrowthLabs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/**/}
      <section className="why-section" id="why">
        <div className="container">
          <div className="why-grid">
            <div>
              <div className="section-tag">Why TalentOps</div>
              <h2 className="section-title">We Don't Just Advise — We Build, Implement, and Optimize Alongside You.</h2>
              <div className="why-list">
                <div className="why-item">
                  <div className="why-icon"><svg fill="none" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>
                  <div>
                    <h4>Deep talent operations expertise — not generic HR advice</h4>
                    <p>We understand the operational reality of running people at scale, not just the theory.</p>
                  </div>
                </div>
                <div className="why-item">
                  <div className="why-icon"><svg fill="none" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div>
                  <div>
                    <h4>Systems built to scale — not quick fixes</h4>
                    <p>What we implement at 20 people still works at 200. Architecture matters from day one.</p>
                  </div>
                </div>
                <div className="why-item">
                  <div className="why-icon"><svg fill="none" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                  <div>
                    <h4>Hands-on implementation — not just strategy documents</h4>
                    <p>We work inside your operations, not just advise from the outside.</p>
                  </div>
                </div>
                <div className="why-item">
                  <div className="why-icon"><svg fill="none" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                  <div>
                    <h4>Data-driven insights that get better over time</h4>
                    <p>The AI learns your organization's patterns and continuously improves its recommendations.</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="why-card">
                <div className="why-stat">
                  <div className="why-stat-num">100+</div>
                  <div className="why-stat-label">Organizations Transformed</div>
                </div>
                <hr className="why-stat-divider" />
                <div className="why-stat">
                  <div className="why-stat-num">15+</div>
                  <div className="why-stat-label">Years Combined Experience</div>
                </div>
                <hr className="why-stat-divider" />
                <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', lineHeight: '1.7', marginBottom: '20px' }}>From 5-person startups to 500-person enterprises — we've seen the patterns that break teams and built systems to prevent them.</p>
                  <Link to="/wizard" className="btn btn-white" style={{ display: 'inline-flex' }}>Partner with Us →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/**/}
      <section className="cta-section" id="cta">
        <div className="container">
          <h2>Build Structure Into Your Growth</h2>
          <p>Stop managing talent by instinct. Partner with an AI-powered operations team and run your workforce with confidence from day one.</p>
          <div className="cta-btns">
            <Link to="/wizard" className="btn btn-white btn-lg">Partner with an AI-Powered Ops Team</Link>
            <a href="#modules" className="btn btn-outline-white btn-lg">Explore the Platform</a>
          </div>
          <p className="cta-note">30-minute consultation · No commitment required · Trusted by 100+ organizations</p>
        </div>
      </section>

      {/**/}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-logo">Talent<span>Ops</span></div>
              <p className="footer-desc">Clear talent operations for growing teams. We design, build, and optimize your people systems — powered by AI, backed by human expertise.</p>
            </div>
            <div>
              <h4>Platform</h4>
              <ul>
                <li><a href="#">Task Management</a></li>
                <li><a href="#">People Operations</a></li>
                <li><a href="#">Finance &amp; Billing</a></li>
                <li><a href="#">Hiring Pipeline</a></li>
                <li><a href="#">Communications</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Industries</a></li>
                <li><a href="#">Results</a></li>
                <li><a href="#">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4>Connect</h4>
              <ul>
                <li><a href="#">LinkedIn</a></li>
                <li><a href="#">Twitter</a></li>
                <li><a href="#">Instagram</a></li>
                <li><Link to="/wizard">Partner with Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 TalentOps. All rights reserved.</span>
            <span>Privacy Policy · Terms of Service</span>
          </div>
        </div>
      </footer>


    </div>
  );
}
