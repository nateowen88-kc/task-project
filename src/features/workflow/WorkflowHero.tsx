import { StatCard } from "../../components/layout/StatCard";
import { AppSelect } from "../../components/ui/AppSelect";
import { TodayCalendarBadge } from "../../components/ui/TodayCalendarBadge";

type WorkflowHeroProps = {
  error: string | null;
  isGodMode: boolean;
  isAllWorkspacesMode: boolean;
  canSwitchWorkspace: boolean;
  isWorkspaceSwitching: boolean;
  workspaceId: string;
  workspaces: Array<{ id: string; name: string }>;
  todayBadge: { month: string; day: number; weekday: string };
  stats: {
    dueNow: number;
    inbox: number;
    blocked: number;
    done: number;
  };
  onChangeWorkspace: (workspaceId: string) => void;
};

export function WorkflowHero({
  error,
  isGodMode,
  isAllWorkspacesMode,
  canSwitchWorkspace,
  isWorkspaceSwitching,
  workspaceId,
  workspaces,
  todayBadge,
  stats,
  onChangeWorkspace,
}: WorkflowHeroProps) {
  return (
    <section className="panel intro-panel intro-panel-compact">
      <div className="hero hero-compact">
        <div>
          <p className="eyebrow">TimeSmith</p>
          <h1>Your time, shaped into real progress.</h1>
          {isGodMode && (
            <span
              style={{
                display: "inline-flex",
                marginTop: "10px",
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
              {isAllWorkspacesMode ? "God Mode · All Workspaces" : "God Mode"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
          <p className="hero-copy">
            TimeSmith turns captured work, planned priorities, and active tasks into one calm operating view.
          </p>
          {canSwitchWorkspace && (
            <div style={{ minWidth: "260px", position: "relative", zIndex: 40 }}>
              <AppSelect
                ariaLabel="Active workspace"
                className="app-select"
                menuClassName="app-select-menu workspace-switcher-menu"
                value={workspaceId}
                options={workspaces.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                }))}
                onChange={onChangeWorkspace}
              />
              {isWorkspaceSwitching && (
                <p className="eyebrow" style={{ marginTop: "6px" }}>
                  Switching workspace...
                </p>
              )}
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
        <div className="stat-grid stat-grid-compact">
          <StatCard
            value={stats.dueNow}
            label="Today’s agenda"
            aside={<TodayCalendarBadge month={todayBadge.month} day={todayBadge.day} weekday={todayBadge.weekday} />}
          />
          <StatCard value={stats.inbox} label="Inbox" />
          <StatCard value={stats.blocked} label="Blocked" />
          <StatCard value={stats.done} label="Done" />
        </div>
      </div>
    </section>
  );
}
