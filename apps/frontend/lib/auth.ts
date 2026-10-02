/** Reads the user id from the stored token (no verification; display use only). */
export function getCurrentUserId(): string | null {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
        return typeof payload.userId === "string" ? payload.userId : null;
    } catch {
        return null;
    }
}
