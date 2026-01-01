import { useState, useEffect, useMemo } from "react";

// Task 3.1.1: Create useVirtualScroll hook for large dataset performance
export interface VirtualScrollItem {
    id: string;
    data: any;
    height: number;
}

export interface VirtualScrollResult {
    visibleItems: VirtualScrollItem[];
    totalHeight: number;
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
    const [containerRef, setContainerRef] = useState<any>(null);
    
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
        const startIdx = Math.floor(scrollTop / itemHeight) + startIndex;
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 1; // Add buffer
        const endIdx = Math.min(startIdx + visibleCount, virtualItems.length);
        
        return {
            start: Math.max(0, startIdx),
            end: Math.min(virtualItems.length - 1, endIdx),
            count: endIdx - startIdx + 1
        };
    }, [scrollTop, itemHeight, containerHeight, virtualItems.length, startIndex]);

    const visibleItems = useMemo(() => {
        return virtualItems.slice(visibleRange.start, visibleRange.end + 1);
    }, [virtualItems, visibleRange]);

    const totalHeight = virtualItems.length * itemHeight;

    // Handle scroll events
    const handleScroll = (e: any) => {
        const newScrollTop = e.target.scrollTop;
        setScrollTop(newScrollTop);
    };

    // Initialize container ref and scroll position
    useEffect(() => {
        const container = containerRef;
        if (container) {
            container.scrollTop = scrollTop;
        }
    }, [containerRef, scrollTop]);

    return {
        visibleItems,
        totalHeight,
        scrollProps: {
            scrollTop,
            onScroll: handleScroll
        }
    };
};

// Utility for scroll position management
export const scrollToIndex = (
    containerRef: any,
    itemHeight: number,
    index: number,
    duration: number = 300
) => {
    const container = containerRef;
    if (!container) return;

    const targetScrollTop = index * itemHeight;
    const startScrollTop = container.scrollTop;
    const distance = Math.abs(targetScrollTop - startScrollTop);
    
    // Simple smooth scroll animation
    const startTime = Date.now();
    const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentScrollTop = startScrollTop + (distance * progress);
        container.scrollTop = currentScrollTop;
        
        if (progress < 1) {
            requestAnimationFrame(animateScroll);
        }
    };
    
    requestAnimationFrame(animateScroll);
};

// Performance optimization: calculate optimal item height
export const calculateOptimalHeight = (
    items: any[],
    minVisibleItems: number = 5
): number => {
    // Calculate based on available height and desired visible items
    // This can be tuned based on typical content
    return Math.max(50, Math.min(100, Math.floor(600 / minVisibleItems)));
};