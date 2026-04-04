import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function TopHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="top-header">
      <div className="top-header-left" />
      <div className="top-header-right">
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </header>
  );
}
