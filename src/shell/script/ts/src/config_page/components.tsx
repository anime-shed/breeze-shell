import { breeze } from "mshell";
import { useHoverActive, useTextTruncation } from "./utils";
import { type ReactNode } from "react";
import { ICON_MORE_VERT } from "./constants";
import { t } from "../shared/i18n";

import { memo, } from "react";

// Task 1.4.2: Animation queuing system to limit simultaneous animations
const animationQueue = new Set<string>();
const animationTimeouts = new Map<string, number>();
const MAX_CONCURRENT_ANIMATIONS = 3;

const shouldQueueAnimation = (elementId: string) => {
    if (animationQueue.size >= MAX_CONCURRENT_ANIMATIONS) {
        return false; // Skip animation if too many running
    }
    // Clear any existing timeout for this element
    if (animationTimeouts.has(elementId)) {
        clearTimeout(animationTimeouts.get(elementId));
    }
    animationQueue.add(elementId);
    const timeoutId = window.setTimeout(() => {
        animationQueue.delete(elementId);
        animationTimeouts.delete(elementId);
    }, 300);
    animationTimeouts.set(elementId, timeoutId);
    return true;
};

// Task 1.4.3: Frame rate limiting for complex animations
let lastFrameTime = 0;
const MIN_FRAME_INTERVAL = 16; // ~60fps

const shouldAnimate = () => {
    const now = Date.now();
    if (now - lastFrameTime < MIN_FRAME_INTERVAL) {
        return false; // Skip this frame to maintain 60fps
    }
    lastFrameTime = now;
    return true;
};

// Cleanup function to prevent memory leaks
export const cleanupAnimations = () => {
    // Clear all pending timeouts
    for (const timeoutId of animationTimeouts.values()) {
        clearTimeout(timeoutId);
    }
    // Clear the maps and sets
    animationTimeouts.clear();
    animationQueue.clear();
    // Reset frame timing
    lastFrameTime = 0;
};

// Icon element creator
export const iconElement = (svg: string, width = 14) => (
    <img
        svg={svg.replace(
            '<svg ',
            `<svg fill="${breeze.is_light_theme() ? '#000000ff' : '#ffffffff'}" `
        )}
        width={width}
        height={width}
        alt=""
    />
);

// Simple Markdown Renderer
export const SimpleMarkdownRender = ({ text, maxWidth }: { text: string, maxWidth: number }) => {
    return (
        <>
            {text.split('\n').map((line, index) => (
                line.trim().startsWith('# ') ? <Text key={index} fontSize={22} maxWidth={maxWidth}>{line.trim().substring(2).trim()}</Text> :
                    line.trim().startsWith('## ') ? <Text key={index} fontSize={20} maxWidth={maxWidth}>{line.trim().substring(3).trim()}</Text> :
                        line.trim().startsWith('### ') ? <Text key={index} fontSize={18} maxWidth={maxWidth}>{line.trim().substring(4).trim()}</Text> :
                            line.trim().startsWith('#### ') ? <Text key={index} fontSize={16} maxWidth={maxWidth}>{line.trim().substring(5).trim()}</Text> :
                                <Text key={index} fontSize={14} maxWidth={maxWidth}>{line}</Text>
            ))}
        </>
    );
};

// Task 2.3.1: Update Button component with responsive sizing
export const Button = memo(({
    onClick,
    children,
    selected,
    responsive,
    scale = 1.0,
    disabled
}: {
    onClick: () => void;
    children: ReactNode;
    selected?: boolean;
    responsive?: boolean;
    scale?: number;
    disabled?: boolean;
}) => {
    const isLightTheme = breeze.is_light_theme()
    const { isHovered, isActive, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp } = useHoverActive();

    const handleClick = () => {
        if (!disabled) {
            onClick();
        }
    };

    return (
        <flex
            onClick={handleClick}
            backgroundColor={
                disabled ? (isLightTheme ? '#e0e0e0aa' : '#404040aa') :
                    isActive ? (isLightTheme ? '#c0c0c0cc' : '#505050cc') :
                        isHovered ? (isLightTheme ? '#e0e0e0cc' : '#606060cc') :
                            (isLightTheme ? '#f0f0f0cc' : '#404040cc')
            }

            borderRadius={responsive ? Math.round(8 * scale) : 8}
            paddingLeft={responsive ? Math.round(12 * scale) : 12}
            paddingRight={responsive ? Math.round(12 * scale) : 12}
            paddingTop={responsive ? Math.round(8 * scale) : 8}
            paddingBottom={responsive ? Math.round(8 * scale) : 8}
            autoSize={true}
            justifyContent="center"
            alignItems="center"
            horizontal
            gap={responsive ? Math.round(6 * scale) : 6}
            borderWidth={selected ? (responsive ? Math.round(2 * scale) : 2) : 0}
            borderColor="#2979FF"
            onMouseEnter={!disabled ? onMouseEnter : undefined}
            onMouseLeave={!disabled ? onMouseLeave : undefined}
            onMouseDown={!disabled ? onMouseDown : undefined}
            onMouseUp={!disabled ? onMouseUp : undefined}
            animatedVars={['.r', '.g', '.b', '.a']}
        >
            {children}
        </flex>
    );
});

