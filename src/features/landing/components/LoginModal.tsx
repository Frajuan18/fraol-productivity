'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiZap, FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight, FiX } from 'react-icons/fi';
import { useAuthentication } from '@/src/hooks/useAuthentication';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const auth = useAuthentication();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const success = await auth.login(username, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Login to start your session"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-overlay backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-surface/95 backdrop-blur-xl rounded-2xl border border-border p-8 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-text-muted hover:text-text-secondary transition-colors"
              aria-label="Close login modal"
            >
              <FiX size={18} />
            </button>

            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center border border-border-hover">
                <FiZap className="text-text-secondary text-xl" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-text text-center mb-1">Welcome Back</h2>
            <p className="text-text-muted text-xs text-center mb-6">Sign in to start your focus session</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5" htmlFor="login-username">
                  Username
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:border-border-hover focus:ring-1 focus:ring-border-hover outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:border-border-hover focus:ring-1 focus:ring-border-hover outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-danger-muted border border-danger-muted text-danger px-3 py-2 rounded-xl text-xs"
                >
                  <span>{loginError}</span>
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-surface-hover hover:bg-surface-hover text-text font-medium rounded-xl transition-all flex items-center justify-center gap-2 border border-border-hover text-sm"
              >
                Sign In <FiArrowRight size={14} />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
