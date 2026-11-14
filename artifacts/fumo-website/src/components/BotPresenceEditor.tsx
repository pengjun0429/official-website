import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchBotPresenceSettings,
  saveBotPresenceSettings,
  type BotPresenceActivity,
  type BotPresenceActivityType,
  type BotPresenceSettings,
} from "@/lib/api";

const presenceQueryKey = ["bot-presence-settings"];
type PresenceForm = Pick<BotPresenceSettings, "activities" | "rotationIntervalSeconds">;
const MAX_ACTIVITIES = 10;
const activityTypeOptions: { value: BotPresenceActivityType; label: string }[] = [
  { value: "playing", label: "正在遊玩（同一活動欄）" },
  { value: "watching", label: "正在觀看" },
  { value: "listening", label: "正在聆聽" },
  { value: "competing", label: "正在競賽" },
  { value: "streaming", label: "正在直播（Streaming）" },
];

function isSupportedStreamingUrl(value: string) {
  try {
    const url = new URL(value);
    const hosts = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv", "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && hosts.has(url.hostname.toLowerCase()) && url.pathname.split("/").filter(Boolean).length > 0;
  } catch {
    return false;
  }
}

function isValidActivityState(value: string | undefined) {
  if (value === undefined) return true;
  const normalized = value.trim();
  return normalized.length <= 128 && !/[\r\n\u0000]/.test(value);
}

function formFromSettings(settings: BotPresenceSettings): PresenceForm {
  const activities = Array.isArray(settings.activities)
    ? settings.activities
    : settings.activityText?.trim()
      ? [{ activityType: settings.activityType as BotPresenceActivityType, activityText: settings.activityText }]
      : [];
  return {
    activities: activities.map(activity => ({
      ...activity,
      activityType: (activity.activityType as string) === "custom" ? "playing" : activity.activityType,
    })),
    rotationIntervalSeconds: settings.rotationIntervalSeconds ?? 60,
  };
}

