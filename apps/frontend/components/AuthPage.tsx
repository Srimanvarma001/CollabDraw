"use client";

import { useState } from "react";
import { HTTP_BACKEND } from "@/config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Eye, EyeOff } from "lucide-react";

export function AuthPage({ isSignin, returnUrl }: {
    isSignin: boolean
    returnUrl?: string
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
                    router.push(returnUrl || "/rooms");
                } else {
                    alert("Account created! Please sign in.");
                    router.push("/signin");
                }
            } else {
                alert(data.message || "Authentication failed");
            }
        } catch {
            alert("Something went wrong");
        }
        setLoading(false);
    }

    return (
        <div className="auth-page-wrapper">
            <div className="auth-card">
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        width: "56px", 
                        height: "56px", 
                        borderRadius: "16px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        marginBottom: "16px"
                    }}>
                        <Pencil size={28} color="white" />
                    </div>
                    <h1 style={{ 
                        fontSize: "28px", 
                        fontWeight: "700", 
                        color: "var(--text-primary)",
                        marginBottom: "8px"
                    }}>
                        {isSignin ? "Welcome Back" : "Create Account"}
                    </h1>
                    <p style={{ 
                        color: "var(--text-muted)", 
                        fontSize: "14px" 
                    }}>
                        {isSignin ? "Sign in to continue to your workspace" : "Start creating with your team"}
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {!isSignin && (
                        <div>
                            <label style={{ 
                                display: "block", 
                                color: "var(--text-secondary)", 
                                fontSize: "13px", 
                                marginBottom: "8px",
                                fontWeight: "500"
                            }}>
                                Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                className="input-dark"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ 
                            display: "block", 
                            color: "var(--text-secondary)", 
                            fontSize: "13px", 
                            marginBottom: "8px",
                            fontWeight: "500"
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="input-dark"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={{ 
                            display: "block", 
                            color: "var(--text-secondary)", 
                            fontSize: "13px", 
                            marginBottom: "8px",
                            fontWeight: "500"
                        }}>
                            Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="input-dark"
                                style={{ paddingRight: "44px" }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: "absolute",
                                    right: "12px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        className="btn-primary auth-submit-btn"
                        style={{ 
                            width: "100%", 
                            marginTop: "8px",
                            height: "48px",
                            fontSize: "15px"
                        }}
                        onClick={handleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="animate-pulse">Loading...</span>
                            </span>
                        ) : (
                            isSignin ? "Sign In" : "Create Account"
                        )}
                    </button>
                </div>

                <div className="auth-switch-link">
                    {isSignin ? (
                        <>
                            Do not have an account?{" "}
                            <Link 
                                href="/signup" 
                                style={{ 
                                    color: "#3b82f6", 
                                    fontWeight: "500",
                                    textDecoration: "none"
                                }}
                            >
                                Sign up
                            </Link>
                        </>
                    ) : (
                        <>
                            Already have an account?{" "}
                            <Link 
                                href="/signin" 
                                style={{ 
                                    color: "#3b82f6", 
                                    fontWeight: "500",
                                    textDecoration: "none"
                                }}
                            >
                                Sign in
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}