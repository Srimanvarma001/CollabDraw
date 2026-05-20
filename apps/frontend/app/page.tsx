import { Pencil, Share2, Users2, Sparkles, Github, Download, Layout } from "lucide-react";
import Link from "next/link";

function App() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <header className="relative overflow-hidden">
        <div 
          style={{ 
            position: "absolute", 
            top: "0", 
            left: "50%", 
            transform: "translateX(-50%)",
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)",
            pointerEvents: "none"
          }} 
        />
        <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8 relative">
          <div className="text-center animate-fade-in">
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "100px",
              marginBottom: "24px"
            }}>
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#6366f1"
              }} />
              <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: "500" }}>
                Real-time collaborative whiteboarding
              </span>
            </div>
            
            <h1 
              className="hero-gradient"
              style={{
                fontSize: "clamp(36px, 5vw, 64px)",
                fontWeight: "700",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                marginBottom: "24px"
              }}
            >
              Collaborative Whiteboarding
              <br />
              Made Simple
            </h1>
            <p style={{
              color: "var(--text-secondary)",
              fontSize: "18px",
              maxWidth: "600px",
              margin: "0 auto 40px",
              lineHeight: "1.6"
            }}>
              Create, collaborate, and share beautiful diagrams and sketches with our intuitive drawing tool. 
              No sign-up required for basic use.
            </p>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "16px",
              flexWrap: "wrap"
            }}>
              <Link href={"/signin"}>
                <button className="btn-primary">
                  <Pencil size={16} style={{ marginRight: "8px" }} />
                  Sign in
                </button>
              </Link>
              <Link href="/signup">
                <button className="btn-ghost">
                  Sign up
                </button>
              </Link>
              <Link href="/rooms">
                <button className="btn-ghost">
                  <Layout size={16} style={{ marginRight: "8px" }} />
                  Rooms
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section style={{ 
        padding: "100px 0",
        background: "linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.03) 100%)"
      }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ 
            textAlign: "center",
            marginBottom: "64px"
          }}>
            <h2 style={{
              fontSize: "36px",
              fontWeight: "600",
              color: "var(--text-primary)",
              marginBottom: "16px"
            }}>
              Why CollabDraw?
            </h2>
            <p style={{
              color: "var(--text-muted)",
              fontSize: "16px",
              maxWidth: "500px",
              margin: "0 auto"
            }}>
              Built for teams who want to ideate faster and better
            </p>
          </div>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
            gap: "24px" 
          }}>
            <FeatureCard 
              icon={<Share2 size={24} />}
              iconBg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              title="Real-time Collaboration"
              description="Work together with your team in real-time. Share your drawings instantly with a simple link."
            />

            <FeatureCard 
              icon={<Users2 size={24} />}
              iconBg="linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
              title="Multiplayer Editing"
              description="Multiple users can edit the same canvas simultaneously. See who's drawing what in real-time."
            />

            <FeatureCard 
              icon={<Sparkles size={24} />}
              iconBg="linear-gradient(135deg, #f97316 0%, #ec4899 100%)"
              title="Smart Drawing"
              description="Intelligent shape recognition and drawing assistance helps you create perfect diagrams."
            />
          </div>
        </div>
      </section>

      <section style={{ padding: "100px 0" }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className="card-glass"
            style={{ 
              padding: "80px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{
              position: "absolute",
              top: "0",
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              height: "100%",
              background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)",
              pointerEvents: "none"
            }} />
            
            <div style={{ position: "relative" }}>
              <h2 style={{
                fontSize: "32px",
                fontWeight: "600",
                color: "var(--text-primary)",
                marginBottom: "16px"
              }}>
                Ready to start creating?
              </h2>
              <p style={{
                color: "var(--text-secondary)",
                fontSize: "16px",
                maxWidth: "500px",
                margin: "0 auto 32px"
              }}>
                Join thousands of users who are already creating amazing diagrams and sketches.
              </p>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: "16px",
                flexWrap: "wrap"
              }}>
                <Link href="/rooms">
                  <button className="btn-primary">
                    <Pencil size={16} style={{ marginRight: "8px" }} />
                    Open Canvas
                  </button>
                </Link>
                <button className="btn-ghost">
                  View Gallery
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ 
        borderTop: "1px solid var(--border-subtle)",
        padding: "40px 0"
      }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Pencil size={16} color="white" />
              </div>
              <span style={{ 
                color: "var(--text-primary)", 
                fontWeight: "600",
                fontSize: "16px"
              }}>
                CollabDraw
              </span>
            </div>
            
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              © 2024 CollabDraw. All rights reserved.
            </p>
            
            <div style={{ display: "flex", gap: "24px" }}>
              <a 
                href="https://github.com" 
                style={{ 
                  color: "var(--text-muted)",
                  transition: "color 0.2s"
                }}
              >
                <Github size={20} />
              </a>
              <a 
                href="#" 
                style={{ 
                  color: "var(--text-muted)",
                  transition: "color 0.2s"
                }}
              >
                <Download size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  iconBg, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  iconBg: string;
  title: string; 
  description: string;
}) {
  return (
    <div 
      className="feature-card"
      style={{
        padding: "28px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        transition: "all 0.3s ease",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div 
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          height: "3px",
          background: "transparent",
          transition: "background 0.3s ease"
        }}
        className="feature-card-accent"
      />
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div 
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            flexShrink: 0
          }}
        >
          {icon}
        </div>
        <div>
          <h3 style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "var(--text-primary)",
            marginBottom: "8px"
          }}>
            {title}
          </h3>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
            lineHeight: "1.6"
          }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;