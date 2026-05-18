import { request } from "./client";
import { toTaskPayload } from "./helpers";
import type { CapturedItem, CapturedItemAcceptPayload, Task, TaskDraft } from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchCapturedItems() {
  return request<CapturedItem[]>(API_ROUTES.capturedItems.list);
}

function acceptCapturedItem(
  id: string,
  draft: TaskDraft,
  options?: {
    directReportId?: string | null;
    createOneOnOneTalkingPoint?: boolean;
    oneOnOneTalkingPoint?: string | null;
  },
) {
  const payload: CapturedItemAcceptPayload = {
    ...toTaskPayload(draft),
    directReportId: options?.directReportId ?? null,
    createOneOnOneTalkingPoint: options?.createOneOnOneTalkingPoint ?? false,
    oneOnOneTalkingPoint: options?.oneOnOneTalkingPoint ?? null,
  };

  return request<Task>(API_ROUTES.capturedItems.accept(id), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function discardCapturedItem(id: string) {
  return request<CapturedItem>(API_ROUTES.capturedItems.discard(id), {
    method: "PATCH",
  });
}

export {
  acceptCapturedItem,
  discardCapturedItem,
  fetchCapturedItems,
};
