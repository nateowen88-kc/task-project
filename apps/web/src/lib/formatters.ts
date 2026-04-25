function formatDueLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatReminderLabel(value: string | null) {
  if (!value) {
    return "No reminder";
  }

  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatReceivedLabel(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNotificationTime(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export {
  formatDueLabel,
  formatNotificationTime,
  formatReceivedLabel,
  formatReminderLabel,
};
