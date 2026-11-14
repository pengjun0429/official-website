import { toChineseError } from "@/lib/errorMessage";
import { apiFetch, discordOAuthStartUrl } from "@/lib/api";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, KeyRound, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import './css/styles.css'

const DISCORD_MESSAGES: Record<string, { zh: string; en: string }> = {
  connected: { zh: "Discord 帳戶已連結至目前的 FUMO 帳戶。", en: "Discord account connected to your FUMO account." },
  login: { zh: "已使用 Discord 登入。", en: "Signed in with Discord." },
  id_not_registered: { zh: "此 Discord ID 不在 FUMO 註冊名單中，請先聯絡管理員加入。", en: "This Discord ID is not in the FUMO registration list. Ask an administrator to add it first." },
  discord_id_mismatch: { zh: "此 Discord 帳戶與目前 FUMO 帳戶的註冊 ID 不一致。", en: "This Discord account does not match the registration ID for the current FUMO account." },
  discord_already_linked: { zh: "此 Discord 帳戶已連結至另一個 FUMO 帳戶。", en: "This Discord account is already linked to another FUMO account." },
  account_already_linked: { zh: "目前 FUMO 帳戶已連結其他 Discord 帳戶。", en: "This FUMO account is already linked to a different Discord account." },
  session_changed: { zh: "連結期間登入狀態已變更，請重新登入後再試。", en: "Your sign-in changed during linking. Sign in again and try once more." },
  sign_in_first: { zh: "請先登入 FUMO 帳戶，再連結 Discord。", en: "Sign in to your FUMO account before linking Discord." },
  not_configured: { zh: "Discord 登入尚未設定完成，請聯絡管理員。", en: "Discord sign-in is not configured yet. Contact an administrator." },
  denied: { zh: "你已取消 Discord 授權。", en: "Discord authorization was cancelled." },
  invalid_state: { zh: "Discord 授權已逾時或驗證狀態無效，請重新開始。", en: "Discord authorization expired or its state was invalid. Please try again." },
};

export default function Login() {
  const { isEnglish } = useLanguage();
  const { login, user, loading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [voterId, setVoterId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const query = new URLSearchParams(location.split("?")[1] || "");
  const requestedNext = query.get("next");
  const returnTo = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? (() => {
        try {
          const target = new URL(requestedNext, window.location.origin);
          return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/votes";
        } catch {
          return "/votes";
        }
      })()
    : "/votes";
  const discordResult = query.get("discord");
  const registered = query.get("registered") === "1";
  const discordMessage = discordResult
    ? (DISCORD_MESSAGES[discordResult] ?? { zh: "Discord 登入或連結失敗，請稍後再試。", en: "Discord sign-in or linking failed. Please try again." })
    : null;

  useEffect(() => {
    if (authLoading || discordResult !== "login") return;
    if (user) {
      window.location.assign(returnTo);
      return;
    }
    let active = true;
    apiFetch("/api/auth/me").then(async response => {
      if (!active) return;
      if (!response.ok) {
        setError(isEnglish ? "Discord authorization succeeded, but the website session was not created. Please try again." : "Discord 授權成功，但網站 session 尚未建立，請再試一次。");
        return;
      }
      const data = await response.json();
      login({ voterId: data.voterId, voterName: data.voterName, countryName: data.countryName, adminLevel: data.adminLevel ?? 0 });
      window.location.assign(returnTo);
    }).catch(() => {
      if (active) setError(isEnglish ? "Could not confirm the Discord session." : "無法確認 Discord 登入狀態。");
    });
    return () => { active = false; };
  }, [authLoading, discordResult, isEnglish, login, returnTo, user]);

  const startDiscord = () => window.location.assign(discordOAuthStartUrl(user ? "link" : "login"));

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const id = voterId.trim();
    if (!id || !password.trim()) {
      setError(isEnglish ? "Enter your ID and password." : "請輸入 ID 與密碼。");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: id, password: password.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(toChineseError(data.error, isEnglish ? "Sign-in failed. Check your ID and password." : "登入失敗，請確認 ID 與密碼。"));
        return;
      }
      login({ voterId: data.voterId, voterName: data.voterName, countryName: data.countryName, adminLevel: data.adminLevel ?? 0 });
      if (returnTo === "/documents" || returnTo.startsWith("/documents/")) window.location.assign(returnTo);
      else setLocation(returnTo);
    } catch {
      setError(isEnglish ? "Connection error. Please try again." : "連線錯誤，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-16">
      <div className="container mx-auto px-4 max-w-md">
        <Card className="border-border/60 bg-white shadow-sm">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2 text-center">
              <KeyRound className="w-6 h-6" />{isEnglish ? "Sign in to FUMO" : "登入 FUMO 帳戶"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEnglish ? "Continue with your registered Discord account, or use your registration ID and password." : "使用已登記的 Discord 帳戶登入；也可使用註冊 ID 與密碼登入。"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {registered && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{isEnglish ? "ID registration successful. Sign in with your ID and password." : "ID 註冊成功，請使用 ID 與密碼登入。"}</div>}
            {discordMessage && <div className={`flex items-start gap-2 rounded-md p-3 ${discordResult === "login" || discordResult === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} role={discordResult === "login" || discordResult === "connected" ? "status" : "alert"}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="text-sm">{isEnglish ? discordMessage.en : discordMessage.zh}</span></div>}
            <Button type="button" variant="outline" onClick={startDiscord} className="Button-solid w-full justify-center">
              <MessageCircle className="w-4 h-4" />{user ? (isEnglish ? "Connect Discord account" : "連結 Discord 帳戶") : (isEnglish ? "Continue with Discord" : "使用 Discord 登入")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {isEnglish ? "Your Discord ID must match an entry in FUMO's official registration list." : "Discord 帳戶 ID 必須與 FUMO 官方註冊名單相符。"}
            </p>
            <div className="relative py-1" aria-hidden="true"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-muted-foreground">{isEnglish ? "OR" : "或"}</span></div></div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-id" className="Label">{isEnglish ? "Registration ID" : "註冊 ID（Discord ID）"}</label>
                <Input id="login-id" value={voterId} onChange={event => setVoterId(event.target.value)} placeholder={isEnglish ? "Enter your registration ID" : "輸入註冊名單中的 ID"} autoComplete="username" />
              </div>
              <div>
                <label htmlFor="login-password" className="Label">{isEnglish ? "Password" : "密碼"}</label>
                <Input id="login-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={isEnglish ? "Enter your password" : "輸入密碼"} autoComplete="current-password" />
              </div>
              {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" /><span className="text-sm">{error}</span></div>}
              <Button type="submit" disabled={loading} className="Button-hollow w-full justify-center">
                {loading ? (isEnglish ? "Signing in..." : "登入中…") : (isEnglish ? "Sign in with ID and password" : "使用 ID 與密碼登入")}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              {isEnglish ? "No account yet?" : "還沒有帳戶？"}{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">{isEnglish ? "Register with Discord or ID and password" : "使用 Discord 或 ID／密碼註冊"}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
