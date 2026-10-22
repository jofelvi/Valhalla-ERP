import { useState } from 'react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';

interface HoverItem {
  name: string;
  quantity: number;
  total: number;
}

interface HoverPreview {
  account: AccountReceivable;
  items: HoverItem[];
  totalItems: number;
  loading: boolean;
}

export const useHoverPreview = () => {
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const computeTooltipPos = (
    e: React.MouseEvent<HTMLElement>,
    itemsLen: number,
  ): { top: number; left: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = Math.min(420, 140 + itemsLen * 28);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    let left = rect.right + 10;
    if (left + tooltipWidth > viewportWidth - margin) {
      left = Math.max(margin, rect.left - tooltipWidth - 10);
    }
    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    if (top + tooltipHeight > viewportHeight - margin) {
      top = viewportHeight - tooltipHeight - margin;
    }
    if (top < margin) top = margin;
    return { top, left };
  };

  const handleRowEnter = (
    e: React.MouseEvent<HTMLElement>,
    account: AccountReceivable & { orderItems?: HoverItem[] },
  ) => {
    const items: HoverItem[] = account.orderItems || [];
    setTooltipPos(computeTooltipPos(e, items.length || 1));
    setHoverPreview({
      account,
      items,
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      loading: false,
    });
  };

  const handleRowLeave = () => {
    setHoverPreview(null);
  };

  return {
    hoverPreview,
    setHoverPreview,
    tooltipPos,
    setTooltipPos,
    handleRowEnter,
    handleRowLeave,
  };
};
