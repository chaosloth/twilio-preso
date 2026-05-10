# Phase 5: 3D Stage Scenes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build all 18 3D stage scenes with their visual elements, animations, and interactive data bindings.

**Architecture:** Each stage is a self-contained R3F component. Reusable 3D objects (TwilioGem, ParticleField, etc.) are composed within stages. GSAP timelines drive entrance animations triggered when the camera arrives.

**Tech Stack:** TypeScript, React Three Fiber, drei, GSAP, Three.js, troika-three-text

---

### Task 1: Reusable 3D objects

**Files:**
- Create: `packages/presenter/src/objects/TwilioGem.tsx`
- Create: `packages/presenter/src/objects/ParticleField.tsx`
- Create: `packages/presenter/src/objects/FloatingText.tsx`
- Create: `packages/presenter/src/objects/BarChart3D.tsx`
- Create: `packages/presenter/src/objects/WordCloud3D.tsx`
- Create: `packages/presenter/src/objects/GlowingPillar.tsx`

- [ ] **Step 1: Create TwilioGem — the angular polygon wireframe shape**

```tsx
// packages/presenter/src/objects/TwilioGem.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, ExtrudeGeometry, type Mesh } from 'three';

function createGemShape(): Shape {
  const shape = new Shape();
  // Angular polygon matching the Twilio template's "gem" shape
  shape.moveTo(-2, 1.2);
  shape.lineTo(-1.5, 2);
  shape.lineTo(1.8, 2.1);
  shape.lineTo(2.2, 0.8);
  shape.lineTo(1.8, -1.8);
  shape.lineTo(-0.5, -2.1);
  shape.lineTo(-2.2, -0.8);
  shape.closePath();
  return shape;
}

interface TwilioGemProps {
  scale?: number;
  color?: string;
  wireframe?: boolean;
  rotationSpeed?: number;
  emissiveIntensity?: number;
}

export function TwilioGem({
  scale = 1,
  color = '#F22F46',
  wireframe = true,
  rotationSpeed = 0.2,
  emissiveIntensity = 0.5,
}: TwilioGemProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * rotationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} scale={scale}>
      <shapeGeometry args={[createGemShape()]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        wireframe={wireframe}
        transparent
        opacity={wireframe ? 0.8 : 1}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Create ParticleField — instanced particle system**

```tsx
// packages/presenter/src/objects/ParticleField.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';

interface ParticleFieldProps {
  count?: number;
  spread?: number;
  color?: string;
  speed?: number;
  size?: number;
}

export function ParticleField({
  count = 500,
  spread = 10,
  color = '#F22F46',
  speed = 0.3,
  size = 0.02,
}: ParticleFieldProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * speed * 0.01,
      vy: (Math.random() - 0.5) * speed * 0.01,
      vz: (Math.random() - 0.5) * speed * 0.01,
    }));
  }, [count, spread, speed]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Wrap around
      if (Math.abs(p.x) > spread / 2) p.vx *= -1;
      if (Math.abs(p.y) > spread / 2) p.vy *= -1;
      if (Math.abs(p.z) > spread / 2) p.vz *= -1;

      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[size, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}
```

- [ ] **Step 3: Create FloatingText — animatable SDF text wrapper**

```tsx
// packages/presenter/src/objects/FloatingText.tsx
import { Text } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Mesh } from 'three';

interface FloatingTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  bold?: boolean;
  delay?: number;
  maxWidth?: number;
}

export function FloatingText({
  children,
  position = [0, 0, 0],
  fontSize = 0.4,
  color = '#ffffff',
  bold = false,
  delay = 0,
  maxWidth = 8,
}: FloatingTextProps) {
  const ref = useRef<Mesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.material.opacity = 0;
    gsap.to(ref.current.material, {
      opacity: 1,
      duration: 0.8,
      delay,
      ease: 'power2.out',
    });
    gsap.from(ref.current.position, {
      y: position[1] - 0.3,
      duration: 0.8,
      delay,
      ease: 'power2.out',
    });
  }, [delay, position]);

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      maxWidth={maxWidth}
      fontWeight={bold ? 'bold' : 'normal'}
      material-transparent
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 4: Create BarChart3D — real-time poll results visualization**

