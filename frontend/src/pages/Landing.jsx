import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  ShieldCheck, 
  Cpu, 
  Rocket, 
  ArrowRight, 
  Users, 
  BarChart3, 
  Layers,
  Search,
  BookOpen,
  LayoutDashboard,
  Sun,
  Moon
} from 'lucide-react';

import Orb from '../components/Orb';
import { useTheme } from '../context/ThemeContext';
import MagicBento from '../components/MagicBento';
import LogoWall from '../components/LogoWall';

const Landing = () => {
  const { theme, toggleTheme } = useTheme();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const statItems = [
    { label: 'Talent Sourced', value: '50K+' },
    { label: 'Assessments', value: '1.2M' },
    { label: 'Skills Identified', value: '450+' },
    { label: 'Active Deployments', value: '15K' },
  ];

  const pillarData = [
    {
      title: 'Source',
      description: 'AI-powered talent discovery. Parse thousands of resumes and identify top 1% candidates instantly.',
      label: 'Discovery',
      icon: <Search size={22} />,
      color: 'var(--bg-card)'
    },
    {
      title: 'Verify',
      description: 'Comprehensive assessments and skill verification to ensure the highest quality of hire.',
      label: 'Quality',
      icon: <ShieldCheck size={22} />,
      color: 'var(--bg-card)'
    },
    {
      title: 'Analytics',
      description: 'Gain deep, actionable insights into your entire organization\'s talent landscape.',
      label: 'Intelligence',
      icon: <BarChart3 size={22} />,
      color: 'var(--bg-card)'
    },
    {
      title: 'Forge',
      description: 'Custom upskilling and training modules designed for continuous professional growth.',
      label: 'Growth',
      icon: <BookOpen size={20} />,
      color: 'var(--bg-card)'
    },
    {
      title: 'Deploy',
      description: 'Strategic workforce deployment and project matching using advanced organizational AI.',
      label: 'Efficiency',
      icon: <Rocket size={20} />,
      color: 'var(--bg-card)'
    },
    {
      title: 'Integrated',
      description: 'Connect seamlessly with your existing HR stack and enterprise tools.',
      label: 'ecosystem',
      icon: <Layers size={20} />,
      color: 'var(--bg-card)'
    }
  ];

  return (
    <div className={`landing-page ${theme}`}>
      {/* Global Background */}
      <div className="page-bg" style={{ backgroundColor: 'var(--bg-page)' }} />
      
      {/* Dynamic Background Blob */}
      <div className="floating-blob" style={{ 
        top: '60%', 
        right: '-10%', 
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.1
      }} />

      {/* Navigation */}
      <nav style={{ 
        padding: '32px 40px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-icon">P</div>
          <span style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            PHYGITRON<span style={{ color: 'var(--primary)', opacity: 0.8 }}>360</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="btn-theme-toggle"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/login" className="btn btn-ghost" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>Log In</Link>
          <Link to="/login" className="btn btn-shimmer" style={{ padding: '12px 24px', borderRadius: '14px' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ 
        padding: '200px 0 140px', 
        textAlign: 'center',
        background: 'var(--bg-page)', 
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden'
      }}>
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: 0,
          opacity: theme === 'dark' ? 0.6 : 0.35,
          pointerEvents: 'none'
        }}>
          <Orb 
            hoverIntensity={2} 
            rotateOnHover={true} 
            hue={0} 
            forceHoverState={false} 
            backgroundColor={theme === 'dark' ? '#000000' : '#FAF9FF'}
          />
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="badge" style={{ 
              marginBottom: '32px', 
              padding: '10px 20px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
              color: 'var(--primary)',
              borderRadius: '100px',
              fontSize: '0.85rem'
            }}>
              <Zap size={14} style={{ marginRight: '8px' }} />
              Revolutionizing Talent Lifecycle Management
            </span>
            <h1 style={{ 
              fontSize: 'clamp(3rem, 10vw, 5.5rem)', 
              fontWeight: 900, 
              lineHeight: 0.95,
              marginBottom: '32px',
              letterSpacing: '-0.05em',
              color: 'var(--text-primary)'
            }}>
              Master Your <br />
              <span className="text-gradient-shiny" style={{ filter: theme === 'light' ? 'brightness(0.9)' : 'brightness(1.3)' }}>Talent Universe</span>
            </h1>
            <p style={{ 
              fontSize: '1.25rem', 
              maxWidth: '650px', 
              margin: '0 auto 48px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Align your workforce with AI-driven precision. From discovery to deployment, Phygitron360 provides the intelligence to forge elite teams.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-primary btn-lg" style={{ padding: '18px 40px', borderRadius: '16px', fontSize: '1.1rem' }}>
                Join the Future <ArrowRight size={20} />
              </Link>
              <button className="btn btn-secondary btn-lg" style={{ padding: '18px 40px', borderRadius: '16px', background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border)', fontSize: '1.1rem' }}>
                Explore Platform
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Logo Loop Section */}
      <section style={{ 
        padding: '60px 0 100px', 
        position: 'relative', 
        zIndex: 2, 
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden' 
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <p style={{ 
            textTransform: 'uppercase', 
            letterSpacing: '0.3em', 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            color: 'var(--primary)',
            opacity: 0.8
          }}>Scale. Intelligence. Impact.</p>
        </div>
        <LogoWall 
          items={statItems} 
          speed={30} 
          pauseOnHover={true} 
          direction="left"
        />
      </section>

      {/* Feature Bento Grid with MagicBento */}
      <section style={{ padding: '100px 40px', maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '20px', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>One Platform. Six Pillars.</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
            A unified ecosystem designed to build, verify, and scale your most valuable asset: human capital.
          </p>
        </div>

        <MagicBento 
          cardData={pillarData}
          textAutoHide={true}
          enableStars={theme === 'dark'}
          enableSpotlight={true}
          enableBorderGlow={true}
          glowColor={theme === 'dark' ? '124, 58, 237' : '124, 58, 237'}
          particleCount={20}
          clickEffect={true}
        />
      </section>

      {/* Professional Brand Wall */}
      <section style={{ padding: '100px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '60px', textTransform: 'uppercase', letterSpacing: '0.4em', fontSize: '0.75rem', fontWeight: 700 }}>Trusted by Forward-Thinking Organizations</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '80px', opacity: 0.4 }}>
            {['MATA', 'AMAZON', 'GOOGLE', 'NETFLIX', 'APPLE'].map(brand => (
              <span key={brand} style={{ 
                fontWeight: 900, 
                fontSize: '1.8rem', 
                color: 'var(--text-primary)', 
                letterSpacing: '0.2em'
              }}>{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer style={{ 
        padding: '160px 40px 80px', 
        textAlign: 'center', 
        background: 'var(--bg-page)', 
        color: 'var(--text-primary)', 
        position: 'relative', 
        overflow: 'hidden',
        borderTop: '1px solid var(--border)'
      }}>
        <div className="floating-blob" style={{ bottom: '-20%', left: '30%', width: '800px', height: '800px', opacity: 0.08 }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ position: 'relative', zIndex: 2 }}
        >
          <h2 style={{ color: 'var(--text-primary)', fontSize: '4rem', fontWeight: 900, marginBottom: '32px', letterSpacing: '-0.04em' }}>Forge the Future of Work.</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto 56px', fontSize: '1.2rem', lineHeight: 1.6 }}>
            Join the organization's evolving with Phygitron360. Professional-grade workforce intelligence starts here.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Link to="/login" className="btn btn-shimmer btn-lg" style={{ padding: '24px 48px', fontSize: '1.2rem', borderRadius: '20px' }}>
              Initialize Your Account
            </Link>
          </div>
          
          <div style={{ 
            marginTop: '140px', 
            paddingTop: '60px', 
            borderTop: '1px solid var(--border)', 
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '32px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Security</span>
              <span>API Docs</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', opacity: 0.6 }}>
              &copy; 2026 Phygitron360 Inc. Professional AI for Human Excellence.
            </div>
          </div>
        </motion.div>
      </footer>
    </div>
  );
};

export default Landing;
