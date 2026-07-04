"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 트리거 위치에 맞춰 뜨는 팝오버 — document.body 로 포털 렌더해 조상의 overflow/stacking 에
// 영향받지 않는다(테이블·카드 안에서도 안 잘리고 항상 위에). 스크롤/리사이즈 시 위치 재계산.
export function AnchoredPopover({
  open,
  onClose,
  anchorRef,
  align = "right",
  width,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
  width?: number;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 위치 계산 + 스크롤/리사이즈 추적(포털은 rect 준비 전 null 반환이라 깜빡임 없음).
  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  // 바깥 클릭 시 닫기(트리거·메뉴 밖).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(t) &&
        anchorRef.current && !anchorRef.current.contains(t)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  // 키보드 접근성: 열리면 메뉴 첫 항목으로 포커스, 닫히면 트리거로 복귀.
  // rect 준비 후에야 포털이 마운트되므로 rect 를 의존성에 포함한다.
  useEffect(() => {
    if (!open || !rect) return;
    const anchor = anchorRef.current;
    const raf = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])")
        ?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      anchor?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rect 준비 시점 1회만
  }, [open, !rect, anchorRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  // ↑/↓ 로 메뉴 항목 간 포커스 이동(순환).
  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>("button, [href]") ?? []),
    ];
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    zIndex: 60,
    ...(align === "right"
      ? { right: Math.max(8, window.innerWidth - rect.right) }
      : { left: Math.max(8, rect.left) }),
    ...(width ? { width } : { minWidth: rect.width }),
  };

  return createPortal(
    <div ref={menuRef} style={style} onKeyDown={onKeyNav}>
      {children}
    </div>,
    document.body,
  );
}
