import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchBotPresenceSettings,
  saveBotPresenceSettings,
  type BotPresenceActivityType,
  type BotPresenceSettings,
} from "@/lib/api";

const presenceQueryKey = ["bot-presence-settings"];
type PresenceForm = Pick<BotPresenceSettings, "activityType" | "activityText">;
const activityTypeOptions: { value: BotPresenceActivityType; label: string }[] = [
  { value: "custom", label: "自訂狀態（直接顯示文字）" },
  { value: "playing", label: "正在遊玩" },
  { value: "watching", label: "正在觀看" },
  { value: "listening", label: "正在聆聽" },
  { value: "competing", label: "正在競賽" },
];

function formatSavedAt(value: string | null) {
  if (!value) return "尚未儲存過自訂狀態";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function BotPresenceEditor({ apiSupportsPresence, runtimeSupportsPresence }: {
  apiSupportsPresence: boolean;
  runtimeSupportsPresence: boolean;
}) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: presenceQueryKey, queryFn: fetchBotPresenceSettings });
  const [form, setForm] = useState<PresenceForm | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({ activityType: settingsQuery.data.activityType, activityText: settingsQuery.data.activityText });
      setSavedAt(settingsQuery.data.updatedAt);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveBotPresenceSettings,
    onSuccess: result => {
      const nextForm = { activityType: result.activityType, activityText: result.activityText };
      setForm(nextForm);
      setSavedAt(result.updatedAt);
      setNotice({ ok: true, text: "Bot 狀態文字已儲存至 FUMO 資料庫。" });
      queryClient.setQueryData(presenceQueryKey, result);
    },
    onError: error => setNotice({ ok: false, text: error instanceof Error ? error.message : "儲存失敗。" }),
  });

  const update = <K extends keyof PresenceForm>(key: K, value: PresenceForm[K]) => {
    setNotice(null);
    setForm(current => current ? { ...current, [key]: value } : current);
  };
  const changed = Boolean(form && settingsQuery.data && (
    form.activityType !== settingsQuery.data.activityType || form.activityText !== settingsQuery.data.activityText
  ));
  const allSystemsReady = apiSupportsPresence && runtimeSupportsPresence;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Bot 狀態文字</CardTitle>
        <p className="text-sm text-muted-foreground">設定 Discord Bot 顯示的活動類型與文字；例如「正在舉行大會」。狀態儲存至 FUMO 資料庫，Bot 會定期同步。</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {settingsQuery.isLoading && <p className="text-sm text-muted-foreground">正在載入 Bot 狀態設定…</p>}
        {settingsQuery.error && <p className="text-sm text-red-600" role="alert">{settingsQuery.error.message}</p>}
        {form && <>
          <label className="block text-sm font-medium">活動類型
            <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.activityType} onChange={event => update("activityType", event.target.value as BotPresenceActivityType)}>
              {activityTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">狀態文字（最多 128 字元）
            <Input className="mt-1" maxLength={128} value={form.activityText} onChange={event => update("activityText", event.target.value)} placeholder="例如：正在舉行大會" />
          </label>
          <p className="text-xs text-muted-foreground">留空後儲存會清除活動文字。自訂狀態會直接顯示文字；其他活動類型會帶有對應提示。串流類型需要 Twitch／YouTube 網址，因此不在這裡提供。</p>
          <p className="text-xs text-muted-foreground">最後儲存：{formatSavedAt(savedAt)}</p>
          {!allSystemsReady && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">目前程式或執行中的 Bot 尚未同時回報狀態同步支援。儲存後要等 API Worker migration／更新及 Bot runtime 更新完成，設定才會顯示在 Discord。</div>}
          {notice && <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${notice.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`} role={notice.ok ? "status" : "alert"}>{notice.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}{notice.text}</div>}
          <Button onClick={() => { setNotice(null); saveMutation.mutate(form); }} disabled={!changed || saveMutation.isPending || !settingsQuery.data}>
            <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "儲存中…" : "儲存 Bot 狀態"}
          </Button>
          {changed && <span className="ml-3 text-xs text-muted-foreground">有尚未儲存的修改。</span>}
        </>}
      </CardContent>
    </Card>
  );
}
