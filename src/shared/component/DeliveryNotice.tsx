import type { JSX } from "react";
import { capabilityStyles } from "../style/capabilityStyles";

export function DeliveryNotice({ message, kind }: { message: string | null; kind: "info" | "error" }): JSX.Element | null {
  if (!message) return null;
  return <div aria-live="polite" style={capabilityStyles.notice(kind)}>{message}</div>;
}
