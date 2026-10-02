"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { ChatEntry } from "@/draw/shapes";

const MAX_LENGTH = 1000;

export function ChatPanel({ messages, currentUserId, onSend, onClose }: {
    messages: ChatEntry[];
    currentUserId: string | null;
    /** Returns false if the message could not be sent (e.g. offline). */
    onSend: (text: string) => boolean;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages]);

    function send() {
        const text = draft.trim();
        if (!text) return;
        if (onSend(text)) {
            setDraft("");
            setError(null);
        } else {
            setError("You're offline. Your message will be kept here until you're back.");
        }
    }

    return (
        <div
            className="toolbar-glass"
            role="dialog"
            aria-label="Room chat"
            style={{
                position: "fixed",
                right: 16,
                bottom: 16,
                width: "min(340px, calc(100vw - 32px))",
                height: "min(440px, calc(100vh - 120px))",
                zIndex: 1500,
                display: "flex",
                flexDirection: "column",
                borderRadius: 12,
                overflow: "hidden",
                color: "#fff"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Chat</span>
                <button type="button" onClick={onClose} aria-label="Close chat" title="Close chat"
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex" }}>
                    <X size={16} />
                </button>
            </div>

            <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {messages.length === 0 && (
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginTop: 24 }}>
                        No messages yet. Say hi!
                    </div>
                )}
                {messages.map((m) => {
                    const mine = m.userId === currentUserId;
                    return (
                        <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                            {!mine && (
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>{m.userName}</div>
                            )}
                            <div
                                title={new Date(m.sentAt).toLocaleString()}
                                style={{
                                    background: mine ? "#2563eb" : "rgba(255,255,255,0.1)",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    fontSize: 14,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word"
                                }}
                            >
                                {m.text}
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && <div style={{ color: "#fca5a5", fontSize: 12, padding: "0 14px 6px" }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <input
                    aria-label="Message"
                    placeholder="Message"
                    value={draft}
                    maxLength={MAX_LENGTH}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") send();
                        if (e.key === "Escape") onClose();
                    }}
                    autoFocus
                    style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#fff",
                        padding: "8px 10px",
                        fontSize: 14,
                        outline: "none",
                        minWidth: 0
                    }}
                />
                <button type="button" onClick={send} disabled={!draft.trim()} aria-label="Send" title="Send"
                    style={{
                        background: "#3b82f6",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        padding: "0 12px",
                        cursor: draft.trim() ? "pointer" : "not-allowed",
                        opacity: draft.trim() ? 1 : 0.6,
                        display: "flex",
                        alignItems: "center"
                    }}>
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
