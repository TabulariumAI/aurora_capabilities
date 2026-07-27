import { useEffect, useState } from "react";

export function useLoadingMessages(messages: readonly string[], intervalMs: number, active: boolean): string {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!active) {
      setMessage("");
      return undefined;
    }

    let index = 0;
    let previous = "";
    let intervalId: ReturnType<typeof setInterval>;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const show = (raw: string) => {
      const next = raw === previous ? `Still ${raw}` : raw;
      previous = raw;
      timers.push(setTimeout(() => setMessage(next), 50));
    };
    show(messages[0] ?? "");
    intervalId = setInterval(() => {
      if (index >= messages.length - 1) return;
      index += 1;
      show(messages[index] ?? "");
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      timers.forEach(clearTimeout);
    };
  }, [active, intervalMs, messages]);

  return message;
}
