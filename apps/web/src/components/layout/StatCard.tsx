import type { ReactNode } from "react";

type StatCardProps = {
  value: ReactNode;
  label: string;
  aside?: ReactNode;
};

function StatCard({ value, label, aside }: StatCardProps) {
  return (
    <article className="stat-card">
      {aside ? (
        <div
          className="stat-with-date"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
          {aside}
        </div>
      ) : (
        <>
          <span className="stat-value">{value}</span>
          <span className="stat-label">{label}</span>
        </>
      )}
    </article>
  );
}

export { StatCard };
