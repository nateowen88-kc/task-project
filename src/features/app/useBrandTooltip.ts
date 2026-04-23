import { useRef, useState } from "react";

export function useBrandTooltip() {
  const [isBrandTooltipVisible, setIsBrandTooltipVisible] = useState(false);
  const [brandTooltipPosition, setBrandTooltipPosition] = useState({ left: 72, top: 80 });
  const brandMarkRef = useRef<HTMLSpanElement>(null);

  function showBrandTooltip() {
    if (brandMarkRef.current) {
      const rect = brandMarkRef.current.getBoundingClientRect();
      setBrandTooltipPosition({ left: rect.right + 12, top: rect.top + rect.height / 2 });
    }

    setIsBrandTooltipVisible(true);
  }

  function hideBrandTooltip() {
    setIsBrandTooltipVisible(false);
  }

  return {
    isBrandTooltipVisible,
    brandTooltipPosition,
    brandMarkRef,
    showBrandTooltip,
    hideBrandTooltip,
  };
}
