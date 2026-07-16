import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

export default function ComboBox({ 
    options = [], 
    value = '', 
    onChange, 
    placeholder = 'Select...', 
    label = '',
    allowCustom = true,
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    const isLightMode = window.location.pathname.startsWith('/deploy');

    // Filter options based on search
    const filteredOptions = options.filter(opt => 
        (typeof opt === 'string' ? opt : opt.name)
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className={`space-y-1.5 relative ${className}`} ref={containerRef}>
            {label && (
                <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${
                    isLightMode ? 'text-[#8b5cf6]' : 'text-white/30'
                }`}>{label}</label>
            )}
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-5 py-4 rounded-xl flex justify-between items-center cursor-pointer transition-all border group ${
                    isLightMode 
                        ? 'bg-white border-[#ebe4ff] hover:border-[#c084fc]' 
                        : 'glass-panel border-white/5 bg-black/20 hover:border-white/10'
                }`}
            >
                <span className={`text-xs ${
                    value 
                        ? (isLightMode ? 'text-black' : 'text-white') 
                        : (isLightMode ? 'text-black/30' : 'text-white/20')
                }`}>
                    {value || placeholder}
                </span>
                <ChevronDown size={14} className={`transition-transform ${
                    isLightMode ? 'text-black/30' : 'text-white/20'
                } ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className={`absolute z-[60] left-0 right-0 mt-2 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isLightMode 
                        ? 'bg-white border border-[#ebe4ff] shadow-[0_20px_50px_rgba(139,92,246,0.1)]' 
                        : 'glass-panel border-white/10 bg-[#0A1225] shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
                }`}>
                    <div className={`p-3 relative ${
                        isLightMode ? 'border-b border-[#f1ebff]' : 'border-b border-white/5'
                    }`}>
                        <Search size={12} className={`absolute left-6 top-1/2 -translate-y-1/2 ${
                            isLightMode ? 'text-black/30' : 'text-white/20'
                        }`} />
                        <input 
                            autoFocus
                            placeholder="Search or type custom..."
                            className={`w-full rounded-lg pl-10 pr-4 py-2.5 text-xs outline-none border transition-all ${
                                isLightMode 
                                    ? 'bg-[#faf7ff] border-[#ebe4ff] text-black focus:border-[#c084fc]' 
                                    : 'bg-white/5 border-white/5 text-white focus:border-primary/40'
                            }`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => {
                                const val = typeof opt === 'string' ? opt : opt.name;
                                return (
                                    <div 
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(val);
                                        }}
                                        className={`px-4 py-3 text-xs cursor-pointer flex items-center justify-between group transition-colors ${
                                            isLightMode 
                                                ? 'text-black hover:bg-[#faf7ff] hover:text-[#8b5cf6]' 
                                                : 'text-white/70 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <span>{val}</span>
                                        {value === val && (
                                            <Check size={12} className={isLightMode ? 'text-[#8b5cf6]' : 'text-primary'} />
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <p className={`text-[10px] uppercase font-black tracking-widest ${
                                    isLightMode ? 'text-[#b6b6c7]' : 'text-white/20'
                                }`}>No results found</p>
                            </div>
                        )}

                        {allowCustom && search && !filteredOptions.includes(search) && (
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(search);
                                }}
                                className={`px-4 py-3 text-xs cursor-pointer flex items-center gap-2 transition-colors border-t ${
                                    isLightMode 
                                        ? 'bg-[#f5efff] text-[#8b5cf6] hover:bg-[#ece2ff] border-[#f1ebff]' 
                                        : 'bg-primary/5 text-primary hover:bg-primary/10 border-white/5'
                                }`}
                            >
                                <Plus size={12} />
                                <span>Add "<span className="font-bold">{search}</span>" as Custom</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

