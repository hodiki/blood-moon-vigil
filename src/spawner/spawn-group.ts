/**
 * spawner/spawn-group.ts —— 方阵组生成器·纯函数层（W-A / W-10，gdd-spawner-v2 §③-4 / F-1~9）
 *
 * 预约制组生成：成组预扣 budget（成员面板 XP 等效点数）→ 落地点预约（环带/阵型站位）
 * → 2.5s 阵纹预警 → 成组落地（≤5 只/帧分帧，受 maxEnemies 节流不丢组）。
 * 复用精英保底预约落地架构语义（enemy-spawner pendingTank 同构）。
 *
 * 规则锚（MN-19 b 激进锚 / F-2）：掷点 60~90s · 概率 S1 末段 0.3 / S2 0.6 / S3 0.9 ·
 * 同屏 ≤2（高档不叠高档）· 占比 ≤25% 预扣会计 · 每局 4~7 锚 · BOSS_TIME 停掷 ·
 * boss_4 在场停掷 · 伴随生成 +20%（10s）· 宝藏护卫横穿特例（每局 ≤1）。
 *
 * 组成员行为细节（组黑板协同 AI）属 W-B（group-blackboard.ts）；
 * 本层只管「何时/何处/以何成本成组落地」。
 */

import {
  FORMATIONS,
  FORMATION_RULES,
  TREASURE_PATH,
  formationBudgetCost,
  type FormationConfig,
  type FormationId,
  type FormationRole,
  type FormationThreat,
  type MapId,
  type EnemyId,
} from '@/config/balance';

/** 预约组成员（阵型站位落点在预约时定死；slotIndex = 组内槽位，黑板/元数据路由键） */
export interface GroupMemberSlot {
  enemyId: EnemyId;
  role: FormationRole;
  slotIndex: number;
  x: number;
  y: number;
  landed: boolean;
}

/** 已预约未落地组（阵纹预警倒计时中） */
export interface PendingGroup {
  groupId: string;
  formationId: FormationId;
  threat: FormationThreat;
  centerX: number;
  centerY: number;
  /** 阵纹预警剩余 s（2.5s 起算） */
  remaining: number;
  members: GroupMemberSlot[];
  /** 宝藏护卫横穿特例：横穿向量与终点（普通阵 null） */
  path: { dirX: number; dirY: number; speed: number; exitX: number; exitY: number } | null;
}

/** 在场组（落地后；供同屏计数/伴随窗口/黑板挂接） */
export interface ActiveGroup {
  groupId: string;
  formationId: FormationId;
  threat: FormationThreat;
  /** 落地时刻（局时 s；伴随 +20% 窗口 = landedAt + 10s） */
  landedAt: number;
  formation: FormationConfig;
}

/** 调度器状态（纯数据；EnemySpawner / sim 共用） */
export interface GroupSchedulerState {
  time: number;
  /** 上次掷点局时（null = 未掷过） */
  lastRollAt: number | null;
  /** 下次掷点间隔（60~90 随机，掷点时刷新） */
  nextInterval: number;
  pending: PendingGroup[];
  active: ActiveGroup[];
  /** 本局掷点次数（每局 4~7 锚观察项） */
  runsThisGame: number;
  /** 宝藏护卫已用（每局 ≤1） */
  treasureUsed: boolean;
  /** 方阵预扣预算累计（点） */
  budgetSpent: number;
  /** budget 总盘累计（点；预扣占比会计分母） */
  budgetTotal: number;
  /** BOSS_TIME 已触发（停掷 + 清预约） */
  bossTimeTriggered: boolean;
  /** boss_4 在场（停掷） */
  boss4OnField: boolean;
  nextGroupId: number;
}

/** 落地事件（EnemySpawner / sim 消费：实例化成员实体） */
export interface GroupLandEvent {
  groupId: string;
  formationId: FormationId;
  member: GroupMemberSlot;
  /** 首只成员落地 = 组落地沿（伴随 +20% / 黑板创建挂点） */
  isGroupStart: boolean;
}

