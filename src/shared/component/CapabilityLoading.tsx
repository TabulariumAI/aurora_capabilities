import { ProgressBar } from "aurorra-ui";
import type { JSX } from "react";
import { useLoadingMessages } from "../hook/useLoadingMessages";
import { capabilityStyles } from "../style/capabilityStyles";

export function CapabilityLoading({
  intervalMs,
  messages,
  showText,
}: {
  intervalMs: number;
  messages?: readonly string[];
  showText: boolean;
}): JSX.Element {
  const message = useLoadingMessages(messages ?? [], intervalMs, showText);
  return (
    <div style={capabilityStyles.loadingStack}>
      {showText ? <div style={capabilityStyles.loadingMessage}>{message}</div> : null}
      <ProgressBar continuous durationMs={intervalMs} running visible showText={false} />
    </div>
  );
}
