import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComputePanel } from "../component/ComputePanel";

describe("ComputePanel", () => {
  it("shows loading progress then metadata result", async () => {
    render(<ComputePanel callbacks={{}} request={{ authToken: "t", capability: "compute", documentApiGatewayUrl: "u", intervalMs: 0, requestId: "r-cp", session: "s" }} segments={{ ACKNOWLEDGMENT: "acknowledgment", CHAIN: "chain", COURT: "court", ENDORSEMENT: "endorsement", FEE: "fee", FEEFACTOR: "factor", FUND: "fund", HISTORY: "history", LEGAL: "legal", MONETARY: "monetary", PAGE: "page", PARTY: "party", PROPERTY: "property", REFERENCE: "reference", SECRETS: "secrets", TITLE: "title", TRANSACTION: "transaction", VITAL: "vital" }} onComplete={vi.fn()} onError={vi.fn()} workerClient={{ submit: async () => ({ data: null, status: "completed" }), status: async () => ({ data: null, status: "completed" }), data: async () => ({ heading: { class: "deed", title: "Title" } }) }} />);
    await waitFor(() => expect(screen.getByText("Deed")).toBeInTheDocument());
  });
});
