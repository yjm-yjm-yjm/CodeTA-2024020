import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homePath, useAuth } from "@/store/auth";
import type { Role } from "@/types";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        nav(homePath(user.role), { replace: true });
      } else {
        const user = await useAuth.getState().register(email, password, role);
        setMode("login");
        setError(`注册成功，请登录（账号：${user.email}，角色：${role}）`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>黑客松立项评审系统</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" ? "登录进入系统" : "注册新账号（演示环境）"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label>角色</Label>
                <div className="flex gap-2">
                  {(["student", "reviewer"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                        role === r
                          ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                          : "border-slate-300"
                      }`}
                    >
                      {r === "student" ? "学生" : "评委"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="w-full text-center text-sm text-indigo-600 hover:underline"
            >
              {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