export function createGroupSchedulerState(): GroupSchedulerState {
  return {
    time: 0,
    lastRollAt: null,
    nextInterval: 0,
    pending: [],
    active: [],
    runsThisGame: 0,
    treasureUsed: false,
    budgetSpent: 0,
    budgetTotal: 0,
    bossTimeTriggered: false,
    boss4OnField: false,
    nextGroupId: 1,
  };
}

/** 下次掷点间隔（60~90s 锚，r ∈ [0,1)） */
export function nextRollInterval(r: number): number {
  const [min, max] = FORMATION_RULES.ROLL_INTERVAL;
  return min + (max - min) * Math.min(0.9999, Math.max(0, r));
}

/**
 * 触发概率（F-2：S1 末段 0.3 / S2 0.6 / S3 0.9）。
 * S1 末段窗口 = [100, 120)（轨② 最早教学阵 unlockAt 100s）；S1 前段无方阵（0）。
 */
export function formationTriggerChance(t: number): number {
  if (t < FORMATION_RULES.S1_END_WINDOW_START) return 0;
  if (t < 120) return FORMATION_RULES.TRIGGER_CHANCE_S1_END;
  if (t < 240) return FORMATION_RULES.TRIGGER_CHANCE_S2;
  if (t < 360) return FORMATION_RULES.TRIGGER_CHANCE_S3;
  return 0; // BOSS_TIME 后停掷
}

/** 该阵解锁且本图入池（轨② 过滤 + 逐图权重禁列） */
export function isFormationEligible(formationId: FormationId, t: number, mapId: MapId): boolean {
  const f = FORMATIONS[formationId];
  return f.enabled && t >= f.unlockAt && f.mapWeights[mapId] > 0;
}

/** 轨② 过滤后的可掷阵列表（顺序 = FORMATIONS 键序，保证确定性） */
export function eligibleFormationIds(t: number, mapId: MapId): FormationId[] {
  return (Object.keys(FORMATIONS) as FormationId[]).filter((id) => isFormationEligible(id, t, mapId));
}

/** 按逐图权重抽阵（r ∈ [0,1)；池空返回 null = 本帧不掷） */
export function pickFormationId(t: number, mapId: MapId, r: number): FormationId | null {
  const pool = eligibleFormationIds(t, mapId);
  const total = pool.reduce((s, id) => s + FORMATIONS[id].mapWeights[mapId], 0);
  if (pool.length === 0 || total <= 0) return null;
  let acc = 0;
  for (const id of pool) {
    acc += FORMATIONS[id].mapWeights[mapId];
    if (r * total < acc) return id;
  }
  return pool[pool.length - 1]!;
}

/** 同屏组数（在场 + 预约中均占屏） */
export function onScreenGroupCount(state: GroupSchedulerState): number {
  return state.active.length + state.pending.length;
}

/**
 * 同屏约束（F-2：≤2；双阵时至少 1 低/中档 = 高档不叠高档）。
 * 宝藏护卫不计入高档约束（特例通道，但计入同屏数）。
 */
export function canStartGroup(state: GroupSchedulerState, threat: FormationThreat): boolean {
  if (onScreenGroupCount(state) >= FORMATION_RULES.MAX_ON_SCREEN) return false;
  if (threat === 'high') {
    const highOnScreen =
      state.active.some((g) => g.threat === 'high') ||
      state.pending.some((g) => g.threat === 'high');
    if (highOnScreen) return false;
  }
  return true;
}

/** 预扣占比检查（≤25%；预扣计入 budget 总盘） */
export function withinBudgetShare(state: GroupSchedulerState, cost: number): boolean {
  if (state.budgetTotal <= 0) return true; // 局初总盘未累计：首阵（S1 末 100s 时总盘已 >90 点）放行
  return (state.budgetSpent + cost) / state.budgetTotal <= FORMATION_RULES.BUDGET_SHARE_MAX;
}

