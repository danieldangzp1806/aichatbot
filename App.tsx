
import React, { useState, useEffect, useRef } from 'react';
import { Search, Pill, Activity, Box, FileText, Stethoscope, ChevronRight, AlertCircle, Sparkles, Lightbulb, Building2, ArrowLeft, X, LogOut, Clock, Send, Bot, User as UserIcon, ToggleLeft, ToggleRight, MessageSquare } from 'lucide-react';
import { SearchState, User, Message } from './types';
import { analyzeMedicine, createChatSession } from './services/geminiService';
import { auth, onAuthStateChanged, signOut, saveSearchToHistory, getSearchHistory } from './services/firebase';
import ThinkingIndicator from './components/ThinkingIndicator';
import DetailRenderer from './components/ChatMessage';
import { Logo } from './components/Logo';
import Login from './components/Login';
import { GenerateContentResponse, Chat } from "@google/genai";

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State - Dashboard
  const [state, setState] = useState<SearchState>({
    isLoading: false,
    hasSearched: false,
    query: '',
  });

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      // If a user is detected (Login or Initial Load), reset app state to ensure clean slate
      if (currentUser) {
         setChatMessages([]);
         chatSessionRef.current = null;
         setIsIntelligentMode(false);
         setState({
            isLoading: false,
            hasSearched: false,
            query: '',
         });
         
         // Load history
         getSearchHistory(currentUser.uid).then(history => {
           setRecentSearches(history);
         });
      }

      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Chat Session when Intelligent Mode is enabled
  useEffect(() => {
    if (isIntelligentMode && !chatSessionRef.current) {
      try {
        chatSessionRef.current = createChatSession();
        // Add welcome message
        setChatMessages([{
          id: 'welcome',
          role: 'model',
          text: 'Hello! I am RxBOT. I can help you find ATC codes, pack sizes, dosages, or answer any pharmaceutical questions using real-time search data. How can I help you today?',
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

  const performSearch = async (queryText: string) => {
    if (!queryText.trim() || state.isLoading) return;

    setIsSearchFocused(false);
    setState(prev => ({ ...prev, query: queryText, isLoading: true, error: undefined, hasSearched: true }));

    // Update History locally and in DB
    if (user) {
      saveSearchToHistory(user.uid, queryText);
      setRecentSearches(prev => {
        // Add new query to top, remove duplicates, limit to 10
        const newHistory = [queryText, ...prev.filter(t => t !== queryText)].slice(0, 10);
        return newHistory;
      });
    }

    try {
      const result = await analyzeMedicine(queryText);
      setState(prev => ({ ...prev, isLoading: false, result }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to retrieve information. Please try again." 
      }));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(state.query);
  };

  const clearSearch = () => {
    setState({
      isLoading: false,
      hasSearched: false,
      query: '',
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
        text: "I encountered an error connecting to the service. Please try again.",
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleIntelligentMode = () => {
    setIsIntelligentMode(!isIntelligentMode);
  };

  // ----------------------------------------------------------------------
  // RENDER LOGIC
  // ----------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-z-ivory">
        <div className="w-10 h-10 border-4 border-z-pale-green border-t-z-deep-teal rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not authenticated, show Login Screen
  if (!user) {
    return <Login />;
  }

  // Authenticated Application
  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans selection:bg-z-sky selection:text-z-deep-teal flex flex-col">
      
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-z-light-green sticky top-0 z-30 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              {/* Back Button - Visible when searched OR in intelligent mode */}
              {(state.hasSearched || isIntelligentMode) && (
                <button 
                  onClick={goHome}
                  className="group flex items-center gap-2 text-slate-500 hover:text-z-deep-teal transition-colors pr-4 border-r border-z-light-green"
                >
                  <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium">Home</span>
                </button>
              )}

              {/* Logo */}
              <div className="flex items-center cursor-pointer" onClick={goHome}>
                <div className="flex-shrink-0 flex items-center gap-3">
                  <Logo className="w-10 h-10 drop-shadow-sm" />
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-z-deep-teal to-z-green tracking-tight hidden sm:block">RxBOT</span>
                </div>
              </div>

               {/* Intelligent Mode Toggle - Moved to Left */}
               <div className="p-[2px] rounded-full bg-gradient-to-r from-z-deep-teal via-z-green to-z-sky bg-size-200 animate-gradient-x shadow-sm ml-2">
                 <button 
                  onClick={toggleIntelligentMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${isIntelligentMode ? 'bg-z-deep-teal text-white' : 'bg-white text-slate-500 hover:text-z-deep-teal'}`}
                 >
                   <Sparkles size={16} className={isIntelligentMode ? 'animate-pulse text-z-sky' : ''} />
                   <span className="text-sm font-medium">Intelligent Mode</span>
                   {isIntelligentMode ? <ToggleRight size={24} className="ml-1 text-white" /> : <ToggleLeft size={24} className="ml-1 text-slate-400" />}
                 </button>
               </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Navbar Search Trigger - Only in Dashboard Mode */}
              {state.hasSearched && !isIntelligentMode && (
                <div className="hidden md:flex flex-1 max-w-sm mr-4 items-center">
                  <div className="w-full relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-z-green transition-colors" size={16} />
                    <input
                      type="text"
                      value={state.query}
                      readOnly
                      onClick={() => setIsSearchFocused(true)}
                      onFocus={() => setIsSearchFocused(true)}
                      className="w-full pl-9 pr-4 py-2 bg-z-light-green/30 border-none rounded-full text-sm cursor-text hover:bg-z-light-green/50 transition-all focus:outline-none text-z-deep-teal placeholder:text-slate-400"
                      placeholder="Search another medicine..."
                    />
                  </div>
                </div>
              )}
              
              {/* User Profile / Logout */}
              <div className="flex items-center gap-3 pl-4 border-l border-z-light-green">
                <div className="text-xs text-right hidden sm:block">
                  <div className="text-slate-500">Logged in as</div>
                  <div className="font-medium text-z-deep-teal truncate max-w-[150px]">{user.email}</div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={20} />
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
           <div className="p-4 bg-white/50 backdrop-blur-md border-t border-z-light-green">
              <form onSubmit={handleChatSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
                 <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask RxBOT anything (e.g. 'What is the standard dosage for Panadol?')"
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
        /* DASHBOARD MODE (EXISTING) VIEW */
        <>
          {/* Focus Mode Search Overlay */}
          {isSearchFocused && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4 animate-fade-in">
              {/* Backdrop Blur */}
              <div 
                className="absolute inset-0 bg-white/70 backdrop-blur-md transition-all duration-300"
                onClick={() => setIsSearchFocused(false)}
              ></div>

              {/* Centered Search Box */}
              <div className="relative w-full max-w-2xl z-10 animate-scale-in">
                <button 
                  onClick={() => setIsSearchFocused(false)}
                  className="absolute -top-12 right-0 text-slate-500 hover:text-z-deep-teal p-2 rounded-full hover:bg-white/50 transition-colors"
                >
                  <X size={24} />
                  <span className="sr-only">Close</span>
                </button>
                
                <form onSubmit={handleSearch} className="w-full relative group">
                  {/* Brand Gradient Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-tr from-z-sky via-z-pale-green to-z-light-green rounded-2xl blur opacity-60 group-hover:opacity-80 transition duration-200"></div>
                  <div className="relative flex items-center bg-white rounded-xl shadow-2xl overflow-hidden border border-z-pale-green p-2">
                    <Search className="ml-4 text-z-green" size={24} />
                    <input 
                      ref={searchInputRef}
                      type="text"
                      value={state.query}
                      onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                      placeholder="Enter medicine name..."
                      className="w-full px-4 py-4 text-xl outline-none text-z-deep-teal placeholder:text-slate-400 font-medium bg-transparent"
                    />
                    <button 
                      type="submit"
                      disabled={!state.query.trim()}
                      className="bg-z-deep-teal hover:bg-z-green text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                    >
                      Search <ChevronRight size={18} />
                    </button>
                  </div>
                </form>
                
                <div className="mt-4 text-center">
                  <p className="text-sm text-slate-500 font-medium">Press <kbd className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 mx-1">Enter</kbd> to search</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
            
            {/* Initial Search State (Hero) */}
            {!state.hasSearched && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in-up">
                <div className="mb-8 hover:scale-105 transition-transform duration-300">
                  <Logo className="w-28 h-28 drop-shadow-xl" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-z-deep-teal tracking-tight mb-4">
                  No more guesswork. Ask <span className="bg-clip-text text-transparent bg-gradient-to-r from-z-deep-teal to-z-green">RxBOT</span>!
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
                  Get ATC codes, pack sizes, forms, and dosage information powered by real-time Google Search data. 
                  Built for Zuellig Pharma personnels.
                </p>
                
                <div className="w-full max-w-2xl">
                  <form onSubmit={handleSearch} className="relative group w-full">
                    {/* Brand Gradient - The "One-Up" style 45 degree gradient */}
                    <div className="absolute -inset-1 bg-gradient-to-tr from-z-sky via-z-pale-green to-z-light-green rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-200"></div>
                    <div className="relative flex items-center bg-white rounded-xl shadow-xl overflow-hidden border border-z-light-green p-2">
                      <Search className="ml-4 text-slate-400" size={24} />
                      <input 
                        type="text"
                        value={state.query}
                        onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                        placeholder="Enter medicine name (e.g., Cabometyx 60mg)"
                        className="w-full px-4 py-4 text-lg outline-none text-z-deep-teal placeholder:text-slate-400 bg-transparent focus-animate-placeholder"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        disabled={!state.query.trim()}
                        className="bg-z-deep-teal hover:bg-z-green text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        Search <ChevronRight size={18} />
                      </button>
                    </div>
                  </form>

                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="mt-6 w-full overflow-x-auto flex-nowrap scrollbar-hide">
                      <div className="flex justify-center items-center gap-3 min-w-max px-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          <Clock size={12} />
                          <span>Recent</span>
                        </div>
                        {recentSearches.map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => performSearch(term)}
                            className="px-4 py-1.5 bg-white/60 hover:bg-white border border-z-light-green/80 hover:border-z-green rounded-full text-sm text-z-deep-teal transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col items-center gap-10">
                  {/* Powered By Badge - Minimized */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400/80 px-4 py-1">
                    <Sparkles size={12} className="text-slate-400/80" />
                    <span>Powered by Gemini 2.5 Flash Grounding</span>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm text-slate-600 max-w-2xl bg-z-sky/20 px-4 py-3 rounded-xl border border-z-sky/30 text-left">
                    <Lightbulb size={18} className="text-z-green mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-1.5">
                        <p><span className="font-semibold text-z-deep-teal">Pro Tip:</span> For correct pack sizes, please put the <strong>Country Name</strong> right after the medicine name for correct packaging info.</p>
                        <p>If a specific brand name doesn't return an ATC code, try searching by the <strong>Active Ingredient</strong> name.</p>
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
                  <h3 className="text-lg font-medium text-z-deep-teal">Analyzing Pharmaceutical Data</h3>
                  <p className="text-slate-500 mt-1">Searching global databases for "{state.query}"...</p>
                </div>
                <ThinkingIndicator />
              </div>
            )}

            {/* Error State */}
            {state.error && !state.isLoading && (
              <div className="max-w-3xl mx-auto mt-10 bg-red-50 border border-red-100 rounded-xl p-6 flex items-start gap-4 shadow-sm">
                <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
                <div>
                  <h3 className="text-lg font-bold text-red-800">Lookup Failed</h3>
                  <p className="text-red-700 mt-1">{state.error}</p>
                  <button 
                    onClick={handleSearch}
                    className="mt-4 text-sm font-medium text-red-700 hover:text-red-900 underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Results Dashboard */}
            {state.result && !state.isLoading && state.result.summary && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-fade-in-up pb-12">
                
                {/* Left Frame: Main Information (The "Ticket") */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-2xl shadow-sm border border-z-light-green overflow-hidden relative sticky top-24">
                    
                    <div className="p-8">
                      <h2 className="text-2xl font-bold text-z-deep-teal mb-1 leading-tight">
                        {state.result.summary.name}
                      </h2>
                      <div className="text-xs font-bold text-z-green uppercase tracking-wider mb-8">
                        Product Summary
                      </div>

                      <div className="space-y-8">
                        {/* ATC Code */}
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 rounded-xl bg-z-light-green/50 text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-pale-green transition-colors">
                            <Activity size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">ATC Code</div>
                            <div className="text-lg font-mono font-medium text-slate-900 mt-1">
                              {state.result.summary.atcCode}
                            </div>
                          </div>
                        </div>

                        {/* Pharma Company */}
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 rounded-xl bg-z-sky/20 text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-sky/40 transition-colors">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Pharma Company</div>
                            <div className="text-base font-medium text-slate-900 mt-1 leading-snug">
                              {state.result.summary.manufacturer}
                            </div>
                          </div>
                        </div>

                        {/* Pack Size */}
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 rounded-xl bg-z-ivory border border-z-pale-green text-z-green flex items-center justify-center flex-shrink-0 group-hover:border-z-green transition-colors">
                            <Box size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Pack Size</div>
                            <div className="text-base font-medium text-slate-900 mt-1">
                              {state.result.summary.packSize}
                            </div>
                          </div>
                        </div>

                        {/* Form */}
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 rounded-xl bg-z-light-green text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-green/20 transition-colors">
                            <Pill size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Form</div>
                            <div className="text-base font-medium text-slate-900 mt-1">
                              {state.result.summary.form}
                            </div>
                          </div>
                        </div>

                        {/* Dosage */}
                        <div className="flex items-start gap-4 group">
                          <div className="w-10 h-10 rounded-xl bg-z-sky/20 text-z-deep-teal flex items-center justify-center flex-shrink-0 group-hover:bg-z-sky/40 transition-colors">
                            <Stethoscope size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Standard Dosage</div>
                            <div className="text-base font-medium text-slate-900 mt-1">
                              {state.result.summary.dosage}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Footer of card */}
                    <div className="bg-z-ivory px-8 py-5 border-t border-z-light-green flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium">Powered by Gemini 2.5 Flash</span>
                      <div className="h-2 w-2 rounded-full bg-z-green"></div>
                    </div>
                  </div>
                </div>

                {/* Right Frame: Detailed Information */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-z-light-green h-full flex flex-col min-h-[600px]">
                    <div className="px-8 py-6 border-b border-z-light-green flex items-center gap-3">
                      <FileText className="text-z-green" size={20} />
                      <h3 className="font-bold text-z-deep-teal text-lg">Supporting Information</h3>
                    </div>
                    <div className="p-8 md:p-10 flex-1 overflow-y-auto max-h-[1000px]">
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
            )}
          </main>
        </>
      )}
    </div>
  );
};

export default App;
