/** 冒烟：生存模型单局（SIM-W1 校验；不入库工具链） */
import { simulateRun } from './sim-run';
const r = simulateRun({ seed: 1, mapId: 'map_graveyard', exclusiveId: 'xw_lantern', bucketSeconds: 30 });
console.log('lantern death:', r.deathTimeSeconds, 'firstHit:', r.firstHitAtSeconds, 'level:', r.levelReached, 'kills:', r.kills, 'movement:', r.movementModel);
const r2 = simulateRun({ seed: 1, mapId: 'map_graveyard', exclusiveId: 'xw_revolver', bucketSeconds: 30 });
console.log('revolver death:', r2.deathTimeSeconds, 'firstHit:', r2.firstHitAtSeconds, 'level:', r2.levelReached);
const r3 = simulateRun({ seed: 2, mapId: 'map_cathedral', exclusiveId: 'xw_axe', bucketSeconds: 30, tree: 'bds1' });
console.log('axe bds1 death:', r3.deathTimeSeconds, 'firstHit:', r3.firstHitAtSeconds, 'level:', r3.levelReached);
