import { useEffect, useMemo, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { Activity, RotateCcw, Zap } from "lucide-react";
import {
  ACTIVITY_BOARD,
  getConnectedPipeIndexes,
  pipeConnections,
} from "../../../../lib/discord-activity/puzzle.ts";
import {
  fetchDiscordActivityContent,
  fetchDiscordActivityInstance,
  resetDiscordActivity,
  rotateDiscordActivityPipe,
  type DiscordActivityContent,
  type DiscordActivityState,
} from "@/lib/api";
import "./css/circuit-activity.css";

// This is the public Discord application/client ID already configured for FUMO's Bot.
const DISCORD_APPLICATION_ID = "1564180543887638580";
const INITIAL_COPY: DiscordActivityContent = {
  title: "FUMO 電路協力站",
  subtitle: "把散落的訊號接回總控台",
  introduction: "總控台失去連線了！大家一起轉動管線，讓電力從左上角一路抵達右下角。",
  instructions: "點擊管線旋轉 90°。只有相鄰兩格的接口彼此對上，訊號才會通過；所有人會共用同一張盤面。一起在倒數結束前接通電路！",
  victoryMessage: "訊號恢復！FUMO 協作任務完成，大家接得漂亮。",
  timeLimitSeconds: 180,
};
const SIDES = [
  { x1: 50, y1: 50, x2: 50, y2: 5 },
  { x1: 50, y1: 50, x2: 95, y2: 50 },
  { x1: 50, y1: 50, x2: 50, y2: 95 },
  { x1: 50, y1: 50, x2: 5, y2: 50 },
];

type SharedGame = { state: DiscordActivityState; revision: number };

function getPreviewInstanceId() {
  const key = "fumo-activity-preview-instance";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `web-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function PipeShape({ index, rotation, powered }: { index: number; rotation: number; powered: boolean }) {
  const kind = ACTIVITY_BOARD[index].kind;
  const directions = pipeConnections(kind, rotation);
  return (
    <svg className={`activity-pipe-svg${powered ? " is-powered" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      {directions.map(direction => {
        const side = SIDES[direction];
        return <line key={direction} {...side} />;
      })}
      {kind !== "empty" && <circle cx="50" cy="50" r="10" />}
    </svg>
  );
}

export default function CircuitActivity() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [discordReady, setDiscordReady] = useState(false);
  const [content, setContent] = useState(INITIAL_COPY);
  const [game, setGame] = useState<SharedGame | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    let sdk: DiscordSDK | null = null;
    try {
      sdk = new DiscordSDK(DISCORD_APPLICATION_ID);
      const ready = sdk.ready().then(() => sdk?.instanceId || null).catch(() => null);
      timeout = window.setTimeout(() => {
        if (!cancelled) setInstanceId(getPreviewInstanceId());
      }, 7000);
      void ready.then(id => {
        if (cancelled) return;
        if (timeout !== undefined) window.clearTimeout(timeout);
        if (id) {
          setDiscordReady(true);
          setInstanceId(id);
        } else {
          setInstanceId(getPreviewInstanceId());
        }
      });
    } catch {
      setInstanceId(getPreviewInstanceId());
    }
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    let contentUpdatedAt: string | null = null;
    const refresh = async () => {
      try {
        const [activityContent, sharedGame] = await Promise.all([
          fetchDiscordActivityContent(),
          fetchDiscordActivityInstance(instanceId),
        ]);
        if (cancelled) return;
        if (activityContent.updatedAt !== contentUpdatedAt) {
          contentUpdatedAt = activityContent.updatedAt;
          setContent(activityContent.content);
        }
        setGame(current => !current || sharedGame.revision >= current.revision
          ? { state: sharedGame.state, revision: sharedGame.revision }
          : current);
        setLoadingError("");
      } catch (error) {
        if (!cancelled) setLoadingError(error instanceof Error ? error.message : "無法連線至活動服務。");
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [instanceId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const state = game?.state;
  const poweredCells = useMemo(() => state ? getConnectedPipeIndexes(state.rotations) : [], [state?.rotations]);
  const solved = poweredCells.includes(15);
  const timeLeft = state
    ? Math.max(0, Math.ceil((Date.parse(state.startedAt) + content.timeLimitSeconds * 1000 - now) / 1000))
    : content.timeLimitSeconds;
  const expired = timeLeft <= 0 && !solved;
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  const act = async (action: () => Promise<SharedGame>, allowFinished = false) => {
    if (!instanceId || busy || (!allowFinished && (solved || expired))) return;
    setBusy(true);
    setLoadingError("");
    try {
      const result = await action();
      setGame(current => !current || result.revision >= current.revision ? result : current);
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : "操作失敗，請稍後再試。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="circuit-activity">
      <div className="circuit-activity-shell">
        <header className="circuit-activity-header">
          <div className="circuit-activity-mark"><Zap size={18} aria-hidden="true" /><span>F.U.M.O.</span></div>
          <span className={`circuit-activity-live${discordReady ? "" : " is-preview"}`}><Activity size={14} aria-hidden="true" />{discordReady ? "Discord 場次同步中" : "瀏覽器預覽模式"}</span>
        </header>

        <section className="circuit-activity-intro" aria-labelledby="activity-title">
          <p className="circuit-activity-kicker">CO-OP CIRCUIT PUZZLE</p>
          <h1 id="activity-title">{content.title}</h1>
          <p className="circuit-activity-subtitle">{content.subtitle}</p>
          <p className="circuit-activity-description">{content.introduction}</p>
        </section>

        <section className="circuit-game" aria-label="合作電路解謎遊戲">
          <div className="circuit-game-topline">
            <div><span className="circuit-label">剩餘時間</span><strong className={timeLeft <= 20 && !solved ? "is-warning" : ""}>{minutes}:{seconds}</strong></div>
            <div><span className="circuit-label">共同操作</span><strong>{state?.moves ?? 0}<small> 次</small></strong></div>
          </div>
          <div className={`circuit-grid${solved ? " is-solved" : ""}`} role="group" aria-label="4 乘 4 電路盤面">
            {ACTIVITY_BOARD.map((pipe, index) => {
              const rotation = state?.rotations[index] ?? 0;
              const powered = poweredCells.includes(index);
              const fixed = pipe.kind === "source" || pipe.kind === "goal" || pipe.kind === "empty";
              const label = pipe.kind === "source" ? "電源" : pipe.kind === "goal" ? "總控台" : pipe.label;
              const content = <><PipeShape index={index} rotation={rotation} powered={powered} /><span className="activity-pipe-label">{label}</span></>;
              return fixed
                ? <div key={index} className={`activity-cell${powered ? " is-powered" : ""}${pipe.kind === "source" || pipe.kind === "goal" ? " is-terminal" : " is-empty"}`} aria-label={label}>{content}</div>
                : <button
                    key={index}
                    className={`activity-cell is-turnable${powered ? " is-powered" : ""}`}
                    type="button"
                    onClick={() => void act(() => rotateDiscordActivityPipe(instanceId!, index))}
                    disabled={!game || busy || solved || expired}
                    aria-label={`第 ${index + 1} 格${label}，旋轉 ${rotation * 90} 度`}
                    title="點擊旋轉 90°"
                  >{content}</button>;
            })}
          </div>
          <div className="circuit-endpoints"><span><i className="endpoint-dot source-dot" />左上：電源</span><span><i className="endpoint-dot goal-dot" />右下：總控台</span></div>

          {loadingError && <p className="circuit-message is-error" role="alert">{loadingError}</p>}
          {solved && <div className="circuit-message is-success" role="status">{content.victoryMessage}</div>}
          {expired && <div className="circuit-message is-error" role="status">倒數結束，大家可以重新開始再挑戰一次。</div>}
          {!game && !loadingError && <p className="circuit-loading">正在連接共用盤面…</p>}

          {(solved || expired) && <button className="circuit-reset-button" type="button" onClick={() => void act(() => resetDiscordActivity(instanceId!), true)} disabled={busy}>
            <RotateCcw size={15} aria-hidden="true" />{busy ? "重置中…" : "重新開始"}
          </button>}
        </section>

        <footer className="circuit-activity-footer">
          <span className="circuit-label">任務說明</span>
          <p>{content.instructions}</p>
          <span className="circuit-sync-note">{discordReady ? "同一個 Discord 活動中的所有人會看到同步盤面。" : "此預覽使用瀏覽器暫存的場次 ID；在 Discord 中會自動切換成共用活動場次。"}</span>
        </footer>
      </div>
    </main>
  );
}
