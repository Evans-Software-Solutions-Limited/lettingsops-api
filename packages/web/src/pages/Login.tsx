import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { setToken } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO(G): replace with real POST /auth/login once the backend login
    // endpoint lands. For now we simulate login and store a dev-only
    // placeholder token so the Eden Treaty client sends an Authorization
    // header — enough to test the Block F auth wiring end-to-end in a
    // local dev environment where AUTH_ENFORCED=false.
    setTimeout(() => {
      setToken("dev-placeholder-token");
      setIsLoading(false);
      navigate("/");
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md bg-surface-elevated border border-border">
        <div className="p-8 space-y-6">
          {/* Logo/Wordmark */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent">
              LettingsOps
            </h1>
            <p className="text-sm text-muted-foreground">
              Centralised lettings management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@lettingsagent.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-surface-raised border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-surface-raised border-border"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent-dark text-white"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Demo: Use any email and password
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
