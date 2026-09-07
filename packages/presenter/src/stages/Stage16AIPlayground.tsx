import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { FloatingText, ParticleField } from '../objects';
import { useIsStageActive } from '../components/Stage';
import { usePresenterStore } from '../store';
import { useSlots } from '../hooks/useSlots';

/** Chars revealed per tick while "typing" an answer onto the screen. */
const TYPE_CHARS_PER_TICK = 3;
const TYPE_TICK_MS = 16;

type Item =
  | { kind: 'pending'; id: string; name: string; prompt: string; timestamp: number }
  | { kind: 'answer'; id: string; name: string; prompt: string; response: string; timestamp: number };

/**
 * Reveals `text` a few characters at a time. Restarts whenever `id` changes, so
 * each new answer types itself out and older ones stay fully rendered.
 */
function useTypewriter(id: string | null, text: string): string {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (!id) return;
    setShown('');
    let n = 0;
    const timer = setInterval(() => {
      n = Math.min(n + TYPE_CHARS_PER_TICK, text.length);
      setShown(text.slice(0, n));
      if (n >= text.length) clearInterval(timer);
    }, TYPE_TICK_MS);
    return () => clearInterval(timer);
  }, [id, text]);

  return shown;
}

/**
 * Darkens everything behind the cards once an answer is up, so the room's
 * attention lands on the text rather than the particle field.
 */
function BackdropFade({ dim }: { dim: boolean }) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const material = ref.current?.material as MeshBasicMaterial | undefined;
    if (!material) return;
    const target = dim ? 0.82 : 0;
    material.opacity += (target - material.opacity) * Math.min(1, delta * 3.5);
  });

  return (
    <mesh ref={ref} position={[0, 0, -0.6]}>
      <planeGeometry args={[40, 24]} />
      <meshBasicMaterial color="#000d25" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function Stage16AIPlayground() {
  const slot = useSlots();
  const active = useIsStageActive();
  const aiPromptResponses = usePresenterStore((s) => s.aiPromptResponses);
  const pendingAiPrompts = usePresenterStore((s) => s.pendingAiPrompts);

  // Pending questions and answers share one feed, newest first. A person's
  // pending card is dropped from the store the moment their answer lands, so
  // the question appears to transform into the reply in place.
  const items: Item[] = [
    ...pendingAiPrompts.map((p) => ({
      kind: 'pending' as const,
      id: `${p.participantId}-pending`,
      name: p.participantName,
      prompt: p.prompt,
      timestamp: p.timestamp,
    })),
    ...aiPromptResponses.map((r) => ({
      kind: 'answer' as const,
      id: `${r.participantId}-${r.timestamp}`,
      name: r.participantName,
      prompt: r.prompt,
      response: r.response,
      timestamp: r.timestamp,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  const newestAnswer = items.find((i) => i.kind === 'answer');
  const typed = useTypewriter(
    newestAnswer ? newestAnswer.id : null,
    newestAnswer?.kind === 'answer' ? newestAnswer.response : ''
  );

  // Fade the backdrop while anything is on screen; the empty state keeps the
  // full stage look.
  const dim = active && items.length > 0;

  return (
    <group>
      <FloatingText position={[0, 3.2, 0]} fontSize={0.45} color="#ef223a" bold delay={0}>
        {slot('headline')}
      </FloatingText>

      <BackdropFade dim={dim} />

      {active && (
        <Html center transform position={[0, 0, 0]}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", width: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 7, color: '#7e869c', fontWeight: 500 }}>
              📱 Prompt our live AI agent from your phone — answers appear here in real time
            </p>

            {items.length === 0 ? (
              <div style={{
                marginTop: 6,
                padding: '16px 14px',
                borderRadius: 10,
                background: '#000d25',
                border: '2px dashed rgba(239, 34, 58, 0.4)',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 8, color: '#babecc', fontWeight: 500 }}>
                  Waiting for the first question…
                </span>
              </div>
            ) : (
              items.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 10,
                    background: '#000d25',
                    border: '2px solid rgba(239, 34, 58, 0.4)',
                    boxShadow: '0 0 12px rgba(239, 34, 58, 0.2)',
                    opacity: i === 0 ? 1 : i === 1 ? 0.65 : 0.4,
                    animation: item.kind === 'pending' ? 'aiShimmer 1.4s ease-in-out infinite' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 6, color: '#ef223a', fontWeight: 700 }}>{item.name}</span>
                    <span style={{ fontSize: 6, color: '#4d5777' }}>
                      {item.kind === 'pending' ? 'is asking…' : 'asked'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: 7, color: '#ffffff', fontWeight: 600, lineHeight: 1.4 }}>
                    {item.prompt}
                  </p>
                  {item.kind === 'pending' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 6, color: '#4d5777', fontWeight: 500 }}>thinking</span>
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: '50%',
                            background: '#ef223a',
                            animation: `aiDot 1.2s ease-in-out ${d * 0.18}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <span style={{ fontSize: 7, color: '#ef223a', fontWeight: 700 }}>→</span>
                      <p style={{ margin: 0, fontSize: 6.5, color: '#babecc', fontWeight: 500, lineHeight: 1.5 }}>
                        {/* Only the newest answer types itself out. */}
                        {item.id === newestAnswer?.id ? typed : item.response}
                        {item.id === newestAnswer?.id && typed.length < item.response.length && (
                          <span style={{ color: '#ef223a' }}>▍</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <style>{`
            @keyframes aiShimmer {
              0%, 100% { border-color: rgba(239, 34, 58, 0.4); box-shadow: 0 0 12px rgba(239, 34, 58, 0.2); }
              50% { border-color: rgba(239, 34, 58, 0.85); box-shadow: 0 0 22px rgba(239, 34, 58, 0.45); }
            }
            @keyframes aiDot {
              0%, 100% { opacity: 0.25; transform: translateY(0); }
              50% { opacity: 1; transform: translateY(-1.5px); }
            }
          `}</style>
        </Html>
      )}

      <ParticleField count={100} spread={12} color="#ef223a" speed={0.05} size={0.012} />
      <pointLight position={[0, 2, 3]} color="#ef223a" intensity={dim ? 0.3 : 0.8} distance={8} />
    </group>
  );
}
