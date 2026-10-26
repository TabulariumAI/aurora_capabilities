import { LoadPlaceholder, skeletonStyle } from "aurora-core";
import type { JSX } from "react";
import { computeCss, computeStyles } from "../style/compute.styles";

export function ComputePlaceholder(): JSX.Element {
  return (
    <section aria-label="Compute" style={computeStyles.root}>
      <style>{computeCss}</style>
      <div data-panel-scroll="true" style={computeStyles.accordion}>
        <LoadPlaceholder label="Loading fees and funds">
          {["Factors", "Fees", "Funds"].map(title => (
            <div key={title} style={computeStyles.section}>
              <div style={computeStyles.header}>
                <div style={{ ...computeStyles.trigger, cursor: "default" }}>
                  <span aria-hidden="true" style={{ ...skeletonStyle, ...computeStyles.chevron }} />
                  <span>{title}</span>
                </div>
                {title !== "Factors" ? <span aria-hidden="true" style={{ ...skeletonStyle, width: "3rem" }} /> : null}
                <span aria-hidden="true" style={{ ...skeletonStyle, ...computeStyles.count }} />
              </div>
              {title === "Fees" ? <div aria-hidden="true" style={computeStyles.items}>
                {["75%", "55%"].map(width => (
                  <div className="compute-row" key={width} style={computeStyles.row}>
                    <span style={{ ...skeletonStyle, ...computeStyles.status }} />
                    <span style={{ ...skeletonStyle, ...computeStyles.label, width, height: "1lh" }} />
                    <span style={{ ...skeletonStyle, ...computeStyles.value, width: "4rem", height: "1lh" }} />
                    <div className="compute-row-actions" style={{ ...computeStyles.rowActions, ...computeStyles.currencyActions }}>
                      {[0, 1, 2].map(action => <span key={action} style={{ ...skeletonStyle, width: "1.25rem", height: "1.25rem", margin: "0.375rem" }} />)}
                    </div>
                  </div>
                ))}
              </div> : null}
            </div>
          ))}
          <div className="compute-total" style={{ ...computeStyles.row, ...computeStyles.total }}>
            <span style={{ ...computeStyles.label, ...computeStyles.totalText, gridColumn: "1 / 3" }}>Total fees</span>
            <span aria-hidden="true" style={{ ...skeletonStyle, width: "5rem", gridColumn: "3" }} />
          </div>
        </LoadPlaceholder>
      </div>
    </section>
  );
}
