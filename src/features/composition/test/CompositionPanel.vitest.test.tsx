import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompositionPanel } from "../component/CompositionPanel";

describe("CompositionPanel", () => {
  it("renders composition metadata without mutation actions", async () => {
    const onReadyChange = vi.fn();
    render(<CompositionPanel callbacks={{}} request={{ authToken: "t", capability: "composition", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-panel-comp", session: "s" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", CHAIN: "chain", COURT: "court", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", HISTORY: "history", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onError={vi.fn()} onReadyChange={onReadyChange} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => ({ chain: [], heading: { class: "deed", title: "Title" }, history: {} }) }} />);
    expect(onReadyChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByText("Deed")).toBeInTheDocument());
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Refine or Chat")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Metadata" }).parentElement).toHaveStyle({
      display: "flex",
      flex: "1 1 auto",
      flexDirection: "column",
      minHeight: "0",
      overflow: "hidden",
    });
  });
});
