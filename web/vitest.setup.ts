import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// jsdom 은 <dialog> 의 showModal/close 를 구현하지 않음(또는 throw stub) → 테스트용으로 무조건 덮어쓴다.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// globals 를 끄고 명시적 import 로 쓰므로 RTL 자동 cleanup 이 등록되지 않는다 → 직접 등록.
afterEach(() => {
  cleanup();
});
