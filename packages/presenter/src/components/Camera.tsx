import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { usePresenterStore } from '../store';
import { STAGE_SPACING } from './Stage';


export function Camera() {
  const { camera } = useThree();
  const currentStageIndex = usePresenterStore((s) => s.currentStageIndex);
  const prevIndex = useRef(0);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    // Set initial position
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (currentStageIndex === prevIndex.current && currentStageIndex === 0) return;
    if (currentStageIndex === prevIndex.current) return;

    const targetZ = -currentStageIndex * STAGE_SPACING + 8;

    // Kill any running animation
    if (timeline.current) timeline.current.kill();

    const tl = gsap.timeline();
    timeline.current = tl;

    tl.to(camera.position, { z: targetZ, duration: 1.5, ease: 'power2.inOut' });

    prevIndex.current = currentStageIndex;
  }, [currentStageIndex, camera]);

  return null;
}
