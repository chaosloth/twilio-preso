import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface RegisterProps {
  /** The session being joined. Registration is session-scoped: the backend
   *  rejects anything that is not a live session. */
  sessionId: string;
  onRegistered: (participantId: string, name: string) => void;
}

type Step = 'phone' | 'otp' | 'name';
/** How the code arrives. WhatsApp is the default — it is the channel the talk is
 *  about, and the one the profile's WhatsApp identity is built from. */
type Channel = 'whatsapp' | 'sms';

export function Register({ sessionId, onRegistered }: RegisterProps) {
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+61');
  const [localNumber, setLocalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  /** What the backend actually sent on. WhatsApp falls back to SMS when the
   *  Verify service cannot deliver on it, and the screen has to say so or the
   *  attendee waits for a message in the wrong app. */
  const [sentOn, setSentOn] = useState<Channel>('whatsapp');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fullPhone = countryCode + localNumber.replace(/^0/, '');
    setPhone(fullPhone);

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, channel }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid phone number');
      }

      const body = await res.json().catch(() => ({}));
      setSentOn(body.channel === 'sms' ? 'sms' : 'whatsapp');
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
        body: JSON.stringify({ sessionId, name, phone, company }),
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
          <p className="text-accent-2 mt-2">Wonder — Twilio Live Demo</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white focus:outline-none focus:border-twilio-red text-lg"
              >
                <option value="+61">+61</option>
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+65">+65</option>
                <option value="+91">+91</option>
                <option value="+64">+64</option>
                <option value="+81">+81</option>
                <option value="+82">+82</option>
                <option value="+86">+86</option>
                <option value="+852">+852</option>
              </select>
              <input
                type="tel"
                placeholder="Mobile number"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d]/g, ''))}
                required
                autoFocus
                autoComplete="tel-national"
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red text-lg"
              />
            </div>
            {/* Two channels, one tap apart. WhatsApp is preselected; SMS is
                there because not everyone in the room uses WhatsApp. */}
            <div className="flex gap-2">
              {(['whatsapp', 'sms'] as Channel[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setChannel(option)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                    channel === option
                      ? 'bg-twilio-red text-white border-twilio-red'
                      : 'bg-white/5 text-accent-2 border-accent-3/30'
                  }`}
                >
                  {option === 'whatsapp' ? 'Code on WhatsApp' : 'Code by SMS'}
                </button>
              ))}
            </div>
            {error && <p className="text-twilio-red text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-twilio-red text-white font-bold text-lg disabled:opacity-50">
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-accent-2 text-sm text-center">
              We sent a code to {phone} {sentOn === 'whatsapp' ? 'on WhatsApp' : 'by SMS'}
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              autoFocus
              maxLength={6}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red text-center text-2xl tracking-widest"
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
              autoComplete="name"
              name="name"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red"
            />
            <input
              type="text"
              placeholder="Company (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-accent-3/30 text-white placeholder-accent-2 focus:outline-none focus:border-twilio-red"
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
