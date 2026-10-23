import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Pill, Activity, Box, FileText, Stethoscope, ChevronRight, 
  AlertCircle, Sparkles, Lightbulb, Building2, ArrowLeft, X, LogOut, 
  Clock, Send, Bot, User as UserIcon, ToggleLeft, ToggleRight, 
  RotateCw, Globe, Dna, ShieldCheck, Check
} from 'lucide-react';
import { SearchState, User, Message } from './types';
import { analyzeMedicine, createChatSession } from './services/geminiService';
import { auth, onAuthStateChanged, signOut, saveSearchToHistory, getSearchHistory } from './services/firebase';
import ThinkingIndicator from './components/ThinkingIndicator';
import DetailRenderer from './components/ChatMessage';
import { Logo } from './components/Logo';
import Login from './components/Login';
import { GenerateContentResponse, Chat } from "@google/genai";

const MARKETS = [
  { id: 'Global', label: 'Global / WHO' },
  { id: 'Taiwan', label: 'Taiwan (TFDA)' },
  { id: 'Singapore', label: 'Singapore (HSA)' },
  { id: 'Malaysia', label: 'Malaysia (NPRA)' },
  { id: 'Philippines', label: 'Philippines (FDA)' },
  { id: 'Vietnam', label: 'Vietnam (DAV)' },
  { id: 'Thailand', label: 'Thailand (FDA)' },
  { id: 'Hong Kong', label: 'Hong Kong (DH)' },
  { id: 'Indonesia', label: 'Indonesia (BPOM)' },
];

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State - Dashboard
  const [state, setState] = useState<SearchState>({
    isLoading: false,
    hasSearched: false,
    query: '',
    market: 'Global',
  });

  const [selectedMarket, setSelectedMarket] = useState<string>('Global');

  // App State - Intelligent Mode (Chat)
  const [isIntelligentMode, setIsIntelligentMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      clearTimeout(timer);
      if (currentUser) {
        setChatMessages([]);
        chatSessionRef.current = null;
        setIsIntelligentMode(false);
        setState({
          isLoading: false,
          hasSearched: false,
          query: '',
          market: 'Global',
        });
        
        getSearchHistory(currentUser.uid).then(history => {
          setRecentSearches(history);
        }).catch(() => {});
      }

      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Initialize Chat Session when Intelligent Mode is enabled
  useEffect(() => {
    if (isIntelligentMode && !chatSessionRef.current) {
      try {
        chatSessionRef.current = createChatSession();
        setChatMessages([{
          id: 'welcome',
          role: 'model',
          text: 'Hello! I am RxBOT, upgraded with Gemini 3.8 Flash and deterministic pharmaceutical grounding. I can help you verify ATC codes, active ingredients (INN), pack sizes, authorized formulations, and Marketing Authorization Holders using real-time search data. How can I assist your master data validation today?',
          timestamp: Date.now()
        }]);
      } catch (e) {
        console.error("Failed to create chat session", e);
      }
    }
  }, [isIntelligentMode]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (isIntelligentMode) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isIntelligentMode, isChatLoading]);

  // Focus the input when the search overlay opens
  useEffect(() => {
    if (isSearchFocused && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchFocused]);

  // Handle Escape key to close search overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSearchFocused(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const performSearch = async (queryText: string, marketContext = selectedMarket, forceRefresh = false) => {
    if (!queryText.trim() || state.isLoading) return;

    setIsSearchFocused(false);
    setState(prev => ({ 
      ...prev, 
      query: queryText, 
      market: marketContext,
      isLoading: true, 
      error: undefined, 
      hasSearched: true 
    }));

    // Update History locally and in DB
    if (user) {
      saveSearchToHistory(user.uid, queryText);
      setRecentSearches(prev => {
        const newHistory = [queryText, ...prev.filter(t => t !== queryText)].slice(0, 10);
        return newHistory;
      });
    }

    try {
      const result = await analyzeMedicine(queryText, marketContext, forceRefresh);
      setState(prev => ({ ...prev, isLoading: false, result, market: marketContext }));
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || "Failed to retrieve grounded information. Please try again." 
      }));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(state.query, selectedMarket);
  };

  const clearSearch = () => {
    setState({
      isLoading: false,
      hasSearched: false,
      query: '',
      market: selectedMarket,
      result: undefined
    });
    setIsSearchFocused(false);
  };

  const goHome = () => {
    setIsIntelligentMode(false);
    clearSearch();
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !chatSessionRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await chatSessionRef.current.sendMessage({ message: userMessage.text });
      const botResponse = response as GenerateContentResponse;
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: botResponse.text || "I couldn't generate a response. Please try again.",
        groundingMetadata: botResponse.candidates?.[0]?.groundingMetadata as any,
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I encountered an error connecting to the Gemini 3.8 Flash service. Please try again.",
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleIntelligentMode = () => {
    setIsIntelligentMode(prev => !prev);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-z-sky via-z-pale-green to-z-light-green">
        <div className="flex flex-col items-center gap-4">
          <Logo className="w-16 h-16 animate-pulse" />
          <div className="w-8 h-8 border-4 border-z-deep-teal border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-z-light-green sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            <div className="flex items-center gap-4">
              <div 
                onClick={goHome}
                className="flex items-center gap-3 cursor-pointer group"
                title="Go to Home"
              >
                <div className="flex-shrink-0 flex items-center gap-3">
                  <Logo className="w-10 h-10 drop-shadow-sm group-hover:scale-105 transition-transform" />
                  <div className="hidden sm:block">
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-z-deep-teal to-z-green tracking-tight">RxBOT</span>
                  </div>
                </div>
              </div>

              {/* Intelligent Mode Toggle */}
              <div className="p-[2px] rounded-full bg-gradient-to-r from-z-deep-teal via-z-green to-z-sky bg-size-200 animate-gradient-x shadow-sm ml-2">
                <button 
                  onClick={toggleIntelligentMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${isIntelligentMode ? 'bg-z-deep-teal text-white' : 'bg-white text-slate-600 hover:text-z-deep-teal'}`}
                >
                  <Sparkles size={16} className={isIntelligentMode ? 'animate-pulse text-z-sky' : ''} />
                  <span className="text-sm font-medium">Chat Assistant</span>
                  {isIntelligentMode ? <ToggleRight size={22} className="ml-1 text-white" /> : <ToggleLeft size={22} className="ml-1 text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Navbar Search Trigger - Only in Dashboard Mode when searched */}
              {state.hasSearched && !isIntelligentMode && (
                <div className="hidden md:flex flex-1 max-w-md mr-2 items-center gap-2">
                  <div className="w-full relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-z-green transition-colors" size={16} />
                    <input
                      type="text"
                      value={state.query}
                      readOnly
                      onClick={() => setIsSearchFocused(true)}
                      onFocus={() => setIsSearchFocused(true)}
                      className="w-full pl-9 pr-4 py-2 bg-z-light-green/40 border border-transparent hover:border-z-green rounded-full text-sm cursor-text hover:bg-white transition-all focus:outline-none text-z-deep-teal placeholder:text-slate-400 font-medium"
                      placeholder="Search another medicine..."
                    />
                  </div>
                </div>
              )}
              
              {/* User Profile / Logout */}
              <div className="flex items-center gap-3 pl-4 border-l border-z-light-green">
                <div className="text-xs text-right hidden sm:block">
                  <div className="text-slate-500">Logged in as</div>
                  <div className="font-semibold text-z-deep-teal truncate max-w-[160px]">{user.email}</div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* INTELLIGENT MODE (CHAT) VIEW */}
      {isIntelligentMode ? (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full h-[calc(100vh-64px)]">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 scrollbar-hide">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] sm:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-z-deep-teal text-white' : 'bg-white border border-z-light-green'}`}>
                    {msg.role === 'user' ? <UserIcon size={16} /> : <Logo className="w-5 h-5" />}
                  </div>

                  {/* Bubble */}
                  <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-z-deep-teal text-white rounded-tr-none' : 'bg-white border border-z-light-green rounded-tl-none'}`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="prose prose-sm prose-slate max-w-none">
                        <DetailRenderer message={msg} compact={true} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isChatLoading && (
              <div className="flex w-full justify-start">
                <div className="flex max-w-[75%] gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-z-light-green flex items-center justify-center flex-shrink-0 mt-1">
                    <Logo className="w-5 h-5" />
                  </div>
                  <div className="bg-white border border-z-light-green p-4 rounded-2xl rounded-tl-none shadow-sm">
                    <ThinkingIndicator />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white/70 backdrop-blur-md border-t border-z-light-green">
            <form onSubmit={handleChatSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask RxBOT anything (e.g. 'What is the WHO ATC code for Cabozantinib?' or 'Compare Panadol 500mg pack sizes in Taiwan vs Singapore')"
                className="flex-1 bg-white border border-z-light-green rounded-xl px-4 py-3 focus:outline-none focus:border-z-green focus:ring-1 focus:ring-z-green shadow-sm text-z-deep-teal placeholder:text-slate-400"
                disabled={isChatLoading}
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="p-3 bg-z-deep-teal hover:bg-z-green text-white rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* DASHBOARD MODE VIEW */
        <>
          {/* Focus Mode Search Overlay */}
          {isSearchFocused && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 animate-fade-in">
              <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all duration-300"
                onClick={() => setIsSearchFocused(false)}
              ></div>

              <div className="relative w-full max-w-3xl z-10 animate-scale-in">
                <button 
                  onClick={() => setIsSearchFocused(false)}
                  className="absolute -top-12 right-0 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={24} />
                  <span className="sr-only">Close</span>
                </button>
                
                <div className="bg-white rounded-2xl shadow-2xl border border-z-pale-green p-4">
                  {/* Market selector in overlay */}
                  <div className="flex items-center gap-2 mb-3 px-2 overflow-x-auto pb-1 scrollbar-hide">
                    <Globe size={14} className="text-z-green flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Target Jurisdiction:</span>
                    {MARKETS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMarket(m.id)}
                        className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                          selectedMarket === m.id
                            ? 'bg-z-deep-teal text-white shadow-xs'
                            : 'bg-z-light-green/50 text-slate-600 hover:bg-z-pale-green'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSearch} className="relative flex items-center bg-z-ivory rounded-xl border border-z-light-green p-2">
                    <Search className="ml-3 text-z-green" size={22} />
                    <input 
                      ref={searchInputRef}
                      type="text"
                      value={state.query}
                      onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                      placeholder="Enter brand name, strength or INN (e.g., Cabometyx 60mg)..."
                      className="w-full px-4 py-3 text-lg outline-none text-z-deep-teal placeholder:text-slate-400 font-medium bg-transparent"
                    />
                    <button 
                      type="submit"
                      disabled={!state.query.trim()}
                      className="bg-z-deep-teal hover:bg-z-green text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      Search <ChevronRight size={18} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
            
            {/* Initial Search State (Hero) */}
            {!state.hasSearched && (
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-130px)] py-4 text-center px-4 animate-fade-in-up">
                <div className="mb-2 hover:scale-105 transition-transform duration-300">
                  <Logo className="w-16 h-16 drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-z-deep-teal to-z-green tracking-tight mb-2">
                  RxBOT
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl mb-4 leading-relaxed">
                  Get ATC codes, pack sizes, forms and dosage information powered by real-time Google Search data.
                </p>
                
                <div className="w-full max-w-3xl my-1">
                  {/* Market Selector Chips */}
                  <div className="mb-2.5 flex items-center justify-center flex-wrap gap-1.5 px-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-z-deep-teal mr-2">
                      <Globe size={14} className="text-z-green" />
                      <span>Market:</span>
                    </div>
                    {MARKETS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMarket(m.id)}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                          selectedMarket === m.id
                            ? 'bg-z-deep-teal text-white shadow-sm ring-2 ring-z-green/40'
                            : 'bg-transparent text-slate-700 hover:bg-white/30 hover:text-z-deep-teal border border-z-deep-teal/20'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSearch} className="relative group w-full mt-12 sm:mt-14">
                    <div className="rainbow-glow group-hover:opacity-85 transition-opacity duration-300"></div>
                    <div className="rainbow-border-wrapper shadow-xl">
                      <div className="relative flex items-center bg-white rounded-[14px] p-2 z-10 w-full">
                        <Search className="ml-4 text-slate-400 group-hover:text-z-green transition-colors" size={24} />
                        <input 
                          type="text"
                          value={state.query}
                          onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                          placeholder="Enter medicine brand (e.g. Cabometyx, Augmentin, Januvia, Lipitor)..."
                          className="w-full px-4 py-4 text-lg outline-none text-z-deep-teal placeholder:text-slate-400 bg-transparent focus-animate-placeholder"
                          autoFocus
                        />
                        <button 
                          type="submit"
                          disabled={!state.query.trim()}
                          className="bg-z-deep-teal hover:bg-z-green text-white px-8 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                        >
                          Search <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="mt-3.5 w-full overflow-x-auto flex-nowrap scrollbar-hide">
                      <div className="flex justify-center items-center gap-2 min-w-max px-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <Clock size={12} />
                          <span>Recent:</span>
                        </div>
                        {recentSearches.map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => performSearch(term, selectedMarket)}
                            className="px-3.5 py-1 bg-transparent hover:bg-white/30 border border-z-deep-teal/20 rounded-full text-xs font-medium text-z-deep-teal transition-all whitespace-nowrap"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-8 flex flex-col items-center gap-4 w-full">
                  {/* Powered By Badge */}
                  <div className="flex items-center gap-2 text-xs text-z-deep-teal/80 bg-transparent px-4 py-1.5 rounded-full">
                    <Sparkles size={13} className="text-z-green" />
                    <span className="font-medium">Powered by Gemini 3.8 Flash</span>
                  </div>
                  
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 max-w-2xl bg-transparent p-4 rounded-xl text-left">
                    <Lightbulb size={18} className="text-z-green mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-1">
                      <p><span className="font-bold text-z-deep-teal">How Grounding Consistency Works:</span> RxBOT resolves the canonical <strong>INN (Active Ingredient)</strong> and <strong>WHO 5-level ATC code</strong> first, eliminating brand variance. Select your <strong>Target Market</strong> chip above to lock packaging SKUs and regulatory licenses to that specific country.</p>
                      <p className="text-slate-500">Repeated searches in the same session return instant deterministic results, with an on-demand re-verification toggle.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {state.isLoading && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-pulse">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-z-pale-green border-t-z-deep-teal rounded-full animate-spin"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Pill size={24} className="text-z-deep-teal" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-z-deep-teal">Executing Grounded Search Verification</h3>
                  <p className="text-slate-600 mt-1 text-sm">
                    Connecting to official compendia & Google Search for <span className="font-semibold text-z-deep-teal">"{state.query}"</span>
                    {selectedMarket !== 'Global' ? ` in ${selectedMarket}` : ''}...
                  </p>
                </div>
                <ThinkingIndicator />
              </div>
            )}

            {/* Error State */}
            {state.error && !state.isLoading && (
              <div className="max-w-3xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4 shadow-sm">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
                <div>
                  <h3 className="text-lg font-bold text-red-800">Verification Query Failed</h3>
                  <p className="text-red-700 mt-1 text-sm">{state.error}</p>
                  <div className="mt-4 flex gap-3">
                    <button 
                      onClick={() => performSearch(state.query, selectedMarket, true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Retry Search
                    </button>
                    <button 
                      onClick={clearSearch}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      New Search
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Results Dashboard */}
            {state.result && !state.isLoading && state.result.summary && (
              <div>
                {/* Search Header Bar with Market Context & Re-verify Action */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-z-light-green shadow-2xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={goHome}
                      className="p-2 hover:bg-z-light-green/40 text-z-deep-teal rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <div className="h-5 w-px bg-slate-200"></div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Verified Master Record</div>
                      <div className="text-base font-bold text-z-deep-teal flex items-center gap-2">
                        <span>{state.result.summary.name}</span>
                        {state.result.fromCache && (
                          <span className="text-[11px] font-medium bg-z-light-green text-z-deep-teal px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check size={11} /> Consistent (Session Verified)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Market Switcher */}
                    <div className="flex items-center gap-1 bg-z-ivory border border-z-pale-green rounded-xl px-3 py-1.5 text-xs">
                      <Globe size={13} className="text-z-green" />
                      <span className="text-slate-500 font-medium mr-1">Market:</span>
                      <select 
                        value={selectedMarket}
                        onChange={(e) => {
                          const newMarket = e.target.value;
                          setSelectedMarket(newMarket);
                          performSearch(state.query, newMarket, false);
                        }}
                        className="bg-transparent font-bold text-z-deep-teal outline-none cursor-pointer"
                      >
                        {MARKETS.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Force Re-verify Button */}
                    <button
                      onClick={() => performSearch(state.query, selectedMarket, true)}
                      title="Run a live Google Search grounding pass"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-z-ivory border border-z-light-green hover:border-z-green text-z-deep-teal rounded-xl text-xs font-semibold shadow-2xs transition-all"
                    >
                      <RotateCw size={13} className="text-z-green" />
                      <span>Re-verify Live</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up pb-12">
                  
                  {/* Left Frame: Master Information (The Master Record Ticket) */}
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-z-light-green overflow-hidden relative sticky top-24">
                      
                      <div className="p-6 sm:p-7">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-z-green uppercase tracking-wider">
                            Standardized Product Data
                          </span>
                          <span className="text-[10px] font-mono bg-z-sky/30 text-z-deep-teal px-2 py-0.5 rounded font-semibold">
                            {state.result.summary.market || selectedMarket}
                          </span>
                        </div>
                        
                        <h2 className="text-2xl font-bold text-z-deep-teal mb-4 leading-tight">
                          {state.result.summary.name}
                        </h2>

                        <div className="space-y-6">
                          {/* Active Ingredient (INN) */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                              <Dna size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Active Ingredient (INN)</div>
                              <div className="text-base font-semibold text-purple-950 mt-0.5 leading-snug break-words">
                                {state.result.summary.genericName || "Refer to report"}
                              </div>
                            </div>
                          </div>

                          {/* ATC Code */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-z-light-green/60 text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-pale-green transition-colors">
                              <Activity size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">WHO ATC Code</div>
                              <div className="text-lg font-mono font-bold text-z-deep-teal mt-0.5 tracking-wide">
                                {state.result.summary.atcCode}
                              </div>
                            </div>
                          </div>

                          {/* Pharma Company (MAH) */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-z-sky/25 text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-sky/40 transition-colors">
                              <Building2 size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Marketing Auth Holder (MAH)</div>
                              <div className="text-sm font-medium text-slate-900 mt-0.5 leading-snug">
                                {state.result.summary.manufacturer}
                              </div>
                            </div>
                          </div>

                          {/* Pack Size */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                              <Box size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Standard Pack Size</div>
                              <div className="text-sm font-medium text-slate-900 mt-0.5">
                                {state.result.summary.packSize}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 italic">
                                See SKU catalog in report for other sizes
                              </div>
                            </div>
                          </div>

                          {/* Form */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-z-light-green text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-green/20 transition-colors">
                              <Pill size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Dosage Form</div>
                              <div className="text-sm font-medium text-slate-900 mt-0.5">
                                {state.result.summary.form}
                              </div>
                            </div>
                          </div>

                          {/* Dosage */}
                          <div className="flex items-start gap-3.5 group p-2.5 rounded-xl hover:bg-z-ivory/80 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                              <Stethoscope size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Standard Dosage Regimen</div>
                              <div className="text-sm font-medium text-slate-900 mt-0.5 leading-snug">
                                {state.result.summary.dosage}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer of card */}
                      <div className="bg-z-ivory px-6 py-4 border-t border-z-light-green flex justify-between items-center text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-z-green" />
                          Gemini 3.8 Flash Grounded
                        </span>
                        <div className="h-2 w-2 rounded-full bg-z-green animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Right Frame: Detailed Information & Grounding Trail */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-z-light-green h-full flex flex-col min-h-[600px]">
                      <div className="px-6 sm:px-8 py-5 border-b border-z-light-green flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="text-z-green" size={20} />
                          <div>
                            <h3 className="font-bold text-z-deep-teal text-lg">Supporting Analytical Report</h3>
                            <p className="text-xs text-slate-400">Master data verification, 5-level WHO ATC hierarchy, and SKU packaging matrix</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 sm:p-8 md:p-10 flex-1 overflow-y-auto max-h-[1050px]">
                        <DetailRenderer 
                          message={{
                            id: 'result',
                            role: 'model',
                            text: state.result.details,
                            groundingMetadata: state.result.groundingMetadata,
                            timestamp: Date.now()
                          }} 
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
};

export default App;
