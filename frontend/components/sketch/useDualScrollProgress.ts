"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDualScrollProgress() {
  const generatorScrollRef = useRef<HTMLDivElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [feedProgress, setFeedProgress] = useState(0);
  const [isGenScrolling, setIsGenScrolling] = useState(false);
  const [isFeedScrolling, setIsFeedScrolling] = useState(false);
  const genTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const genScrollFrameRef = useRef<number | null>(null);
  const feedScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
      if (feedTimeoutRef.current) clearTimeout(feedTimeoutRef.current);
      if (genScrollFrameRef.current !== null) cancelAnimationFrame(genScrollFrameRef.current);
      if (feedScrollFrameRef.current !== null) cancelAnimationFrame(feedScrollFrameRef.current);
    };
  }, []);

  const handleGenScroll = useCallback((_e?: React.UIEvent<HTMLElement>) => {
    setIsGenScrolling(true);
    if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
    genTimeoutRef.current = setTimeout(() => setIsGenScrolling(false), 1200);

    if (genScrollFrameRef.current !== null) return;
    genScrollFrameRef.current = requestAnimationFrame(() => {
      genScrollFrameRef.current = null;
      const el = generatorScrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      setGenProgress(max > 0 ? el.scrollTop / max : 0);
    });
  }, []);

  const handleFeedScroll = useCallback((_e?: React.UIEvent<HTMLElement>) => {
    setIsFeedScrolling(true);
    if (feedTimeoutRef.current) clearTimeout(feedTimeoutRef.current);
    feedTimeoutRef.current = setTimeout(() => setIsFeedScrolling(false), 1200);

    if (feedScrollFrameRef.current !== null) return;
    feedScrollFrameRef.current = requestAnimationFrame(() => {
      feedScrollFrameRef.current = null;
      const el = feedScrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      setFeedProgress(max > 0 ? el.scrollTop / max : 0);
    });
  }, []);

  return {
    feedProgress,
    feedScrollRef,
    genProgress,
    generatorScrollRef,
    handleFeedScroll,
    handleGenScroll,
    isFeedScrolling,
    isGenScrolling,
  };
}
