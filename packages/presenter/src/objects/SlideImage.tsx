import { Suspense, Component, type ReactNode } from 'react';
import { Image } from '@react-three/drei';

/**
 * A texture load that 404s throws from inside Suspense and would take the whole
 * canvas down. A pasted image URL is exactly the kind of thing that is wrong at
 * the worst moment, so a broken image renders as nothing at all.
 */
class Hide extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface SlideImageProps {
  url: string;
  position?: [number, number, number];
  /** Width in world units; height follows the image's aspect ratio. */
  width?: number;
}

/**
 * The `image` slot every stage declares. Rendered by the stage host rather than
 * by each of the 23 stage components, so pasting a URL into any slide works
 * without touching that slide's scene.
 */
export function SlideImage({ url, position = [0, -0.2, -1], width = 5 }: SlideImageProps) {
  if (!url) return null;
  return (
    <Hide>
      <Suspense fallback={null}>
        <Image url={url} position={position} scale={width} transparent toneMapped={false} />
      </Suspense>
    </Hide>
  );
}
