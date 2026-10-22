import { useCallback, useEffect, useState } from 'react';

export function useBcvRate() {
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const loadBcvRate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bcv-rate');
      const data = await res.json();
      if (data.success && data.rate) {
        setBcvRate(data.rate);
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBcvRate();
  }, [loadBcvRate]);

  return { bcvRate, loading, loadBcvRate };
}