export const Text = memo(({
    children,
    fontSize = 14,
    maxWidth = -1
}: {
    children: string;
    fontSize?: number;
    maxWidth?: number;
}) => {
    const isLightTheme = breeze.is_light_theme();
    return (
        <text
            text={children}
            fontSize={fontSize}
            maxWidth={maxWidth}
            color={isLightTheme ? '#000000ff' : '#ffffffff'}
        />
    );
});

export const TextButton = memo(({
    onClick,
    children,
    icon
}: {
    onClick: () => void;
    children: string;
    icon?: string;
}) => {
    return (
        <Button onClick={onClick}>
            {
                icon ? iconElement(icon, 14) : null
            }
            <Text fontSize={14}>{children}</Text>
        </Button>
    );
});

// Task 2.3.2: Add responsive props to Toggle component
export const Toggle = ({
    label,
    value,
    onChange,
    responsive = false,
    scale = 1.0
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    responsive?: boolean;
    scale?: number;
}) => {
    const isLightTheme = breeze.is_light_theme();
    const {
        isHovered, isActive, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp
    } = useHoverActive();

    // Generate unique ID for animation queuing
    const toggleId = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <flex horizontal alignItems="center" gap={10} justifyContent="space-between">
            <Text>{label}</Text>
            <flex
                width={responsive ? Math.round(40 * scale) : 40}
                height={responsive ? Math.round(20 * scale) : 20}
                borderRadius={responsive ? Math.round(10 * scale) : 10}
                backgroundColor={value ? '#0078D4' :
                    isHovered ?
                        (isLightTheme ? '#CCCCCCAA' : '#555555AA') :
                        (isLightTheme ? '#CCCCCC77' : '#55555577')}
                justifyContent={value ? 'end' : 'start'}
                horizontal
                alignItems="center"
                onClick={() => {
                    // Always update state - never discard user input
                    onChange(!value);
                    
                    // Only apply animation logic when shouldAnimate() returns true
                    // This preserves frame-rate throttling for visuals while ensuring
                    // state changes are never blocked
                    if (shouldAnimate()) {
                        // Animation will be handled by animatedVars below
                        // The queue check happens in animatedVars calculation
                    }
                }}
                autoSize={false}
                padding={
                    (isHovered || isActive) ? 2 : 3
                }
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                // Task 1.4.2: Apply animation queuing - only animate when shouldAnimate() allows
                animatedVars={shouldAnimate() && shouldQueueAnimation(toggleId) ? ['.r', '.a'] : []}
                borderWidth={0.5}
                borderColor={value ? '#00000000' : (isLightTheme ? '#5A5A5A5' : '#CECDD0')}
            >
                <flex
                    width={responsive ? Math.round((isActive ? 19 : isHovered ? 16 : 14) * scale) : (isActive ? 19 : isHovered ? 16 : 14)}
                    height={responsive ? Math.round(((isHovered || isActive) ? 16 : 14) * scale) : ((isHovered || isActive) ? 16 : 14)}
                    borderRadius={responsive ? Math.round(8 * scale) : 8}
                    backgroundColor={value ? (isLightTheme ? '#FFFFFF' : '#000000') : (isLightTheme ? '#5A5A5A' : '#CECDD0')}
                    // Task 1.4.3: Apply frame rate limiting - only animate when both conditions allow
                    animatedVars={shouldAnimate() && shouldQueueAnimation(toggleId + '-thumb') ? ['x'] : []}
                    autoSize={false}
                />
            </flex>
        </flex>
    );
}

