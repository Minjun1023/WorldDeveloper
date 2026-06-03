import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// globals 를 끄고 명시적 import 로 쓰므로 RTL 자동 cleanup 이 등록되지 않는다 → 직접 등록.
afterEach(() => {
  cleanup();
});
