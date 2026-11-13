import { z } from "zod";
export {
  ACTIVITY_BOARD,
  INITIAL_ROTATIONS,
  SOLVED_ROTATIONS,
  createInitialActivityState,
  getConnectedPipeIndexes,
  isActivityInstanceId,
  pipeConnections,
} from "../../../lib/discord-activity/puzzle.ts";
export type { ActivityGameState, ActivityPipe, PipeKind } from "../../../lib/discord-activity/puzzle.ts";

export const activityContentSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(120),
  introduction: z.string().trim().min(1).max(500),
  instructions: z.string().trim().min(1).max(900),
  victoryMessage: z.string().trim().min(1).max(300),
  timeLimitSeconds: z.number().int().min(30).max(600),
});

export type ActivityContent = z.infer<typeof activityContentSchema>;

export const DEFAULT_ACTIVITY_CONTENT: ActivityContent = {
  title: "FUMO 電路協力站",
  subtitle: "把散落的訊號接回總控台",
  introduction: "總控台失去連線了！大家一起轉動管線，讓電力從左上角一路抵達右下角。",
  instructions: "點擊管線旋轉 90°。只有相鄰兩格的接口彼此對上，訊號才會通過；所有人會共用同一張盤面。一起在倒數結束前接通電路！",
  victoryMessage: "訊號恢復！FUMO 協作任務完成，大家接得漂亮。",
  timeLimitSeconds: 180,
};
