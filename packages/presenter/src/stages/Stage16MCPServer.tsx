import { FloatingText, ParticleField } from '../objects';
import { Html } from '@react-three/drei';
import { useIsStageActive } from '../components/Stage';

const config = `# Claude Code
claude mcp add --transport http \\
  twilio-docs https://mcp.twilio.com/docs

# Then just ask your agent:
"How do I send an SMS with Twilio?"
  → twilio__search   (ranked endpoints)
  → twilio__retrieve (exact schemas)`;

export default function Stage16MCPServer() {
  const active = useIsStageActive();

  return (
    <group>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        Twilio MCP Server
      </FloatingText>

      {/* Left side text */}
      {active && <Html transform position={[-3.2, 0.5, 0]}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", width: 160, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 7.5, color: '#ffffff', lineHeight: 1.5, fontWeight: 500 }}>
            Your AI coding agent, wired into Twilio's entire API surface
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              '1,800+ endpoints across 30+ products',
              'Search-then-retrieve: exact schemas on demand',
              'No auth, no install — hosted by Twilio',
              'Works in Claude, Cursor, Codex & more',
              'Always current — live OpenAPI specs',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 7, color: '#ef223a', fontWeight: 700 }}>•</span>
                <span style={{ fontSize: 7, color: '#babecc', fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Html>}

      {/* Right side config block */}
      {active && <Html center transform position={[2.5, 0, 0]}>
        <div style={{
          background: '#000d25',
          border: '2px solid rgba(239, 34, 58, 0.4)',
          borderRadius: 10,
          padding: '10px 12px',
          width: 220,
          boxShadow: '0 0 20px rgba(239, 34, 58, 0.2)',
        }}>
          <pre style={{
            margin: 0,
            fontSize: 5.5,
            lineHeight: 1.6,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            color: '#babecc',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {config.split('\n').map((line, i) => {
              if (line.startsWith('#')) {
                return <span key={i} style={{ color: '#4d5777' }}>{line}{'\n'}</span>;
              }
              if (line.trimStart().startsWith('→')) {
                return <span key={i} style={{ color: '#ef223a' }}>{line}{'\n'}</span>;
              }
              return <span key={i}>{line}{'\n'}</span>;
            })}
          </pre>
        </div>
      </Html>}

      <ParticleField count={100} spread={12} color="#ef223a" speed={0.05} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={0.8} distance={8} />
    </group>
  );
}
