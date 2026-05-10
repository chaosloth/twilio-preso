import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import gsap from 'gsap';
import { usePresenterStore } from '../store';
import { STAGES, TOTAL_STAGES } from '@twilio-preso/shared';
import { STAGE_SPACING } from './Stage';

type CameraMove = 'dolly' | 'arc-left' | 'arc-right' | 'rise' | 'dive' | 'pull-back' | 'push-in';

function getCameraMove(fromIndex: number, toIndex: number): CameraMove {
  const toStage = STAGES[toIndex];
  const fromStage = STAGES[fromIndex];
  if (!toStage || !fromStage) return 'dolly';

  // Act transitions get dramatic moves
  if (toStage.act !== fromStage.act) {
    if (toStage.act > fromStage.act) return 'rise';
    return 'dive';
  }

  // Product deep-dives (stages 12-15) alternate arcs
  if (toIndex >= 11 && toIndex <= 14) {
    return toIndex % 2 === 0 ? 'arc-left' : 'arc-right';
  }

  // Interactive stages pull back to show data
  if (toStage.interaction) return 'pull-back';

  // Demo triggers push in for intimacy
  if (toStage.demoTrigger) return 'push-in';

  // Default: straight dolly
  return 'dolly';
}

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

    const move = getCameraMove(prevIndex.current, currentStageIndex);
    const targetZ = -currentStageIndex * STAGE_SPACING + 8;

    // Kill any running animation
    if (timeline.current) timeline.current.kill();

    const tl = gsap.timeline();
    timeline.current = tl;

    switch (move) {
      case 'dolly':
        tl.to(camera.position, { z: targetZ, duration: 1.5, ease: 'power2.inOut' });
        break;

      case 'arc-left':
        tl.to(camera.position, { x: -2, z: targetZ * 0.5 + camera.position.z * 0.5, duration: 0.7, ease: 'power2.in' })
          .to(camera.position, { x: 0, z: targetZ, duration: 0.8, ease: 'power2.out' });
        break;

      case 'arc-right':
        tl.to(camera.position, { x: 2, z: targetZ * 0.5 + camera.position.z * 0.5, duration: 0.7, ease: 'power2.in' })
          .to(camera.position, { x: 0, z: targetZ, duration: 0.8, ease: 'power2.out' });
        break;

      case 'rise':
        tl.to(camera.position, { y: 3, duration: 0.6, ease: 'power2.in' })
          .to(camera.position, { y: 0, z: targetZ, duration: 1, ease: 'power2.out' });
        break;

      case 'dive':
        tl.to(camera.position, { y: -2, duration: 0.5, ease: 'power2.in' })
          .to(camera.position, { y: 0, z: targetZ, duration: 0.9, ease: 'power2.out' });
        break;

      case 'pull-back':
        tl.to(camera.position, { z: targetZ + 3, duration: 0.8, ease: 'power2.inOut' })
          .to(camera.position, { z: targetZ, duration: 0.6, ease: 'power2.out' });
        break;

      case 'push-in':
        tl.to(camera.position, { z: targetZ - 2, duration: 1.2, ease: 'power3.inOut' })
          .to(camera.position, { z: targetZ, duration: 0.4, ease: 'power1.out' });
        break;
    }

    prevIndex.current = currentStageIndex;
  }, [currentStageIndex, camera]);

  return null;
}