/** 阵型站位 → 成员落点（spawner-v2 §③-4 落地分布行；预约点为心） */
export function groupLandingPositions(
  formation: FormationConfig,
  centerX: number,
  centerY: number,
  angle: number,
  rng: () => number,
): Array<{ x: number; y: number }> {
  const p = formation.placement;
  const n = formation.members.reduce((s, m) => s + m.count, 0);
  const out: Array<{ x: number; y: number }> = [];
  if (p.kind === 'scatter') {
    // 80~150px 半径散布（逐阵覆盖：锁链 120~200 / 围猎 100~160）
    for (let i = 0; i < n; i += 1) {
      const dist = p.radiusMin + (p.radiusMax - p.radiusMin) * rng();
      const a = angle + (rng() - 0.5) * Math.PI * 2;
      out.push({ x: centerX + Math.cos(a) * dist, y: centerY + Math.sin(a) * dist });
    }
    return out;
  }
  if (p.kind === 'wedge') {
    // 三角编队（骑士团 spacing 300）：顶点朝生成方向，底边两翼
    const s = p.spacing;
    const apex = { x: centerX + Math.cos(angle) * (s / 2), y: centerY + Math.sin(angle) * (s / 2) };
    const left = { x: centerX + Math.cos(angle + Math.PI / 2) * (s / 2), y: centerY + Math.sin(angle + Math.PI / 2) * (s / 2) };
    const right = { x: centerX + Math.cos(angle - Math.PI / 2) * (s / 2), y: centerY + Math.sin(angle - Math.PI / 2) * (s / 2) };
    const slots = [apex, left, right];
    for (let i = 0; i < n; i += 1) out.push(slots[i % slots.length]!);
    return out;
  }
  // line：横队列（宝藏护卫 spacing 60，垂直于行进方向 angle）
  for (let i = 0; i < n; i += 1) {
    const offset = (i - (n - 1) / 2) * p.spacing;
    out.push({
      x: centerX + Math.cos(angle + Math.PI / 2) * offset,
      y: centerY + Math.sin(angle + Math.PI / 2) * offset,
    });
  }
  return out;
}

/**
 * 宝藏护卫横穿路径（spawner-v2 §③-5）：地图一端边缘（距玩家 ≥600px）→
 * 直线横穿至对端（速 40）；y 车道取玩家对侧半带（避 Boss 战舞台 320px 的
 * 精确绕行偏移由消费方按 OBSTACLE_OFFSET 锚处理，本层给直线基线）。
 */
export function treasurePathPoints(
  mapWidth: number,
  mapHeight: number,
  playerX: number,
  playerY: number,
  rng: () => number,
): { entry: { x: number; y: number }; exit: { x: number; y: number } } {
  const yLane = mapHeight * 0.5 + (rng() - 0.5) * mapHeight * 0.4;
  // 入口端 = 距玩家更远的一侧（保 ≥600px 下限）
  const fromLeft = Math.abs(0 - playerX) >= Math.abs(mapWidth - playerX);
  let entryX = fromLeft ? 0 : mapWidth;
  let exitX = fromLeft ? mapWidth : 0;
  let entry = { x: entryX, y: yLane };
  if (Math.hypot(entry.x - playerX, entry.y - playerY) < TREASURE_PATH.MIN_PLAYER_DISTANCE) {
    // 同侧车道仍太近 → 换对侧 + 车道推向远端
    entryX = fromLeft ? mapWidth : 0;
    exitX = fromLeft ? 0 : mapWidth;
    const farY = playerY > mapHeight / 2 ? mapHeight * 0.15 : mapHeight * 0.85;
    entry = { x: entryX, y: farY };
  }
  return { entry, exit: { x: exitX, y: entry.y } };
}

export interface GroupRollContext {
  mapId: MapId;
  mapWidth: number;
  mapHeight: number;
  playerX: number;
  playerY: number;
  /** 预约点环带半径（与单体生成同带；spawnRingFor 语义） */
  ringMin: number;
  ringMax: number;
}

export interface GroupRollResult {
  rolled: boolean;
  /** 成组预扣成本（rolled=true 时 >0，调用方从 budgetAcc 扣除） */
  cost: number;
  pending: PendingGroup | null;
  /** 掷点被拒原因（遥测/测试断言） */
  reason?: 'chance' | 'pool-empty' | 'on-screen' | 'budget-share' | 'treasure-used' | 'gate';
}

/**
 * 掷点（每 update tick 检查 lastRollAt + nextInterval；本函数只做判定与预约登记）。
 * 预扣成本不入账（budgetSpent 累加在本函数）；budgetAcc 实扣由调用方执行。
 */
