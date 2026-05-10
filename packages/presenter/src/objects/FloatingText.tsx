import { Text } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Mesh } from 'three';

const FONT_HEADING = '/fonts/Tektur-Bold.ttf';
const FONT_BODY = '/fonts/SpaceGrotesk-Regular.ttf';
const FONT_BODY_BOLD = '/fonts/SpaceGrotesk-Bold.ttf';

interface FloatingTextProps {
  children: string;
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  bold?: boolean;
  heading?: boolean;
  delay?: number;
  maxWidth?: number;
  anchorX?: 'left' | 'center' | 'right';
}

export function FloatingText({
  children,
  position = [0, 0, 0],
  fontSize = 0.4,
  color = '#ffffff',
  bold = false,
  heading = false,
  delay = 0,
  maxWidth = 8,
  anchorX = 'center',
}: FloatingTextProps) {
  const ref = useRef<Mesh>(null);

  const isHeading = heading || (bold && fontSize >= 0.35);
  const font = isHeading ? FONT_HEADING : bold ? FONT_BODY_BOLD : FONT_BODY;

  useEffect(() => {
    if (!ref.current) return;
    const mat = ref.current.material as any;
    if (mat) {
      mat.opacity = 0;
      gsap.to(mat, { opacity: 1, duration: 0.8, delay, ease: 'power2.out' });
    }
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
      anchorX={anchorX}
      anchorY="middle"
      maxWidth={maxWidth}
      font={font}
      material-transparent
      material-opacity={0}
    >
      {children}
    </Text>
  );
}
