import { useRef, type JSX } from "react";
import { capabilityStyles } from "../style/capabilityStyles";
import { downloadBlob } from "../worker/capabilityData";

type DownloadButtonProps = {
  disabled: boolean;
  label: string;
  onError(message: string): void;
  onStart(): void;
  onSuccess(): void;
  url: string;
};

export function DownloadButton({ disabled, label, onError, onStart, onSuccess, url }: DownloadButtonProps): JSX.Element {
  const link = useRef<HTMLAnchorElement>(null);

  const download = async () => {
    onStart();
    try {
      const { blob, name } = await downloadBlob(url);
      const href = URL.createObjectURL(blob);
      link.current!.href = href;
      link.current!.download = name;
      link.current!.click();
      URL.revokeObjectURL(href);
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <button data-variant="primary" disabled={disabled} onClick={() => void download()} style={{ ...capabilityStyles.primaryButton, ...(disabled ? capabilityStyles.disabled : {}) }} type="button">{label}</button>
      <a aria-hidden="true" ref={link} />
    </>
  );
}
