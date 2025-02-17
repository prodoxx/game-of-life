import createRoomView from "./create-room-view.html?raw";
import joinRoomView from "./join-room-view.html?raw";
import joinFormView from "./join-form-view.html?raw";

export const templates = {
  "create-room-view": createRoomView,
  "join-room-view": joinRoomView,
  "join-form-view": joinFormView,
} as const;

export type TemplateName = keyof typeof templates;
