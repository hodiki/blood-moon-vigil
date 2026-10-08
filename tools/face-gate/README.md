# 脸门出卡

规范：`design/art-bible/face-gate-spec-v1.md`。Node + sharp，无 GPU。

```
node tools/face-gate/make-card.mjs --init-ref --id <id>
node tools/face-gate/make-card.mjs --id <id> --new <新图> --topic e4-P1 [--eyes x,y]
node tools/face-gate/make-card.mjs --id <id> --frames f1,mid,last --topic e6-seg1
```

`--id`：`cassandra` · `edmund` · `violet-oath` · `violet-fallen` · `galvan` · `oathkeeper`。

落盘：`characters/<id>/identity/face-gate/`。基准 = `00-bust-ref.png`（576×768）+ `00-full-ref.png`（高 512）。锚点在 `00-anchors.json`。历史锁图只补发基准，不回溯判。

E5 路 B 合成（无 GPU）：

```
node tools/face-gate/compose-into-scene.mjs --scene <底> --person <去底RGBA> --foot 0.5,0.74 --height 576 --out <png>
```
