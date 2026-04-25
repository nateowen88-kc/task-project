import { createPortal } from "react-dom";

type AppView = "workflow" | "agenda" | "inbox" | "notifications" | "admin" | "focus";

export type SideRailProps = {
  activeView: AppView;
  availableViews: AppView[];
  railCounts: Partial<Record<AppView, number>>;
  viewIcons: Record<AppView, string>;
  viewLabels: Record<AppView, string>;
  sessionWorkspaceName: string;
  sessionUserName: string;
  sessionWorkspaceId: string;
  sessionWorkspacesCount: number;
  isGodMode: boolean;
  isBrandTooltipVisible: boolean;
  brandMarkRef: React.RefObject<HTMLSpanElement>;
  brandTooltipPosition: { left: number; top: number };
  onShowBrandTooltip: () => void;
  onHideBrandTooltip: () => void;
  onChangeView: (view: AppView) => void;
  onLogout: () => void;
};

export function SideRail({
  activeView,
  availableViews,
  railCounts,
  viewIcons,
  viewLabels,
  sessionWorkspaceName,
  sessionUserName,
  sessionWorkspaceId,
  sessionWorkspacesCount,
  isGodMode,
  isBrandTooltipVisible,
  brandMarkRef,
  brandTooltipPosition,
  onShowBrandTooltip,
  onHideBrandTooltip,
  onChangeView,
  onLogout,
}: SideRailProps) {
  return (
    <aside className="side-rail" aria-label="Primary navigation">
      <div
        className="side-rail-brand"
        aria-label={`Workspace name: ${sessionWorkspaceName}. Logged in as: ${sessionUserName}`}
      >
        <span
          ref={brandMarkRef}
          className="side-rail-brand-mark"
          tabIndex={0}
          onMouseEnter={onShowBrandTooltip}
          onMouseLeave={onHideBrandTooltip}
          onFocus={onShowBrandTooltip}
          onBlur={onHideBrandTooltip}
        >
          T
        </span>
      </div>
      {isBrandTooltipVisible &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: `${brandTooltipPosition.left}px`,
              top: `${brandTooltipPosition.top}px`,
              transform: "translateY(-50%)",
              minWidth: "220px",
              padding: "12px 14px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid rgba(89, 108, 122, 0.18)",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.14)",
              zIndex: 2147483647,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#596C7A",
              }}
            >
              TimeSmith workspace
            </span>
            {isGodMode && (
              <span
                style={{
                  alignSelf: "flex-start",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                  background: "#24313a",
                  padding: "4px 8px",
                  borderRadius: "999px",
                }}
              >
                God Mode
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: "#24313a" }}>
              <span style={{ fontSize: "13px", lineHeight: 1.35 }}>
                <strong>Workspace name:</strong> {sessionWorkspaceName}
              </span>
              <span style={{ fontSize: "13px", lineHeight: 1.35 }}>
                <strong>Logged in as:</strong> {sessionUserName}
              </span>
              {sessionWorkspaceId && (
                <span style={{ fontSize: "13px", lineHeight: 1.35 }}>
                  <strong>Workspace ID:</strong> {sessionWorkspaceId}
                </span>
              )}
              {sessionWorkspacesCount > 1 && (
                <span style={{ fontSize: "13px", lineHeight: 1.35 }}>
                  <strong>Available workspaces:</strong> {sessionWorkspacesCount}
                </span>
              )}
            </div>
          </div>,
          document.body,
        )}
      <div className="side-rail-nav">
        {availableViews.map((view) => (
          <button
            key={view}
            type="button"
            className={`rail-destination ${activeView === view ? "active" : ""}`}
            onClick={() => onChangeView(view)}
            aria-pressed={activeView === view}
          >
            <span className="rail-icon" aria-hidden="true">
              {viewIcons[view]}
            </span>
            <span className="rail-label">{viewLabels[view]}</span>
            {typeof railCounts[view] === "number" && <span className="rail-count">{railCounts[view]}</span>}
          </button>
        ))}
      </div>
      <button className="rail-signout" type="button" onClick={onLogout}>
        Sign out
      </button>
    </aside>
  );
}
