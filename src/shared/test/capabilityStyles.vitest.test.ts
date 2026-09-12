import { describe, expect, it } from "vitest";
import { progressMessageStyles, progressStyles } from "../../features/progressview/style/progress.styles";
import { capabilityStyles } from "../style/capabilityStyles";

describe("capability styles", () => {
  it("uses the target type, spacing, and task controls", () => {
    expect(capabilityStyles.composition).toMatchObject({
      color: "var(--title-ink)",
      fontFamily: "var(--font-ui)",
    });
    expect(capabilityStyles.compositionAccordion).toMatchObject({ gap: "0.75rem" });
    expect(capabilityStyles.primaryButton).toMatchObject({
      backgroundColor: "var(--primary)",
      borderRadius: "var(--radius-control)",
      minHeight: "2.75rem",
    });
    expect(capabilityStyles.recordActions).toMatchObject({ display: "flex", justifyContent: "center" });
    expect(progressStyles.introCopy).toMatchObject({
      backgroundColor: "rgba(27, 127, 166, 0.05)",
      borderRadius: "var(--radius-card)",
    });
    expect(progressMessageStyles.completed).toMatchObject({ backgroundColor: "rgba(30, 142, 94, 0.05)" });
  });
});