function formatSavedAt(value: string | null) {
  if (!value) return "尚未儲存過活動設定";
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
      setForm(formFromSettings(settingsQuery.data));
      setSavedAt(settingsQuery.data.updatedAt);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveBotPresenceSettings,
    onSuccess: result => {
      const nextForm = formFromSettings(result);
      setForm(nextForm);
      setSavedAt(result.updatedAt);
      setNotice({ ok: true, text: "Bot 活動清單與輪播設定已儲存至 FUMO 資料庫。" });
      queryClient.setQueryData(presenceQueryKey, result);
    },
    onError: error => setNotice({ ok: false, text: error instanceof Error ? error.message : "儲存失敗。" }),
  });

  const updateActivity = <K extends keyof BotPresenceActivity>(index: number, key: K, value: BotPresenceActivity[K]) => {
    setNotice(null);
    setForm(current => current ? {
      ...current,
      activities: current.activities.map((activity, activityIndex) => activityIndex === index ? { ...activity, [key]: value } : activity),
    } : current);
  };

  const updateActivityType = (index: number, activityType: BotPresenceActivityType) => {
    setNotice(null);
    setForm(current => current ? {
      ...current,
      activities: current.activities.map((activity, activityIndex) => {
        if (activityIndex !== index) return activity;
        const next = { ...activity, activityType };
        if (activityType !== "streaming") delete next.activityUrl;
        return next;
      }),
    } : current);
  };

  const updateRotationInterval = (value: number) => {
    setNotice(null);
    setForm(current => current ? { ...current, rotationIntervalSeconds: value } : current);
  };

  const moveActivity = (index: number, offset: -1 | 1) => {
    setNotice(null);
    setForm(current => {
      if (!current) return current;
      const target = index + offset;
      if (target < 0 || target >= current.activities.length) return current;
      const activities = [...current.activities];
      [activities[index], activities[target]] = [activities[target], activities[index]];
      return { ...current, activities };
    });
  };

  const changed = Boolean(form && settingsQuery.data && JSON.stringify(form) !== JSON.stringify(formFromSettings(settingsQuery.data)));
  const formIsValid = Boolean(form
    && form.activities.length <= MAX_ACTIVITIES
    && form.activities.every(activity => activity.activityText.trim().length > 0
      && activity.activityText.trim().length <= 128
      && !/[\r\n\u0000]/.test(activity.activityText)
      && isValidActivityState(activity.activityState)
      && (activity.activityType === "streaming"
        ? isSupportedStreamingUrl(activity.activityUrl?.trim() ?? "")
        : !activity.activityUrl?.trim()))
    && Number.isInteger(form.rotationIntervalSeconds)
    && form.rotationIntervalSeconds >= 30
    && form.rotationIntervalSeconds <= 600
    && form.rotationIntervalSeconds % 30 === 0);
  const allSystemsReady = apiSupportsPresence && runtimeSupportsPresence;

  return (
    <Card className="fumo-activity-settings">
      <CardHeader className="fumo-activity-settings__header">
        <CardTitle className="fumo-activity-settings__title flex items-center gap-2"><Activity className="h-5 w-5" />Bot 活動輪播</CardTitle>
        <p className="text-sm text-muted-foreground">可設定最多 10 組活動，分別指定類型、名稱、正在做什麼及串流網址；Bot 會依序輪播並同步至 Discord。</p>
      </CardHeader>
      <CardContent className="fumo-activity-settings__content space-y-4">
        {settingsQuery.isLoading && <p className="text-sm text-muted-foreground">正在載入 Bot 活動設定…</p>}
        {settingsQuery.error && <p className="text-sm text-red-600" role="alert">{settingsQuery.error.message}</p>}
        {form && <>
          <div className="space-y-3">
            {form.activities.map((activity, index) => (
              <div key={index} className="fumo-activity-settings__activity space-y-3 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">第 {index + 1} 組活動</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" aria-label={`將第 ${index + 1} 組活動上移`} title="上移" disabled={index === 0} onClick={() => moveActivity(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" aria-label={`將第 ${index + 1} 組活動下移`} title="下移" disabled={index === form.activities.length - 1} onClick={() => moveActivity(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" aria-label={`刪除第 ${index + 1} 組活動`} title="刪除" onClick={() => {
                      setNotice(null);
                      setForm(current => current ? { ...current, activities: current.activities.filter((_, activityIndex) => activityIndex !== index) } : current);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <label className="block text-sm font-medium">活動類型
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={activity.activityType} onChange={event => updateActivityType(index, event.target.value as BotPresenceActivityType)}>
                    {activityTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                {activity.activityType === "streaming" && <>
                  <label className="block text-sm font-medium">Streaming 網址（HTTPS Twitch／YouTube）
                    <Input className="mt-1" type="url" maxLength={2048} value={activity.activityUrl ?? ""} onChange={event => updateActivity(index, "activityUrl", event.target.value)} placeholder="https://www.twitch.tv/頻道名稱" aria-invalid={Boolean(activity.activityUrl && !isSupportedStreamingUrl(activity.activityUrl.trim()))} />
                  </label>
                  <p className="text-xs text-muted-foreground">僅接受 Twitch 或 YouTube 的 HTTPS 頻道、直播或影片網址。</p>
                  {activity.activityUrl && !isSupportedStreamingUrl(activity.activityUrl.trim()) && <p className="text-xs text-red-600" role="alert">請輸入有效的 Twitch／YouTube HTTPS 網址。</p>}
                </>}
                <label className="block text-sm font-medium">活動名稱（最多 128 字元）
                  <Input className="mt-1" maxLength={128} value={activity.activityText} onChange={event => updateActivity(index, "activityText", event.target.value)} placeholder="例如：正在舉行大會" />
                </label>
                <label className="block text-sm font-medium">正在做什麼（活動狀態，選填，最多 128 字元）
                  <Input className="mt-1" maxLength={128} value={activity.activityState ?? ""} onChange={event => updateActivity(index, "activityState", event.target.value)} placeholder="例如：正在準備會議資料" aria-invalid={!isValidActivityState(activity.activityState)} />
                </label>
                <p className="text-xs text-muted-foreground">這段文字會以 Discord 活動的 state 顯示；留白則不加入額外文字。</p>
                {activity.activityState && !isValidActivityState(activity.activityState) && <p className="text-xs text-red-600" role="alert">活動狀態必須是單行文字，且最多 128 字元。</p>}
              </div>
            ))}
            {form.activities.length === 0 && <p className="text-sm text-muted-foreground">目前沒有手動活動；有進行中的投票時 Bot 會顯示「正在遊玩：投票中」，投票結束後則不顯示活動。</p>}
          </div>

          <Button type="button" variant="outline" onClick={() => {
            setNotice(null);
            setForm(current => current && current.activities.length < MAX_ACTIVITIES
              ? { ...current, activities: [...current.activities, { activityType: "playing", activityText: "" }] }
              : current);
          }} disabled={form.activities.length >= MAX_ACTIVITIES}>
            <Plus className="mr-2 h-4 w-4" />新增一組活動
          </Button>

          <label className="block text-sm font-medium">輪播間隔（秒）
            <Input className="mt-1 max-w-40" type="number" min={30} max={600} step={30} value={form.rotationIntervalSeconds} onChange={event => updateRotationInterval(Number(event.target.value))} />
          </label>
        <p className="text-xs text-muted-foreground">間隔可設 30–600 秒，且須為 30 秒倍數。Bot 每 30 秒同步一次；多組活動會依列表順序輪播。所有活動都會顯示在 Discord 的同一活動欄，例如「正在遊玩…」，不會使用獨立的 Custom Status 欄位。</p>
          <p className="text-xs text-muted-foreground">手動設定優先：只要清單中有活動，Bot 就會依設定輪播，不會被自動投票狀態覆寫。清單為空時，若有已發布、已開始、未關閉且未逾期的投票，才會顯示「正在遊玩：投票中」；投票結束後回到空白狀態。</p>
          <p className="text-xs text-muted-foreground">最後儲存：{formatSavedAt(savedAt)}</p>
          {!allSystemsReady && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">目前網站 API 或執行中的 Bot 尚未回報活動同步支援；需完成 API Worker 更新後，多組活動與輪播設定才會顯示在 Discord。</div>}
          {notice && <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${notice.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`} role={notice.ok ? "status" : "alert"}>{notice.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}{notice.text}</div>}
          <Button onClick={() => { setNotice(null); if (form) saveMutation.mutate(form); }} disabled={!changed || !formIsValid || saveMutation.isPending || !settingsQuery.data}>
            <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "儲存中…" : "儲存 Bot 活動設定"}
          </Button>
          {changed && <span className="ml-3 text-xs text-muted-foreground">有尚未儲存的修改。</span>}
        </>}
      </CardContent>
    </Card>
  );
}
