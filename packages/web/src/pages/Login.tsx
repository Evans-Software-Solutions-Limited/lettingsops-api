import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconHome } from "@tabler/icons-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Mock authentication - in production, call your auth API
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Redirect to dashboard on success
      navigate("/");
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#12141f] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e2130] border border-[#2a2d3e] rounded-2xl p-8 space-y-6">
        {/* Logo Section */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <IconHome size={24} className="text-indigo-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">LettingsOps</h1>
          <p className="text-sm text-[#8b8fa8]">
            Manage your lettings business
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-medium text-[#e8e9f0]"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#12141f] border-[#2a2d3e] text-[#e8e9f0] placeholder-[#8b8fa8] focus:border-indigo-500 focus:ring-indigo-500/20"
              required
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-[#e8e9f0]"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#12141f] border-[#2a2d3e] text-[#e8e9f0] placeholder-[#8b8fa8] focus:border-indigo-500 focus:ring-indigo-500/20"
              required
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 h-10 mt-6"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-[#8b8fa8] border-t border-[#2a2d3e] pt-6">
          <p>Demo credentials available on request</p>
        </div>
      </div>
    </div>
  );
}
