import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface RegisterProps {
  onRegistered: (participantId: string, name: string) => void;
}

type Step = 'phone' | 'otp' | 'name';

export function Register({ onRegistered }: RegisterProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid phone number');
      }

      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid code');
      }

      setStep('name');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, company }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Registration failed');
      }

      const { participantId } = await res.json();
      onRegistered(participantId, name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join the Experience</h1>
          <p className="text-gray-400 mt-2">SIGNAL World Tour 2026</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <input
              type="tel"
              placeholder="Your mobile number (e.g. +61...)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red text-lg"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">We sent a code to {phone}</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              autoFocus
              maxLength={6}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red text-center text-2xl tracking-widest"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Checking...' : 'Verify'}
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="text-green-400 text-sm text-center mb-2">Phone verified!</p>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red"
            />
            <input
              type="text"
              placeholder="Company (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-twilio-red"
            />
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Joining...' : 'Join the Demo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
