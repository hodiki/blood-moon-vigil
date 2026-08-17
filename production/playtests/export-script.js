/**
 * ============================================================
 * 《血月守夜》Playtest 数据导出脚本（浏览器 Console 版）
 * ------------------------------------------------------------
 * 配套：production/qa/playtest-plan.md §5 / §7、round-N-raw.md
 * 使用：游戏单局结算后，按 F12 打开浏览器 Console（开发者工具），
 *       将本文件全部内容粘贴进去回车运行。
 * 输出：console 打印一行  [BMV-PLAYTEST] {JSON}
 *       （DevTools 内可用 copy(JSON.stringify(out)) 直接复制）
 * 性质：纯前端、零依赖、离线可用；数据尽力自动抓取，缺失项标注人工补录。
 * ============================================================
 */
(function () {
  'use strict';

  // ---- 常量（与 src/stats/session-stats.ts 保持一致） ----
  var RESTART_COUNT_KEY = 'bmv.restartCount';      // session 级累计重开次数
  var SETTLE_COUNT_KEY = 'bmv.settleCount';        // 结算次数（若未来接入；当前无自动埋点）
  var LAST_RUN_LS_KEY = 'bmv.lastRunResult';       // 约定键：若未来把 RunResult 写入 localStorage
  var LAST_RUN_SS_KEY = 'bmv.lastRunResultSS';     // 约定键：sessionStorage 同义

  // ---- 工具：安全读取 localStorage / sessionStorage ----
  function lsGet(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; }
    catch (e) { return null; } // 隐私模式等场景不阻断
  }
  function ssGet(key) {
    try { return window.sessionStorage ? window.sessionStorage.getItem(key) : null; }
    catch (e) { return null; }
  }

  // ---- 工具：解析 JSON 字符串（损坏返回 null，不抛错） ----
  function tryParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // ---- 探测本局 RunResult（多路径，命中即停） ----
  // 说明：当前版本 game:over 只 emit 事件、未挂全局（src/scenes/PlayScene.ts finishGame），
  //       因此多数情况下取不到 runResult，会输出 null 并提示人工补录（见下方说明）。
  //       若未来埋点按下列任一约定挂载/持久化，本脚本会自动捕获：
  //         1) window.__BMV_LAST_RUN       （推荐：finishGame 里 window.__BMV_LAST_RUN = result）
  //         2) window.__bmvLastRunResult   （别名）
  //         3) window.game.registry        （Phaser DataManager，尝试若干 key）
  //         4) localStorage['bmv.lastRunResult'] / sessionStorage['bmv.lastRunResultSS']
  function findRunResult() {
    var cand = [
      window.__BMV_LAST_RUN,
      window.__bmvLastRunResult,
      lsGet(LAST_RUN_LS_KEY),
      ssGet(LAST_RUN_SS_KEY)
    ];
    for (var i = 0; i < cand.length; i++) {
      var v = cand[i];
      if (typeof v === 'string') v = tryParse(v);
      if (v && typeof v === 'object' && typeof v.survivalSeconds === 'number') return v;
    }
    // Phaser registry 探测（尽力而为）
    try {
      var reg = window.game && window.game.registry;
      if (reg && reg.list) {
        var keys = ['bmv.lastRun', 'lastRunResult', '__bmvLastRun'];
        for (var k = 0; k < keys.length; k++) {
          var rv = reg.list[keys[k]];
          if (rv && typeof rv === 'object' && typeof rv.survivalSeconds === 'number') return rv;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // ---- 汇总输出 ----
  var runResult = findRunResult();
  var out = {
    source: 'export-script v1.0',
    ts: new Date().toISOString(),                    // 导出时刻（UTC ISO）
    ua: navigator.userAgent,                          // 设备/浏览器指纹
    sessionStats: {
      restartCount: (function () {                    // session 累计重开次数（自动）
        var raw = lsGet(RESTART_COUNT_KEY);
        var n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
      })(),
      settleCount: (function () {                     // 结算次数（当前无自动埋点 → 人工补录）
        var raw = lsGet(SETTLE_COUNT_KEY);
        var n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
      })(),
      restartRateNote: '重开率 = restartCount / 结算次数；结算次数无自动埋点，需 QA 人工补录'
    },
    runResult: runResult,
    runResultSource: runResult
      ? (window.__BMV_LAST_RUN ? 'window.__BMV_LAST_RUN'
         : window.__bmvLastRunResult ? 'window.__bmvLastRunResult'
         : lsGet(LAST_RUN_LS_KEY) ? 'localStorage.bmv.lastRunResult'
         : ssGet(LAST_RUN_SS_KEY) ? 'sessionStorage'
         : 'window.game.registry')
      : null,
    manual: {
      requiredIfMissing: [
        'runResult：若为 null，请从结算页（存活秒/击杀/等级/纠结次数）或屏幕录像人工补录；',
        '  hesitationCount 若结算页未展示，可在选卡界面数"停留>3s"的次数或参考录像',
        'settleCount：本 session 实际结算局数（含当前局）',
        'Q2 firstLevelUpSeconds：首次升级局时秒（埋点有则自动，无则人工补录）'
      ]
    }
  };

  var json = JSON.stringify(out, null, 2);
  console.log('[BMV-PLAYTEST] ' + JSON.stringify(out));
  console.log('%c 若需复制：在 Console 输入  copy(JSON.stringify(out))  （out 为上方对象）', 'color:#8a2f2f;font-weight:bold');
  console.log(json);

  return out; // 便于在 Console 里继续使用变量
})();
