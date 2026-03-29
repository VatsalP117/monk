import { useCallback, useEffect, useRef, useState } from "react";

export function useIdleVisibility(idleMs: number, locked: boolean): {
  visible: boolean;
  ping: () => void;
} {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const ping = useCallback(() => {
    setVisible(true);
    clearTimer();

    if (locked) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
    }, idleMs);
  }, [clearTimer, idleMs, locked]);

  useEffect(() => {
    if (locked) {
      clearTimer();
      setVisible(true);
      return;
    }

    return clearTimer;
  }, [clearTimer, locked]);

  useEffect(() => {
    const onInteract = () => ping();

    window.addEventListener("mousemove", onInteract, { passive: true });
    window.addEventListener("mousedown", onInteract);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("touchstart", onInteract, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onInteract);
      window.removeEventListener("mousedown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
  }, [ping]);

  return {
    visible,
    ping
  };
}
