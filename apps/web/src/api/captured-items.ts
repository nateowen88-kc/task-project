import { request } from "./client";
import { toTaskPayload } from "./helpers";
import type { CapturedItem, Task, TaskDraft } from "./types";
import { API_ROUTES } from "../../../../src/shared/api-routes";

function fetchCapturedItems() {
  return request<CapturedItem[]>(API_ROUTES.capturedItems.list);
}

function acceptCapturedItem(id: string, draft: TaskDraft) {
  return request<Task>(API_ROUTES.capturedItems.accept(id), {
    method: "POST",
    body: JSON.stringify(toTaskPayload(draft)),
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
