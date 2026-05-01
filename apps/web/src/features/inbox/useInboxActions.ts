import { discardCapturedItem } from "../../api";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type UseInboxActionsOptions = {
  refreshAppData: () => Promise<void>;
  onError: (message: string | null) => void;
};

export function useInboxActions({ refreshAppData, onError }: UseInboxActionsOptions) {
  async function handleDiscardCapture(itemId: string) {
    onError(null);

    try {
      await discardCapturedItem(itemId);
      await refreshAppData();
    } catch (error) {
      onError(toErrorMessage(error, "Could not discard captured item."));
    }
  }

  return {
    handleDiscardCapture,
  };
}
