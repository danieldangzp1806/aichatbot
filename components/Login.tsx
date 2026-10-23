import React, { useState } from 'react';
import { signInWithEmailAndPassword, auth } from '../services/firebase';
import { Logo } from './Logo';
import { ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess?: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth) {
      // If Firebase is not configured, fall back to guest session
      onLoginSuccess?.({ uid: 'zp-guest', email: email || 'ddduy@zuelligpharma.com' });
      setLoading(false);
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred?.user) {
        onLoginSuccess?.(cred.user);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Failed to sign in.";
      if (err.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (err.code === 'auth/too-many-requests') msg = "Too many attempts. Try again later.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-z-light-green overflow-hidden animate-fade-in-up">
        
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 transform hover:scale-105 transition-transform duration-300">
               <Logo className="w-20 h-20 drop-shadow-md" />
            </div>
            <h1 className="text-2xl font-bold text-z-deep-teal">
              Meet <span className="bg-clip-text text-transparent bg-gradient-to-r from-z-deep-teal to-z-green">RxBOT</span>!
            </h1>
            <p className="text-slate-500 text-sm mt-1">Your AI companion for decoding medicine data</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-z-green transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-z-green focus:ring-1 focus:ring-z-green transition-all bg-z-ivory/50"
                  placeholder="Email address"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-z-green transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-z-green focus:ring-1 focus:ring-z-green transition-all bg-z-ivory/50"
                  placeholder="Password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-z-deep-teal hover:bg-z-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-z-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-medium">Or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={() => onLoginSuccess?.({ uid: 'zp-guest-analyst', email: 'ddduy@zuelligpharma.com' })}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-z-light-green hover:border-z-green rounded-xl text-xs font-semibold text-z-deep-teal hover:bg-z-ivory transition-all shadow-2xs"
            >
              Instant Access (Zuellig Pharma Analyst)
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Authorized ZP personnel only. Contact <a href="mailto:ddduy@zuelligpharma.com" className="text-z-green hover:underline">administrator</a> for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;