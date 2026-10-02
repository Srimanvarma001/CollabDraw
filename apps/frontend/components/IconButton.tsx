import { ReactNode } from "react";

export function IconButton({
    icon, onClick, activated, disabled, size = 36, title
}: {
    icon: ReactNode,
    onClick: () => void,
    activated?: boolean,
    disabled?: boolean,
    size?: number,
    /** Shown as a tooltip and read by screen readers. */
    title: string
}) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={activated}
            disabled={disabled}
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                padding: 0,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "8px",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                background: activated 
                    ? "rgba(59, 130, 246, 0.2)" 
                    : "transparent",
                color: disabled 
                    ? "rgba(255, 255, 255, 0.3)" 
                    : activated 
                        ? "#3b82f6" 
                        : "rgba(255, 255, 255, 0.7)",
                border: activated 
                    ? "1px solid rgba(59, 130, 246, 0.3)" 
                    : "1px solid transparent",
                opacity: disabled ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
                if (!disabled && !activated) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled && !activated) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                }
            }}
        >
            {icon}
        </button>
    );
}
