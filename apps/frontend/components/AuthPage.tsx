"use client";

import { useState } from "react";
import { HTTP_BACKEND } from "@/config";
import { useRouter } from "next/navigation";

export function AuthPage({ isSignin }: {
    isSignin: boolean
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleAuth() {
        setLoading(true);
        try {
            const endpoint = isSignin ? "/signin" : "/signup";
            const body: Record<string, string> = { username: email, password };
            if (!isSignin) body.name = name;

            const res = await fetch(`${HTTP_BACKEND}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                if (isSignin) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("userName", email.split("@")[0] || "User");
                    router.push("/canvas/test-room");
                } else {
                    alert("Account created! Please sign in.");
                    router.push("/signin");
                }
            } else {
                alert(data.message || "Authentication failed");
            }
        } catch (e) {
            alert("Something went wrong");
        }
        setLoading(false);
    }

    return <div className="w-screen h-screen flex justify-center items-center">
        <div className="p-6 m-2 bg-white rounded shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">
                {isSignin ? "Sign In" : "Sign Up"}
            </h2>
            {!isSignin && (
                <div className="p-2 mb-2">
                    <input
                        type="text"
                        placeholder="Name"
                        className="w-full p-2 border rounded"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
            )}
            <div className="p-2 mb-2">
                <input
                    type="email"
                    placeholder="Email"
                    className="w-full p-2 border rounded"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div className="p-2 mb-4">
                <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-2 border rounded"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <div className="flex justify-center">
                <button
                    className="bg-blue-500 text-white rounded p-2 px-6 hover:bg-blue-600"
                    onClick={handleAuth}
                    disabled={loading}
                >
                    {loading ? "..." : isSignin ? "Sign in" : "Sign up"}
                </button>
            </div>
        </div>
    </div>
}