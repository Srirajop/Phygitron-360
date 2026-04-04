import React, { useRef, useEffect } from 'react';
import './LogoWall.css';

const LogoWall = ({ 
  items = [], 
  direction = 'left', 
  pauseOnHover = true,
  speed = 40,
  className = '' 
}) => {
  const scrollRef = useRef(null);

  // Duplicate items for seamless loop
  const displayItems = [...items, ...items, ...items];

  return (
    <div className={`logo-wall-container ${className} ${pauseOnHover ? 'pause-hover' : ''}`}>
      <div 
        className="logo-wall-scroll" 
        style={{ 
          animationDirection: direction === 'left' ? 'normal' : 'reverse',
          animationDuration: `${speed}s`
        }}
      >
        {displayItems.map((item, index) => (
          <div key={index} className="logo-wall-item">
            {typeof item === 'string' ? (
              <span className="logo-text">{item}</span>
            ) : (
              <div className="stat-item-inner">
                <div className="stat-value">{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Gradients to fade edges */}
      <div className="logo-wall-fade-left" />
      <div className="logo-wall-fade-right" />
    </div>
  );
};

export default LogoWall;