```tsx
// packages/presenter/src/objects/BarChart3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Mesh } from 'three';

interface BarChart3DProps {
  data: Record<string, number>;
  position?: [number, number, number];
  maxHeight?: number;
  barWidth?: number;
  color?: string;
}

export function BarChart3D({
  data,
  position = [0, 0, 0],
  maxHeight = 3,
  barWidth = 0.8,
  color = '#F22F46',
}: BarChart3DProps) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...Object.values(data), 1);
  const totalWidth = entries.length * (barWidth + 0.3);

  return (
    <group position={position}>
      {entries.map(([label, value], i) => {
        const height = (value / maxValue) * maxHeight;
        const x = i * (barWidth + 0.3) - totalWidth / 2 + barWidth / 2;
        return (
          <group key={label} position={[x, 0, 0]}>
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[barWidth, height, 0.3]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
            </mesh>
            <Text position={[0, -0.4, 0]} fontSize={0.15} color="#ffffff" anchorX="center" maxWidth={barWidth + 0.2}>
              {label}
            </Text>
            <Text position={[0, height + 0.2, 0]} fontSize={0.2} color={color} anchorX="center">
              {String(value)}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 5: Create WordCloud3D — floating words from audience responses**

```tsx
// packages/presenter/src/objects/WordCloud3D.tsx
import { useMemo } from 'react';
import { Text } from '@react-three/drei';

interface WordCloud3DProps {
  words: Array<{ text: string; count: number }>;
  spread?: number;
}

