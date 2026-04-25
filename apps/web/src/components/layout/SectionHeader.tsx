import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
};

function SectionHeaderLead({ leading, children }: { leading?: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      {leading}
      <div>{children}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, leading, actions, wide = false }: SectionHeaderProps) {
  return (
    <div className={`section-heading ${wide ? "section-heading-wide" : ""}`}>
      <SectionHeaderLead leading={leading}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </SectionHeaderLead>
      {actions ? <div className="board-header-actions">{actions}</div> : null}
    </div>
  );
}

export { SectionHeader, SectionHeaderLead };
