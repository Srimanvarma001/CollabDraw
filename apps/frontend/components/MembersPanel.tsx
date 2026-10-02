"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { describeError } from "@/lib/errors";

interface Member {
    userId: string;
    name: string;
    username: string;
}

/** Lets a private room's admin see, invite and remove members. */
export function MembersPanel({ roomId, token }: { roomId: number; token: string }) {
    const [members, setMembers] = useState<Member[] | null>(null);
    const [invitee, setInvitee] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const authHeaders = { "Authorization": `Bearer ${token}` };

    useEffect(() => {
        fetch(`${HTTP_BACKEND}/room/${roomId}/members`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setMembers(data.members ?? []))
            .catch(() => setError("Could not load members"));
    }, [roomId, token]);

    async function invite() {
        if (!invitee.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`${HTTP_BACKEND}/room/${roomId}/members`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ username: invitee.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setMembers(prev => [...(prev ?? []), data.member]);
                setInvitee("");
            } else {
                setError(describeError(data) || "Could not invite");
            }
        } catch {
            setError("Something went wrong");
        }
        setBusy(false);
    }

    async function remove(userId: string) {
        const res = await fetch(`${HTTP_BACKEND}/room/${roomId}/members/${userId}`, {
            method: "DELETE",
            headers: authHeaders
        });
        if (res.ok) {
            setMembers(prev => (prev ?? []).filter(m => m.userId !== userId));
        } else {
            setError(describeError(await res.json()) || "Could not remove member");
        }
    }

    return (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                    type="email"
                    placeholder="Invite by email"
                    aria-label="Invite by email"
                    className="input-dark"
                    style={{ flex: 1 }}
                    value={invitee}
                    onChange={(e) => setInvitee(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && invite()}
                />
                <button className="btn-primary" onClick={invite} disabled={busy || !invitee.trim()} style={{ padding: "8px 14px" }}>
                    <UserPlus size={14} style={{ marginRight: 6 }} />
                    Invite
                </button>
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>{error}</p>}
            {members === null ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading members...</p>
            ) : members.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Only you can open this room. Invite people by the email they signed up with.</p>
            ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {members.map(m => (
                        <li key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, color: "var(--text-secondary)" }}>
                            <span>{m.name} <span style={{ color: "var(--text-muted)" }}>({m.username})</span></span>
                            <button
                                onClick={() => remove(m.userId)}
                                aria-label={`Remove ${m.name}`}
                                title={`Remove ${m.name}`}
                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
