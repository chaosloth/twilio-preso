import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * An animated image (GIF, animated WebP/AVIF, APNG) as a texture that actually
 * moves.
 *
 * `THREE.TextureLoader` — and so drei's `<Image>` — decodes one frame and stops,
 * which is why a pasted GIF animates in the DOM-based editor preview and sits
 * frozen on the projector. WebGL has no notion of an animated image, so the
 * frames have to be decoded and blitted onto a canvas texture by hand.
 *
 * `null` means "not animated, unsupported, or unreachable" — every one of which
 * is a signal to fall back to the plain static texture rather than an error. The
 * fallback matters: `ImageDecoder` is Chromium-only, and a cross-origin host
 * without CORS headers can be drawn by an `<img>` but not read by `fetch`.
 */
export interface AnimatedTexture {
  texture: THREE.CanvasTexture;
  /** width / height of the decoded frames, so the caller can size its plane. */
  aspect: number;
}

/** GIF frames with no declared delay; what browsers use for the same case. */
const DEFAULT_FRAME_MS = 100;

export function useAnimatedTexture(url: string): AnimatedTexture | null {
  const [animated, setAnimated] = useState<AnimatedTexture | null>(null);

  useEffect(() => {
    setAnimated(null);
    if (!url) return;

    const ImageDecoderCtor = (window as unknown as { ImageDecoder?: any }).ImageDecoder;
    if (!ImageDecoderCtor) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let texture: THREE.CanvasTexture | undefined;
    let decoder: any;

    (async () => {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return;
      const type = response.headers.get('content-type') || 'image/gif';
      const data = await response.arrayBuffer();
      if (cancelled) return;

      decoder = new ImageDecoderCtor({ data, type });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      // A single-frame image is better served by the static path: no canvas
      // copy, no timer, and drei's loader caches it.
      if (cancelled || !track || !track.animated || track.frameCount < 2) return;

      const first = await decoder.decode({ frameIndex: 0, completeFramesOnly: true });
      if (cancelled) {
        first.image.close();
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = first.image.displayWidth;
      canvas.height = first.image.displayHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        first.image.close();
        return;
      }

      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const draw = (frame: { image: VideoFrame; duration: number | null }) => {
        // GIF frames can be partially transparent and ImageDecoder hands back
        // composited frames, so the canvas is cleared rather than painted over.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frame.image as unknown as CanvasImageSource, 0, 0);
        frame.image.close();
        if (texture) texture.needsUpdate = true;
        return frame.duration ? frame.duration / 1000 : DEFAULT_FRAME_MS;
      };

      let index = 0;
      const step = (frame: { image: VideoFrame; duration: number | null }) => {
        const delay = draw(frame);
        timer = setTimeout(() => {
          if (cancelled) return;
          index = (index + 1) % track.frameCount;
          decoder
            .decode({ frameIndex: index, completeFramesOnly: true })
            .then((next: any) => {
              if (cancelled) {
                next.image.close();
                return;
              }
              step(next);
            })
            .catch(() => {});
        }, delay);
      };

      setAnimated({ texture, aspect: canvas.width / canvas.height });
      step(first);
    })().catch(() => {
      // Unreadable, undecodable, or blocked by CORS: the static texture path
      // still has a chance, so this is deliberately silent.
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      texture?.dispose();
      decoder?.close?.();
    };
  }, [url]);

  return animated;
}
