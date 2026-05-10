import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import gsap from 'gsap';
import { usePresenterStore } from '../store';
import { TOTAL_STAGES } from '@twilio-preso/shared';

const STAGE_SPACING = 20;

export function Camera() {
  const { camera } = useThree();
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const prevIndex = useRef(0);
  const animating = useRef(false);

  const waypoints = useMemo(() => {
    return Array.from({ length: TOTAL_STAGES }, (_, i) => new Vector3(0, 0, -i * STAGE_SPACING));
  }, []);

  useEffect(() => {
    if (currentStageIndex === prevIndex.current) return;

    const target = waypoints[currentStageIndex];
    animating.current = true;

    gsap.to(camera.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onComplete: () => { animating.current = false; },
    });

    prevIndex.current = currentStageIndex;
  }, [currentStageIndex, camera, waypoints]);

  return null;
}