export function rollGroup(
  state: GroupSchedulerState,
  ctx: GroupRollContext,
  rng: () => number,
): GroupRollResult {
  if (state.bossTimeTriggered || state.boss4OnField) {
    return { rolled: false, cost: 0, pending: null, reason: 'gate' };
  }
  const due = state.lastRollAt === null || state.time >= state.lastRollAt + state.nextInterval;
  if (!due) return { rolled: false, cost: 0, pending: null, reason: 'gate' };
  // 掷点命中 → 刷新节奏（无论后续是否成组，节奏位推进；MN-19 b 掷点口径）
  state.lastRollAt = state.time;
  state.nextInterval = nextRollInterval(rng());
  if (rng() >= formationTriggerChance(state.time)) {
    return { rolled: false, cost: 0, pending: null, reason: 'chance' };
  }
  // 宝藏护卫特例窗口（180s 起 S2 末~S3 高优预约；每局 ≤1；独立于常规掷点）
  const treasureEligible = isFormationEligible('f_treasure_guard', state.time, ctx.mapId);
  if (treasureEligible && !state.treasureUsed) {
    state.treasureUsed = true;
    state.runsThisGame += 1;
    const { entry, exit } = treasurePathPoints(ctx.mapWidth, ctx.mapHeight, ctx.playerX, ctx.playerY, rng);
    const dirX = exit.x - entry.x;
    const dirY = exit.y - entry.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const formation = FORMATIONS.f_treasure_guard;
    const angle = Math.atan2(dirY, dirX);
    const positions = groupLandingPositions(formation, entry.x, entry.y, angle, rng);
    const members: GroupMemberSlot[] = [];
    let idx = 0;
    for (const m of formation.members) {
      for (let c = 0; c < m.count; c += 1) {
        const p = positions[idx++]!;
        members.push({ enemyId: m.enemyId, role: m.role, slotIndex: idx - 1, x: p.x, y: p.y, landed: false });
      }
    }
    const group: PendingGroup = {
      groupId: `fg_${state.nextGroupId++}`,
      formationId: 'f_treasure_guard',
      threat: formation.threat,
      centerX: entry.x,
      centerY: entry.y,
      remaining: FORMATION_RULES.WARNING_SECONDS,
      members,
      path: { dirX: dirX / len, dirY: dirY / len, speed: TREASURE_PATH.SPEED, exitX: exit.x, exitY: exit.y },
    };
    state.pending.push(group);
    const cost = formationBudgetCost(formation);
    state.budgetSpent += cost;
    return { rolled: true, cost, pending: group };
  }
  const formationId = pickFormationId(state.time, ctx.mapId, rng());
  if (formationId === null) {
    return { rolled: false, cost: 0, pending: null, reason: 'pool-empty' };
  }
  const formation = FORMATIONS[formationId];
  const cost = formationBudgetCost(formation);
  if (!canStartGroup(state, formation.threat)) {
    return { rolled: false, cost: 0, pending: null, reason: 'on-screen' };
  }
  if (!withinBudgetShare(state, cost)) {
    return { rolled: false, cost: 0, pending: null, reason: 'budget-share' };
  }
  // 预约点 = 玩家环带（方阵预约点同带缩近语义由 ringMin/ringMax 传入）
  const angle = rng() * Math.PI * 2;
  const dist = ctx.ringMin + (ctx.ringMax - ctx.ringMin) * rng();
  const centerX = ctx.playerX + Math.cos(angle) * dist;
  const centerY = ctx.playerY + Math.sin(angle) * dist;
  const positions = groupLandingPositions(formation, centerX, centerY, angle, rng);
  const members: GroupMemberSlot[] = [];
  let idx = 0;
  for (const m of formation.members) {
    for (let c = 0; c < m.count; c += 1) {
      const p = positions[idx++]!;
      members.push({ enemyId: m.enemyId, role: m.role, slotIndex: idx - 1, x: p.x, y: p.y, landed: false });
    }
  }
  const group: PendingGroup = {
    groupId: `fg_${state.nextGroupId++}`,
    formationId,
    threat: formation.threat,
    centerX,
    centerY,
    remaining: FORMATION_RULES.WARNING_SECONDS,
    members,
    path: null,
  };
  state.pending.push(group);
  state.runsThisGame += 1;
  state.budgetSpent += cost;
  return { rolled: true, cost, pending: group };
}

