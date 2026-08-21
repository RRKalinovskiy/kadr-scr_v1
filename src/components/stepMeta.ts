import type { StepKind } from "../types";

export const KIND_COLOR: Record<StepKind, string> = {
  click: "#4fe0c4", drag: "#7fb7ff", area: "#ffb454", wait: "#f5d76e", type: "#c9a2ff",
};

export const KIND_LABEL: Record<StepKind, string> = {
  click: "клик", drag: "перетаскивание", area: "область", wait: "ожидание", type: "ввод текста",
};
