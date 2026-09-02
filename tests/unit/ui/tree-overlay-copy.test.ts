import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TREE_GROUP_COPY, heroBranchTitle } from '@/config/ui-copy';

const srcOf = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../src/${rel}`, import.meta.url)), 'utf-8');

/** 守卫只针对玩家可见层：剥离块注释与行注释（开发侧 JSDoc 保留 spec 代号引用） */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('NV-PLAYER-UI W-B5 树界面/图鉴文案清理', () => {
  it('分组标题玩家化：自由试炼模式，无开发措辞', () => {
    expect(TREE_GROUP_COPY.pureInGame).toContain('自由试炼模式');
    expect(TREE_GROUP_COPY.pureInGame).not.toContain('待商榷');
    expect(TREE_GROUP_COPY.pureInGame).not.toMatch(/GT-\d|Q-[a-f]/);
    expect(TREE_GROUP_COPY.mutation).toContain('质变铭刻');
    expect(TREE_GROUP_COPY.attribute).not.toContain('克制的小颗粒');
  });

  it('支线标题：四位角色真名支线（HEROES.name 派生，无英文 key）', () => {
    for (const hero of ['edmund', 'cassandra', 'violet', 'galvan']) {
      expect(heroBranchTitle(hero)).toMatch(/支线$/);
      expect(heroBranchTitle(hero)).not.toContain(hero);
    }
  });

  it('tree-overlay 源码守卫：开发措辞/内部代号不再出现于玩家可见字符串', () => {
    const s = stripComments(srcOf('ui/tree-overlay.ts'));
    expect(s).not.toContain('待商榷');
    expect(s).not.toContain('Q-d');
    expect(s).not.toContain('支线 · ');
    expect(s).not.toMatch(/TALENT_TOTAL_COST_RANGE/); // 全树成本区间（开发参数）不再拼接进 meta 行
  });

  it('codex-overlay 源码守卫：EG-2/offer/DPS 内部措辞清出玩家可见层', () => {
    const s = srcOf('ui/codex-overlay.ts');
    expect(s).not.toContain('EG-2 双轨收口');
    expect(s).not.toContain("label: '基础 DPS'");
    expect(s).not.toContain("label: '等效 DPS'");
  });
});
