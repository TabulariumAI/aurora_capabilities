import { useEffect, useRef } from "react";
import type { ProgressJob } from "aurora-core";
import { useCapabilityDataStore } from "../worker/capabilityData";

export function useCapabilityRun(requestId: string, start: () => void, onProgress: (event: ProgressJob) => void): void {
  const cursor = useRef<{ token: symbol | undefined; seen: number }>({ token: undefined, seen: 0 });
  useEffect(() => {
    const receive = () => {
      const run = useCapabilityDataStore.getState().runs.get(requestId);
      if (!run) return;
      if (cursor.current.token !== run.token) cursor.current = { token: run.token, seen: 0 };
      const events = run.events.slice(cursor.current.seen);
      cursor.current.seen = run.events.length;
      for (const event of events) onProgress(event);
    };
    const unsubscribe = useCapabilityDataStore.subscribe(receive);
    receive();
    start();
    receive();
    return unsubscribe;
  }, [requestId, start, onProgress]);
}
