import { createDemoSlackCapture, discardCapturedItem } from "../../api";

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

  async function handleCreateDemoSlackCapture() {
    onError(null);

    try {
      await createDemoSlackCapture();
      await refreshAppData();
    } catch (error) {
      onError(toErrorMessage(error, "Could not create Slack capture."));
    }
  }

  return {
    handleDiscardCapture,
    handleCreateDemoSlackCapture,
  };
}