// Task 2.3.3: Add responsive props to SidebarItem
export const SidebarItem = memo(({
    onClick,
    icon,
    isActive,
    children,
    responsive = false,
    scale = 1.0
}: {
    onClick: () => void;
    icon: string;
    isActive: boolean;
    children: string;
    responsive?: boolean;
    scale?: number;
}) => {
    const isLightTheme = breeze.is_light_theme();
    const { isHovered, isActive: isPressed, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp } = useHoverActive();
    return (
        <flex
            onClick={onClick}
            backgroundColor={
                isActive ? (isLightTheme ? '#c0c0c077' : '#50505077') :
                    isPressed ? (isLightTheme ? '#c0c0c0cc' : '#505050cc') :
                        isHovered ? (isLightTheme ? '#e0e0e0cc' : '#606060cc') :
                            (isLightTheme ? '#e0e0e000' : '#60606000')
            }
            paddingLeft={0}
            paddingRight={12}
            paddingTop={8}
            paddingBottom={8}
            autoSize={false}
            height={responsive ? Math.round(32 * scale) : 32}
            justifyContent="start"
            alignItems="center"
            horizontal
            gap={6}
            borderRadius={6}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            animatedVars={['.r', '.g', '.b', '.a']}
        >
            <flex width={3} height={isActive ? 15 : 0} backgroundColor={isActive ? '#2979FF' : '#00000000'}
                borderRadius={3} autoSize={false} animatedVars={['.a', 'height']} />
            {iconElement(icon, 14)}
            <Text fontSize={14}>{children}</Text>
        </flex>
    );
});

export const PluginCheckbox = memo(({ isEnabled, onToggle }: { isEnabled: boolean; onToggle: () => void }) => {
    const isLightTheme = breeze.is_light_theme();
    const { isHovered, isActive, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp } = useHoverActive();
    return (
        <flex
            width={20}
            height={20}
            borderRadius={4}
            borderWidth={1}
            borderColor={isLightTheme ? '#CCCCCC' : '#555555'}
            backgroundColor={isEnabled ? (isActive ? '#1E5F99' : isHovered ? '#3F7FBF' : '#2979FF') :
                (isActive ? (isLightTheme ? '#c0c0c0cc' : '#505050cc') :
                    isHovered ? (isLightTheme ? '#e0e0e0cc' : '#606060cc') :
                        (isLightTheme ? '#e0e0e066' : '#60606066'))}
            justifyContent="center"
            alignItems="center"
            onClick={onToggle}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            animatedVars={['.r', '.g', '.b', '.a']}
        >
            {isEnabled ? (
                <img
                    svg={`<svg viewBox="0 0 24 24"><path fill="${isLightTheme ? '#000000' : '#FFFFFF'}" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 17.59 13.41 12z"/></svg>`}
                    width={14}
                    height={14}
                    alt=""
                />
            ) : (
                <flex width={14} height={14} autoSize={false} />
            )}
        </flex>
    );
});

export const PluginMoreButton = memo(({ onClick, responsive = false, scale = 1.0 }: { onClick: () => void; responsive?: boolean; scale?: number; }) => {
    const isLightTheme = breeze.is_light_theme();
    const { isHovered, isActive, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp } = useHoverActive();
    return (
        <flex
            width={responsive ? Math.round(32 * scale) : 32}
            height={responsive ? Math.round(32 * scale) : 32}
            borderRadius={responsive ? Math.round(16 * scale) : 16}
            justifyContent="center"
            alignItems="center"
            backgroundColor={isActive ? (isLightTheme ? '#c0c0c0cc' : '#505050cc') :
                isHovered ? (isLightTheme ? '#e0e0e0cc' : '#606060cc') :
                    '#00000000'}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            animatedVars={['.r', '.g', '.b', '.a']}
        >
            {iconElement(ICON_MORE_VERT, 16)}
        </flex>
    );
});

export const PluginItem = memo(({
    name,
    isEnabled,
    isPrioritized,
    onToggle,
    onMoreClick
}: {
    name: string;
    isEnabled: boolean;
    isPrioritized: boolean;
    onToggle: () => void;
    onMoreClick: (name: string) => void;
}) => {
    // Move hook call to top level
    const truncatedName = useTextTruncation(name, 200);

    return (
        <flex
            horizontal
            alignItems="center"
            gap={12}
            padding={12}
            borderRadius={8}
        >
            <flex
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={isEnabled ? '#4CAF50' : '#9E9E9E'}
                autoSize={false}
            />
            <flex flexGrow={1}>
                {/* Task 2.2.3: Add text truncation for plugin names */}
                <Text fontSize={14} maxWidth={200}>
                    {truncatedName}
                </Text>
                {isPrioritized && (
                    <flex padding={4}>
                        <Text fontSize={10}>{t("settings.priority_load_plugins")}</Text>
                    </flex>
                )}
            </flex>

            <spacer />
            <PluginCheckbox isEnabled={isEnabled} onToggle={onToggle} />
            <PluginMoreButton onClick={() => onMoreClick(name)} />
        </flex>
    );
});