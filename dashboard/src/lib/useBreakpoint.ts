import { useEffect, useState } from 'react';

/** True once the viewport is at or above `px` — plain matchMedia, no extra dependency. */
export function useBreakpoint(px: number) {
  const [above, setAbove] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= px));

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setAbove(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [px]);

  return above;
}
