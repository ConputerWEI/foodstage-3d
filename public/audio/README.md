# 食物音效

每种食物一套自己的咀嚼声，放在 `public/audio/<food-id>/` 下，与 `src/data/foods.ts` 里的 `FoodDefinition.id` 同名。汉堡的软面包、玉米片塔可的脆壳、珍珠奶茶的吸管声不能共用同一批素材。

## 目录约定

```
public/audio/
  README.md
  classic-burger/          # food id = classic-burger
    bite-1.mp3             # 阶段的第 1 口：咬下去的第一下
    chew-1.mp3             # 阶段中间几口（可多段，随机播）
    chew-2.mp3
    finish-1.mp3           # 阶段最后 1 口：更重、更长
    SOURCE.md              # 素材来源与授权
```

文件名即用途，代码按用途取素材，所以同一段录音可以切出不同角色的片断：

| 文件 | 播放时机 | 听感要求 |
| --- | --- | --- |
| `bite-*.mp3` | 每阶段的第 1 口 | 清晰的咬断/咬入，起音快、有脆感 |
| `chew-*.mp3` | 阶段中间的口 | 稳定的咀嚼，湿一点、闷一点，可多段轮换 |
| `finish-*.mp3` | 阶段最后 1 口 | 更重更长，带一点收尾/吞咽的尾巴 |

缺少或加载失败的 `bite` / `finish` 会回退到 `chews`；素材未能在本口开始后的 35 ms 内就绪时，立即回退到内置合成两拍音。迟到的素材仅缓存供后续使用，不补播。静音或离开品尝界面会取消待播与当前音效。

## 音频规格

- 单声道、44.1 kHz、MP3 96 kbps（单段 8–12 KB）
- 平均响度对齐到约 **−21 dBFS**，峰值不超过 **−2 dBFS**（避免解码溢出削波）
- 素材时长：`bite`/`chew` 约 0.5–0.7 秒，`finish` 约 0.8–1.0 秒；运行时播放最长 0.5 秒，末尾 60 ms 淡出，适配现有 0.55 秒咀嚼节奏
- 两端淡入淡出（约 12 ms / 140 ms），去掉切点爆音

## 新增一种食物

1. 建 `public/audio/<food-id>/`，按上表切好素材，写 `SOURCE.md` 记录来源与授权；
2. 在 `src/data/foods.ts` 的该食物条目里填 `sound`：

```ts
sound: {
  bite: '/audio/taco/bite-1.mp3',
  chews: ['/audio/taco/chew-1.mp3', '/audio/taco/chew-2.mp3'],
  finish: '/audio/taco/finish-1.mp3',
  level: 0.42, // 可选：播放增益，默认 0.42，每口上下随机浮动 5%
},
```

3. `pnpm typecheck` —— `sound.chews` 是必填项，漏了会直接报错，不会出现“新食物没声音”的静默失败。

音频在进入品尝界面时预取并解码（`primeBiteAudio`），点击当下不再等待网络；不同食物各自缓存，切换食物不会重复下载。

## 现有素材

| 食物 | 来源 | 授权 |
| --- | --- | --- |
| `classic-burger` | 项目使用者提供的日常吃汉堡录音（爱给网） | 见 [classic-burger/SOURCE.md](classic-burger/SOURCE.md) |
