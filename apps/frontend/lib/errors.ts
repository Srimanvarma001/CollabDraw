const FIELD_LABELS: Record<string, string> = { username: "Email", password: "Password", name: "Name" };

/** Turns a `{ message, errors: { field: [msg] } }` API response into readable text. */
export function describeError(data: { message?: string; errors?: Record<string, string[] | undefined> }): string | undefined {
    const fieldErrors = Object.entries(data.errors ?? {})
        .filter(([, msgs]) => msgs && msgs.length > 0)
        .map(([field, msgs]) => `${FIELD_LABELS[field] ?? field}: ${msgs![0]}`);
    return fieldErrors.length > 0 ? fieldErrors.join("\n") : data.message;
}