export interface GroupStepEvents {
  lands: GroupLandEvent[];
}

/**
 * 调度步进：预警倒计时 → 分帧落地（≤5 只/帧；canSpawn=false 帧跳过但不丢组）。
 * 全员落地 → pending 移入 active（landedAt = 局时；伴随窗口起点）。
 */
export function stepGroupScheduler(
  state: GroupSchedulerState,
  dt: number,
  canSpawn: boolean,
): GroupStepEvents {
  state.time += dt;
  const events: GroupStepEvents = { lands: [] };
  if (state.pending.length === 0) return events;
  let budget = FORMATION_RULES.LAND_PER_FRAME;
  const started = new Set<string>();
  for (const group of [...state.pending]) {
    group.remaining -= dt;
    // 横穿特例：预约期成员即开始行进（横穿 AI 移动由消费方按 path 驱动，此处仅倒计时落地）
    if (group.remaining > 0) continue;
    if (!canSpawn || budget <= 0) continue; // maxEnemies 节流：组不丢，顺延到后续帧
    let landedThisFrame = 0;
    for (const m of group.members) {
      if (m.landed) continue;
      if (landedThisFrame >= budget) break;
      m.landed = true;
      landedThisFrame += 1;
      events.lands.push({
        groupId: group.groupId,
        formationId: group.formationId,
        member: m,
        // 首只成员落地 = 组落地沿（伴随 +20% / 黑板创建挂点）
        isGroupStart: !started.has(group.groupId),
      });
      started.add(group.groupId);
    }
    budget -= landedThisFrame;
    if (group.members.every((m) => m.landed)) {
      state.pending = state.pending.filter((g) => g !== group);
      state.active.push({
        groupId: group.groupId,
        formationId: group.formationId,
        threat: group.threat,
        landedAt: state.time,
        formation: FORMATIONS[group.formationId],
      });
    }
  }
  return events;
}

/** 伴随生成窗口（F-1：落地时周围普通生成权重瞬时 +20%，持续 10s 锚） */
export function accompanyBoostActive(state: GroupSchedulerState): boolean {
  return state.active.some(
    (g) => state.time - g.landedAt < FORMATION_RULES.ACCOMPANY_DURATION_SECONDS,
  );
}

/**
 * 伴随权重抬升（普通槽权重 +0.2，wolf/tank 等比削减，权重和保持 1.00）。
 * boost=false 原样返回。
 */
export function boostedWeights(
  weights: { zombie: number; wolf: number; tank: number },
  boost: boolean,
): { zombie: number; wolf: number; tank: number } {
  if (!boost || weights.zombie <= 0) return { ...weights };
  const add = FORMATION_RULES.ACCOMPANY_WEIGHT_BOOST;
  const rest = weights.wolf + weights.tank;
  const scale = rest > 0 ? (rest - add) / rest : 1;
  return {
    zombie: round6(weights.zombie + add),
    wolf: round6(weights.wolf * scale),
    tank: round6(weights.tank * scale),
  };
}

/** budget 总盘记账（EnemySpawner / sim 每次 budgetAcc 累加同额上报） */
export function reportGroupBudget(state: GroupSchedulerState, amount: number): void {
  state.budgetTotal += amount;
}

/** BOSS_TIME 触发（§⑥-4：丢弃未落地预约——已落地成员照常清理，不二次结算） */
export function onBossTimeGroups(state: GroupSchedulerState): void {
  state.bossTimeTriggered = true;
  state.pending = [];
  state.active = [];
}

/** 玩家死亡/停生成（§⑥-2：清预约队列；后续局 resetGame 走新 state） */
export function clearGroupQueues(state: GroupSchedulerState): void {
  state.pending = [];
  state.active = [];
}

/** 方阵成员全灭 → 破阵解散（清组；黑板清理由 W-B 消费解散事件） */
export function dismissGroup(state: GroupSchedulerState, groupId: string): void {
  state.active = state.active.filter((g) => g.groupId !== groupId);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
