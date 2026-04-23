import { useState } from "react";
import type { TodayItem } from "../../api";
import type { AppView } from "./app-shell";

type UseFocusModeOptions = {
  setActiveView: React.Dispatch<React.SetStateAction<AppView>>;
  onError: (message: string | null) => void;
};

export function useFocusMode({ setActiveView, onError }: UseFocusModeOptions) {
  const [focusedItemKey, setFocusedItemKey] = useState<string | null>(null);

  function startFocus(item: TodayItem) {
    setFocusedItemKey(`${item.sourceType}:${item.id}`);
    setActiveView("focus");
    onError(null);
  }

  function exitFocusMode() {
    setFocusedItemKey(null);
    setActiveView("agenda");
  }

  function moveToNextFocusItem(currentItem: TodayItem, sortedAgendaItems: TodayItem[]) {
    const currentKey = `${currentItem.sourceType}:${currentItem.id}`;
    const nextItem = sortedAgendaItems.find(
      (item) => item.status !== "done" && `${item.sourceType}:${item.id}` !== currentKey,
    );

    if (nextItem) {
      setFocusedItemKey(`${nextItem.sourceType}:${nextItem.id}`);
      setActiveView("focus");
      return;
    }

    exitFocusMode();
  }

  return {
    focusedItemKey,
    startFocus,
    exitFocusMode,
    moveToNextFocusItem,
  };
}
