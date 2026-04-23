type TodayCalendarBadgeProps = {
  month: string;
  day: number;
  weekday?: string;
  size?: "sm" | "md";
  showWeekday?: boolean;
};

function TodayCalendarBadge({
  month,
  day,
  weekday,
  size = "md",
  showWeekday = true,
}: TodayCalendarBadgeProps) {
  return (
    <div
      className="calendar-badge"
      style={{
        width: size === "sm" ? "42px" : "56px",
        borderRadius: size === "sm" ? "16px" : "18px",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 244, 250, 0.94))",
        border: "1px solid rgba(89, 108, 122, 0.18)",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        className="calendar-month"
        style={{
          width: "100%",
          background: "linear-gradient(180deg, #e15959, #d64545)",
          color: "#ffffff",
          fontSize: size === "sm" ? "8px" : "10px",
          fontWeight: 700,
          textAlign: "center",
          padding: size === "sm" ? "3px 0" : "4px 0",
          letterSpacing: "0.06em",
        }}
      >
        {month}
      </span>
      <span
        className="calendar-day"
        style={{
          fontSize: size === "sm" ? "14px" : "18px",
          fontWeight: 700,
          padding: size === "sm" ? "5px 0" : "7px 0",
          color: "#24313a",
          lineHeight: 1,
        }}
      >
        {day}
      </span>
      {showWeekday && weekday ? <span className="calendar-day-label">{weekday}</span> : null}
    </div>
  );
}

export type { TodayCalendarBadgeProps };
export { TodayCalendarBadge };
