/**
 * ui/frame-img.ts —— DOM 用处理后的单帧 PNG（Vite `/frames/`）
 *
 * HUD / 图鉴共用：有图则替换 SVG 兜底，404 保留原节点。
 */

export const FRAME_IMG_BASE = './frames';

export interface PreferFrameImgOptions {
  className?: string;
  /** 加载成功后仍保留的子节点（如图鉴锁定态中央「？」） */
  keep?: string;
}

export function preferFrameImg(
  host: HTMLElement,
  frameName: string,
  opts: PreferFrameImgOptions = {},
): void {
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.className = opts.className ?? 'bmv-frame-img';
  img.addEventListener('load', () => {
    for (const node of [...host.childNodes]) {
      if (node === img) continue;
      if (opts.keep && node instanceof HTMLElement && node.matches(opts.keep)) continue;
      host.removeChild(node);
    }
  });
  img.addEventListener('error', () => {
    img.remove();
  });
  img.src = `${FRAME_IMG_BASE}/${frameName}.png`;
  host.insertBefore(img, host.firstChild);
}
