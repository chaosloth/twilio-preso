import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';
import { useSlots } from '../hooks/useSlots';

const code = `const tac = await TAC.create({ config: TACConfig.fromEnv() });
const voiceChannel = new VoiceChannel(tac);
const smsChannel = new SMSChannel(tac);
tac.registerChannel(voiceChannel);
tac.registerChannel(smsChannel);

tac.onMessageReady(async ({ message, memory }) => {
  const response = await yourLLM(message, memory);
  return response;
});

// TACServer registers webhook and WebSocket routes
const server = new TACServer(tac);
await server.start();`;

export default function Stage15AgentConnect() {
  const slot = useSlots();
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        {slot('headline')}
      </FloatingText>

      {/* Left side text */}
      {active && <Html transform position={[-3.2, 0.5, 0]}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", width: 160, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 7.5, color: '#ffffff', lineHeight: 1.5, fontWeight: 500 }}>
            SDK middleware connecting your AI agents to Twilio's platform
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Bring your own LLM',
              'AWS, Azure, or self-hosted',
              'Voice, SMS, and messaging built-in',
              'Integrated with Memory and Orchestrator',
              'Real-time context enrichment',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 7, color: '#ef223a', fontWeight: 700 }}>•</span>
                <span style={{ fontSize: 7, color: '#babecc', fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Html>}

      {/* Right side code block */}
      {active && <Html center transform position={[2.5, 0, 0]}>
        <div style={{
          background: '#0a1535',
          border: '1px solid rgba(239, 34, 58, 0.3)',
          borderRadius: 8,
          padding: '10px 12px',
          width: 220,
          boxShadow: '0 0 20px rgba(239, 34, 58, 0.1)',
        }}>
          <pre style={{
            margin: 0,
            fontSize: 5.5,
            lineHeight: 1.5,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            color: '#babecc',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {code.split('\n').map((line, i) => (
              <span key={i}>
                {line.split(/(\b(?:const|await|new|async|return)\b|\/\/.*$)/gm).map((part, j) => {
                  if (/^\b(const|await|new|async|return)\b$/.test(part)) {
                    return <span key={j} style={{ color: '#ef223a' }}>{part}</span>;
                  }
                  if (part && part.startsWith('//')) {
                    return <span key={j} style={{ color: '#4d5777' }}>{part}</span>;
                  }
                  return <span key={j}>{part}</span>;
                })}
                {'\n'}
              </span>
            ))}
          </pre>
        </div>
      </Html>}

      <ParticleField count={100} spread={12} color="#ef223a" speed={0.05} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