export function WordCloud3D({ words, spread = 4 }: WordCloud3DProps) {
  const positions = useMemo(() => {
    return words.map(() => ({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread * 0.6,
      z: (Math.random() - 0.5) * spread * 0.3,
    }));
  }, [words.length, spread]);

  const maxCount = Math.max(...words.map((w) => w.count), 1);

  return (
    <group>
      {words.map((word, i) => {
        const scale = 0.15 + (word.count / maxCount) * 0.4;
        const pos = positions[i];
        return (
          <Text
            key={`${word.text}-${i}`}
            position={[pos.x, pos.y, pos.z]}
            fontSize={scale}
            color={word.count > maxCount * 0.6 ? '#F22F46' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
          >
            {word.text}
          </Text>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 6: Create GlowingPillar — product reveal element**

```tsx
// packages/presenter/src/objects/GlowingPillar.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Mesh } from 'three';

interface GlowingPillarProps {
  label: string;
  sublabel: string;
  position?: [number, number, number];
  color?: string;
  intensity?: number;
}

export function GlowingPillar({
  label,
  sublabel,
  position = [0, 0, 0],
  color = '#F22F46',
  intensity = 1,
}: GlowingPillarProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.3, 0.4, 3, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4 * intensity}
          transparent
          opacity={0.7}
        />
      </mesh>
      <pointLight position={[0, 2, 0]} color={color} intensity={intensity} distance={5} />
      <Text position={[0, 2.2, 0]} fontSize={0.25} color="#ffffff" anchorX="center" fontWeight="bold">
        {label}
      </Text>
      <Text position={[0, -2, 0]} fontSize={0.12} color={color} anchorX="center" maxWidth={2}>
        {sublabel}
      </Text>
    </group>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/presenter/src/objects/
git commit -m "feat: add reusable 3D objects (gem, particles, text, bar chart, word cloud, pillar)"
```

---

### Task 2: ACT 1 Stages (1-4)

**Files:**
- Modify: `packages/presenter/src/stages/Stage01Opening.tsx`
- Modify: `packages/presenter/src/stages/Stage02Speakers.tsx`
- Modify: `packages/presenter/src/stages/Stage03WhyWonder.tsx`
- Modify: `packages/presenter/src/stages/Stage04StoryArc.tsx`

- [ ] **Step 1: Build Stage 1 — Opening with QR and registration particles**

```tsx
// packages/presenter/src/stages/Stage01Opening.tsx
import { TwilioGem } from '../objects/TwilioGem';
import { ParticleField } from '../objects/ParticleField';
import { FloatingText } from '../objects/FloatingText';
import { Html } from '@react-three/drei';
import { usePresenterStore } from '../store';

export default function Stage01Opening() {
  const participants = usePresenterStore((s) => s.totalParticipants);

  return (
    <group>
      <TwilioGem scale={1.5} emissiveIntensity={0.8} rotationSpeed={0.1} />
      <ParticleField count={Math.min(participants * 5, 500)} spread={8} size={0.03} />
      <FloatingText position={[0, 2.5, 0]} fontSize={0.15} color="#888888" delay={1}>
        Scan to join the experience
      </FloatingText>
      <Html position={[0, -1.5, 0]} center transform>
        <div style={{ background: 'white', padding: 16, borderRadius: 8 }}>
          <img
            src="/qr-placeholder.svg"
            alt="QR Code"
            style={{ width: 120, height: 120 }}
          />
        </div>
      </Html>
      <FloatingText position={[0, -3, 0]} fontSize={0.2} color="#F22F46" delay={0.5}>
        {`${participants} connected`}
      </FloatingText>
    </group>
  );
}
```

- [ ] **Step 2: Build Stages 2-4 (speakers intro, why wonder, story arc)**

Build each stage following the same pattern — composing reusable objects with stage-specific content. Each stage gets its own file with appropriate 3D elements matching the spec description.

- [ ] **Step 3: Commit**

```bash
git add packages/presenter/src/stages/Stage01Opening.tsx packages/presenter/src/stages/Stage02Speakers.tsx packages/presenter/src/stages/Stage03WhyWonder.tsx packages/presenter/src/stages/Stage04StoryArc.tsx
git commit -m "feat: build ACT 1 stages (opening, speakers, why wonder, story arc)"
```

---

### Task 3: ACT 2 Stages (5-9)

**Files:**
- Modify: `packages/presenter/src/stages/Stage05CustomerNerves.tsx` through `Stage09CustomersAre.tsx`

- [ ] **Step 1: Build Stage 5 — Poll with real-time 3D bar chart**

```tsx
// packages/presenter/src/stages/Stage05CustomerNerves.tsx
import { FloatingText } from '../objects/FloatingText';
import { ParticleField } from '../objects/ParticleField';
import { BarChart3D } from '../objects/BarChart3D';
import { usePresenterStore } from '../store';

export default function Stage05CustomerNerves() {
  const results = usePresenterStore((s) => s.aggregateResults);
  const pollData = results?.stageIndex === 4 ? results.results : {};

  return (
    <group>
      <ParticleField count={300} color="#F22F46" speed={1.5} spread={12} />
      <FloatingText position={[0, 3, 0]} fontSize={0.4} color="#ffffff" bold delay={0.3}>
        {"Who's getting on\ntheir customers' nerves?"}
      </FloatingText>
      <BarChart3D data={pollData} position={[0, -0.5, 0]} />
    </group>
  );
}
```

- [ ] **Step 2: Build Stages 6-9** following the same pattern — each with its described visual elements and data bindings.

- [ ] **Step 3: Commit**

```bash
git add packages/presenter/src/stages/Stage05CustomerNerves.tsx packages/presenter/src/stages/Stage06PatienceDeficit.tsx packages/presenter/src/stages/Stage07ThinkChannels.tsx packages/presenter/src/stages/Stage08Siloes.tsx packages/presenter/src/stages/Stage09CustomersAre.tsx
git commit -m "feat: build ACT 2 stages (poll, patience, channels, siloes, word cloud)"
```

---

### Task 4: ACT 3 Stages (10-15)

- [ ] **Step 1: Build Stages 10-15** — orchestrating, conversations overview, and each product deep-dive with their described 3D scenes.

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/stages/Stage10Orchestrating.tsx packages/presenter/src/stages/Stage11ConversationsOverview.tsx packages/presenter/src/stages/Stage12Orchestrator.tsx packages/presenter/src/stages/Stage13Memory.tsx packages/presenter/src/stages/Stage14Intelligence.tsx packages/presenter/src/stages/Stage15AgentConnect.tsx
git commit -m "feat: build ACT 3 stages (orchestrating, product pillars, demos)"
```

---

### Task 5: ACT 4 Stages (16-18)

- [ ] **Step 1: Build Stages 16-18** — innovation poll, aggregate stats, and closing with code animation.

- [ ] **Step 2: Commit**

```bash
git add packages/presenter/src/stages/Stage16Innovation.tsx packages/presenter/src/stages/Stage17NeverEasier.tsx packages/presenter/src/stages/Stage18Closing.tsx
git commit -m "feat: build ACT 4 stages (innovation poll, stats, closing)"
```
