'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiLock, FiUser, FiMail, FiX, FiZap, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuthentication } from '@/src/hooks/useAuthentication';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[#202229] py-2.5 pl-10 pr-4 text-sm text-[#F2F3F5] placeholder:text-[#777D87] outline-none transition-colors focus:border-[rgba(200,138,67,0.6)] focus:ring-1 focus:ring-[rgba(200,138,67,0.4)]';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const auth = useAuthentication();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // MongoDB mode authenticates against real accounts, which are keyed by email, so the
  // identifier must be an email there. Only local mode accepts the demo username.
  // Registration is always email-based.
  const usesEmail = mode === 'register' || auth.mode === 'mongodb';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const result = await auth.register(identifier, password, displayName);
        if (result.ok) {
          router.push('/dashboard');
          return;
        }
        setError(result.error ?? 'Registration failed.');
        return;
      }
      const success = await auth.login(identifier, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError(auth.mode === 'mongodb' ? 'Invalid email or password' : 'Invalid username or password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'login' ? 'Sign in to start your session' : 'Create an account'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,17,20,0.7)] p-4 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-[420px] rounded-[20px] border border-[rgba(255,255,255,0.09)] bg-[#1C1E24] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#777D87] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F2F3F5]"
              aria-label="Close login"
            >
              <FiX size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[#202229]">
                <FiZap className="text-xl text-[#C88A43]" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-[#F2F3F5]">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-[#A6ABB5]">
                {mode === 'login' ? 'Sign in to start your focus session' : 'Set up your account to start focusing'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#777D87]" htmlFor="register-name">
                    Name
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777D87]" size={15} />
                    <input
                      id="register-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How should we call you?"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#777D87]" htmlFor="auth-identifier">
                  {usesEmail ? 'Email' : 'Username'}
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777D87]" size={15} />
                  <input
                    id="auth-identifier"
                    type={usesEmail ? 'email' : 'text'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={usesEmail ? 'you@example.com' : 'Enter your username'}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#777D87]" htmlFor="auth-password">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777D87]" size={15} />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    minLength={mode === 'register' ? 8 : undefined}
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777D87] transition-colors hover:text-[#F2F3F5]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[12px] border border-[rgba(217,122,114,0.3)] bg-[rgba(217,122,114,0.12)] px-3 py-2 text-xs text-[#D97A72]"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#C88A43] py-2.5 text-sm font-semibold text-[#101114] transition-colors hover:bg-[#D79A52] active:bg-[#B97936] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(200,138,67,0.45)] disabled:opacity-60"
              >
                {mode === 'login' ? 'Sign In' : 'Create Account'} <FiArrowRight size={14} />
              </button>
            </form>

            <button
              type="button"
              onClick={switchMode}
              className="mt-5 w-full text-center text-[13px] text-[#A6ABB5] transition-colors hover:text-[#F2F3F5]"
            >
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-semibold text-[#C88A43]">{mode === 'login' ? 'Create one' : 'Sign in'}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
