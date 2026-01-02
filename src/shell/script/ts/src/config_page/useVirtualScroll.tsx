import { useState, useMemo } from "react";
import * as shell from "mshell";


export interface VirtualScrollItem {
    id: string;
    data: any;
    height: number;
}

export interface VirtualScrollResult {
    visibleItems: VirtualScrollItem[];
    totalHeight: number;
    paddingTop: number;
    paddingBottom: number;
    scrollProps: {
        scrollTop: number;
        onScroll: (scrollTop: number) => void;
    };
}

export const useVirtualScroll = (
    items: any[],
    itemHeight: number,
    containerHeight: number,
    startIndex: number = 0
): VirtualScrollResult => {
    const [scrollTop, setScrollTop] = useState(0);
    // Convert items to virtual scroll items
    const virtualItems: VirtualScrollItem[] = useMemo(() => {
        return items.map((item, index) => ({
            id: typeof item === 'string' ? item : item.name || `item-${index}`,
            data: item,
            height: itemHeight
        }));
    }, [items, itemHeight]);

    // Calculate visible range
    const visibleRange = useMemo(() => {
        const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) + startIndex);
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 1; // Add buffer
        // Clamp endIdx to valid range
        const clampedEnd = Math.min(virtualItems.length - 1, startIdx + visibleCount - 1);

        return {
            start: startIdx,
            end: clampedEnd,
            count: Math.max(0, clampedEnd - startIdx + 1)
        };
    }, [scrollTop, itemHeight, containerHeight, virtualItems.length, startIndex]);

    const visibleItems = useMemo(() => {
        if (visibleRange.count === 0) return [];
        return virtualItems.slice(visibleRange.start, visibleRange.end + 1);
    }, [virtualItems, visibleRange]);

    const totalHeight = virtualItems.length * itemHeight;

    // Calculate padding for virtual scrolling
    const paddingTop = visibleRange.start * itemHeight;
    const paddingBottom = Math.max(0, totalHeight - paddingTop - (visibleItems.length * itemHeight));

    // Handle scroll events
    const handleScroll = (newScrollTop: number) => {
        setScrollTop(newScrollTop);
    };

    return {
        visibleItems,
        totalHeight,
        paddingTop,
        paddingBottom,
        scrollProps: {
            scrollTop,
            onScroll: handleScroll
        }
    };
};

// Interface for scroll container
interface ScrollContainer {
    scrollTop: number;
}

// Utility for scroll position management
export const scrollToIndex = (
    containerRef: ScrollContainer | null,
    itemHeight: number,
    index: number,
    duration: number = 300
) => {
    const container = containerRef;
    if (!container) return;

    const targetScrollTop = index * itemHeight;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    // Simple smooth scroll animation
    const startTime = Date.now();
    const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentScrollTop = startScrollTop + (distance * progress);
        container.scrollTop = currentScrollTop;

        if (progress < 1) {
            shell.infra.setTimeout(animateScroll, 16);
        }
    };

    shell.infra.setTimeout(animateScroll, 16);
};