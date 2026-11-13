import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Gamepad2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchDiscordActivityContent,
  saveDiscordActivityContent,
  type DiscordActivityContent,
} from "@/lib/api";

const contentQueryKey = ["discord-activity-content"];

export function BotActivityEditor() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery({ queryKey: contentQueryKey, queryFn: fetchDiscordActivityContent });
  const [form, setForm] = useState<DiscordActivityContent | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (contentQuery.data) {
      setForm(contentQuery.data.content);
      setSavedAt(contentQuery.data.updatedAt);
    }
  }, [contentQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveDiscordActivityContent,
    onSuccess: (result) => {
      setForm(result.content);
      setSavedAt(result.updatedAt);
      setNotice({ ok: true, text: "活動內容已儲存至 FUMO 資料庫。" });
      queryClient.setQueryData(contentQueryKey, result);
    },
    onError: (error) => setNotice({ ok: false, text: error instanceof Error ? error.message : "儲存失敗。" }),
  });

  const update = <K extends keyof DiscordActivityContent>(key: K, value: DiscordActivityContent[K]) => {
    setNotice(null);
    setForm(current => current ? { ...current, [key]: value } : current);
  };
  const changed = Boolean(form && contentQuery.data && JSON.stringify(form) !== JSON.stringify(contentQuery.data.content));
  const stamp = savedAt ? new Date(`${savedAt.replace(" ", "T")}${savedAt.includes("Z") ? "" : "Z"}`).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚未儲存過自訂內容";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5" />Discord 活動內容</CardTitle>
        <p className="text-sm text-muted-foreground">編輯 Discord 內合作電路解謎活動會顯示的文案與限時；儲存後由所有玩家共用，已進行中的盤面不會被重置。</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {contentQuery.isLoading && <p className="text-sm text-muted-foreground">正在載入目前活動內容…</p>}
        {contentQuery.error && <p className="text-sm text-red-600" role="alert">{contentQuery.error.message}</p>}
        {form && <>
          <label className="block text-sm font-medium">活動標題<Input className="mt-1" maxLength={80} value={form.title} onChange={event => update("title", event.target.value)} /></label>
          <label className="block text-sm font-medium">副標題<Input className="mt-1" maxLength={120} value={form.subtitle} onChange={event => update("subtitle", event.target.value)} /></label>
          <label className="block text-sm font-medium">活動介紹<Textarea className="mt-1 min-h-24" maxLength={500} value={form.introduction} onChange={event => update("introduction", event.target.value)} /></label>
          <label className="block text-sm font-medium">玩法規則<Textarea className="mt-1 min-h-28" maxLength={900} value={form.instructions} onChange={event => update("instructions", event.target.value)} /></label>
          <label className="block text-sm font-medium">通關訊息<Textarea className="mt-1 min-h-20" maxLength={300} value={form.victoryMessage} onChange={event => update("victoryMessage", event.target.value)} /></label>
          <label className="block max-w-xs text-sm font-medium">倒數時間（秒，30–600）<Input className="mt-1" type="number" min={30} max={600} step={15} value={form.timeLimitSeconds} onChange={event => update("timeLimitSeconds", Number(event.target.value))} /></label>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">最後儲存：{stamp}。活動文案會更新至所有玩家；每個 Discord 場次的盤面各自共用。</div>
          {notice && <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${notice.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`} role={notice.ok ? "status" : "alert"}>{notice.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}{notice.text}</div>}
          <Button onClick={() => { setNotice(null); saveMutation.mutate(form); }} disabled={!changed || saveMutation.isPending || !contentQuery.data}>
            <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "儲存中…" : "儲存活動內容"}
          </Button>
          {changed && <span className="ml-3 text-xs text-muted-foreground">有尚未儲存的修改。</span>}
        </>}
      </CardContent>
    </Card>
  );
}
