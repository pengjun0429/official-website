export type PipeKind = "source" | "goal" | "straight" | "corner" | "empty";
export interface ActivityPipe { kind: PipeKind; label: string; }
export interface ActivityGameState { rotations: number[]; moves: number; startedAt: string; }

// The shared 4x4 board runs a serpentine route from the source at 0 to the goal at 15.
export const ACTIVITY_BOARD: readonly ActivityPipe[] = [
  { kind: "source", label: "電源" },
  { kind: "straight", label: "直管" },
  { kind: "straight", label: "直管" },
  { kind: "corner", label: "彎管" },
  { kind: "corner", label: "彎管" },
  { kind: "straight", label: "直管" },
  { kind: "straight", label: "直管" },
  { kind: "corner", label: "彎管" },
  { kind: "corner", label: "彎管" },
  { kind: "straight", label: "直管" },
  { kind: "straight", label: "直管" },
  { kind: "corner", label: "彎管" },
  { kind: "empty", label: "空格" },
  { kind: "corner", label: "彎管" },
  { kind: "straight", label: "直管" },
  { kind: "goal", label: "總控台" },
];

// Directions are N, E, S, W. These orientations form the solved serpentine path.
export const SOLVED_ROTATIONS = [0, 1, 1, 2, 1, 1, 1, 3, 0, 1, 1, 2, 0, 2, 1, 0] as const;
// Fixed source/goal and empty cells are ignored by the rendering/game logic.
export const INITIAL_ROTATIONS = [0, 0, 3, 0, 3, 0, 2, 1, 2, 3, 0, 1, 0, 0, 0, 0] as const;
const DIRECTION_DELTAS = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const;

export function createInitialActivityState(now = new Date().toISOString()): ActivityGameState {
  return { rotations: [...INITIAL_ROTATIONS], moves: 0, startedAt: now };
}

export function pipeConnections(kind: PipeKind, rotation: number): number[] {
  if (kind === "source") return [1];
  if (kind === "goal") return [0];
  if (kind === "empty") return [];
  const base = kind === "straight" ? [0, 2] : [0, 1];
  return base.map(direction => (direction + rotation + 4) % 4);
}

export function getConnectedPipeIndexes(rotations: readonly number[]): number[] {
  if (rotations.length !== ACTIVITY_BOARD.length) return [];
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift()!;
    const row = Math.floor(current / 4);
    const col = current % 4;
    for (const direction of pipeConnections(ACTIVITY_BOARD[current].kind, rotations[current])) {
      const [dr, dc] = DIRECTION_DELTAS[direction];
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow > 3 || nextCol < 0 || nextCol > 3) continue;
      const next = nextRow * 4 + nextCol;
      if (visited.has(next)) continue;
      if (!pipeConnections(ACTIVITY_BOARD[next].kind, rotations[next]).includes((direction + 2) % 4)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return [...visited].sort((a, b) => a - b);
}

export function isActivityInstanceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
