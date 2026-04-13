"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PipelineStatusContextValue = {
  running: boolean | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const PipelineStatusContext = createContext<PipelineStatusContextValue | null>(null);

export function PipelineStatusProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const data = await res.json();
      setRunning(data.running ?? false);
      setError(null);
    } catch {
      setError("Failed to load pipeline status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({ running, loading, error, refresh }),
    [running, loading, error, refresh]
  );

  return <PipelineStatusContext.Provider value={value}>{children}</PipelineStatusContext.Provider>;
}

export function usePipelineStatusContext(): PipelineStatusContextValue {
  const ctx = useContext(PipelineStatusContext);
  if (!ctx) {
    throw new Error("usePipelineStatusContext must be used within PipelineStatusProvider");
  }
  return ctx;
}
