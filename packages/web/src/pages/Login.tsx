import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO(auth-login): replace with real POST /auth/login once the backend
    // login endpoint lands. Until then, navigate without storing a token so
    // requests pass through anonymously in soft mode (AUTH_ENFORCED=false).
    // Do NOT store a placeholder string — the auth plugin treats any Bearer
    // value as a JWT and will throw 401 on a malformed token.
    setTimeout(() => {
      setIsLoading(false);
      navigate("/");
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden">
      {/* Subtle radial gradient backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

      <Card className="relative w-full max-w-sm bg-surface-elevated border border-border shadow-2xl shadow-black/20">
        <div className="p-8 space-y-6">
          {/* Logo/Wordmark */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-semibold bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent tracking-tight">
              LettingsOps
            </h1>
            <p className="text-xs text-muted-foreground">
              Centralised lettings management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@lettingsagent.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-surface border-border h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-surface border-border h-9"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent-dark text-white h-9 mt-2"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-[11px] text-muted-foreground">
            Demo: Use any email and password
          </p>
        </div>
      </Card>
    </div>
  );
}
