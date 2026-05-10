import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export function Camera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}
