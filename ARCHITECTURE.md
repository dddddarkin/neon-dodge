# 架构说明

《贴脸》DANGER CLOSE · 纯前端单页游戏，零外部依赖、零构建步骤。

## 文件结构

| 文件 | 行数 | 职责 |
|---|---|---|
| `index.html` | ~72 | 页面骨架：canvas、HUD、底部栏、script 加载顺序 |
| `style.css` | ~960 | 全部样式（含手机适配、`env(safe-area-inset)`） |
| `audio.js` | ~646 | **音频模块**：程序化音乐（9 套风格）+ 全部音效，导出全局 `Sound` |
| `game.js` | ~6511 | 其余全部：状态、更新、渲染、UI 面板、存档、调试 |
| `worker/` | — | Cloudflare Worker 排行榜后端源码（**当前未启用**，国内 DNS 被污染） |
| `CHANGELOG.md` | — | 每个版本的改动记录 |

**加载顺序必须**是 `audio.js` → `game.js`（`game.js` 依赖全局 `Sound`）。

## 三个全局对象

```js
Sound           // audio.js 导出，唯一跨文件依赖
game            // game.js 内的主状态对象
player          // 玩家状态
```

`game.js` 整体包在一个 IIFE 里，除 `window.__nd`（调试，仅在挂钩子时存在）外不污染全局。

## 状态模型

### `game`（对局 + 存档相关）

| 字段 | 含义 |
|---|---|
| `mode` | `menu` / `play` / `over` / `dying` |
| `wave` / `chapter` | 当前波次（1~24）、章节（1~6，无尽继续增长） |
| `score` / `combo` / `maxMult` | 分数、连击、本局最高倍率 |
| `mat` | 局内材料（每局清零） |
| `danger` / `burstT` | 危险值 0~120、爆发剩余秒数 |
| `boss` | Boss 对象或 `null`；`boss.exec` 表示处决窗口 |
| `shopOpen` / `shopOffers` / `shopRefresh` | 商店状态 |
| `daily` / `mut` | 每日挑战标记与今日词缀 |
| `unl` | 本局生效的永久增益 id 数组 |

### `player`

`weapons[]`（每项 `{type, lv, mods:[{t,id}]}`）、`mods`（`shieldMax` / `dashCdMul` / `dmgMul` / `dangerGain` / `burstMul` / `burstShield` / `echoChance`）、`shield`、`invuln`、`dashTime`。

## 系统索引（按函数名搜索）

| 系统 | 关键函数 / 表 |
|---|---|
| 主循环 | `update(dt)` → `updateBoss` / `updateMeteors` / `updatePlayer` / `updateBullets` / `updateFoeShots` / `updatePulses` / `updateDanger` |
| 渲染 | `render()` → `drawShip` / `drawMeteors` / `drawBullets` / `drawRangeRing` / `drawDangerRing` / `drawPulses` / `drawCutIn` / `drawExecButton` |
| 武器 | `WEAPON_DEFS`、`WEAPON_MODS`、`wStat()`、`applyWeaponMods()`、`updateWeapons()` |
| 距离倍率 | `rangeMul(tx,ty,tr)`、`RANGE_NEAR` / `RANGE_FAR` |
| 危险值 | `addDanger` / `releaseDanger` / `updateDanger` / `drawDangerRing`、`DANGER_MAX` / `BURST_DUR` |
| Boss | `BOSS_POOL`、`bossKindByChapter()`、`spawnBoss()`、`updateBoss()`、`hitBoss()`、`bossEnterExec()`、`bossExecute()`、`bossEnrage()` |
| Boss 特写 | `CUT_KINDS`（每个 Boss 的刀叶数/配色/台词）、`drawCutIn()` |
| 精英陨石 | `ELITES`、`rollElite()`、`drawMeteors()` 内的 `m.elite` 分支 |
| 商店 | `buildOffers()`（保证 1 张模组卡 + 1 张成长卡）、`renderShop()`、`refreshShop()`、`buyOffer()` |
| 局外成长 | `UNLOCK_DEFS`、`getShards()` / `grantShards()`、`buyUnlock()`、`applyUnlocks()`、`showCoreShop()` |
| 每日挑战 | `DAILY_MODS`、`todayMod()`（支持 `?mod=id` 预览）、`applyDailyMods()` |
| 存档 | `SAVE_KEYS`、`exportSave()` / `importSave()`、`backupNow()`、`restoreIfLost()`、`showSavePanel()` |
| 成就 | `ACH_LIST`、`unlock()`、`checkAch()` |
| 章节主题 | `CHAPTERS`（6 章配色）、`themeIndex()`、`chapterTheme()` |

## 坐标系统（v4.9.0 起）

```
LOGICAL_H   = 844                            // 逻辑高度固定
LOGICAL_W_MIN = 390, LOGICAL_W_MAX = 1170    // 逻辑宽度可变（宽屏最多 3 倍）
vScale  = min(vh / LOGICAL_H, vw / LOGICAL_W_MIN)
W       = clamp(vw / vScale, 390, 1170)      // 全文所有 W/H 都是逻辑尺寸
H       = LOGICAL_H
vOffX   = (vw - W * vScale) / 2            // 黑边左缘
widthMul = W / 390                         // 陨石密度补偿系数
```

**密度补偿是一条平衡铁律**：任何「按数量生成」的东西（`waveBudget` 等）都必须乘 `widthMul`，
否则场地变宽就等于凭空变简单。按时间/概率生成的东西不用乘。

**一条铁律**：任何从事件里拿到的坐标都是「屏幕坐标」，进世界前必须换算。

- 鼠标绝对定位：`(e.clientX - vOffX) / vScale`
- 触摸相对拖动：屏幕位移 `dx → dx / vScale`（触摸只取差值，不用减偏移）
- 纯比较判定（双击位移 < 18px、间隔 < 340ms）留在屏幕空间，不换算

渲染侧只有一个复位点，就是 `render()` 的第一行；绘制代码一律不要自己 `setTransform`。

---

## 存档键

`neonDodgeBest` · `neonDodgeAch` · `neonDodgeTop5` · `neonDodgeShards` · `neonDodgeUnlocks` · `neonDodgeName` · `neonDodgeTaught` · `neonDodgeBackup`（快照）· `neonDodgeMusicStyle` · `neonDodgeDebug`

> ⚠️ 这些键**不能改名**，改了等于清零所有玩家进度。

## 调试入口

- **手机**：连点右下角版本号 5 次 → 暗号 `080825`（解锁后点 3 次开关面板）
- **桌面**：`?debug=1` 或按 `` ` ``
- 面板含：材料 +500 / **场地宽度（390/780/1170/1500 实时切换）** / 无敌 / 一击必碎 / 伤害倍率 / 刷各类敌人 / **→ 处决特写** / 跳波次
- `?mod=gale` 可预览任意每日词缀

## 依赖规则（硬规矩）

1. **运行时零外部请求**：`index.html` 里不得出现指向第三方的 `script` / `link` / `@import` / `fetch`。
   国内 CDN 实测全部不可用（`cdnjs` 超时 / `unpkg` 超时 / `jsdelivr` 连接被关闭），一旦引入外部脚本，
   故障点会出现在你自己的代码之前，控制台连你的报错都看不到。
2. **第三方库一律 vendored**：从 npm 镜像（`registry.npmmirror.com`）下载成品文件放进仓库，用相对路径加载。
   这属于「构建时依赖」，不是运行时依赖——玩家不需要访问任何第三方域名。
3. **保留许可证头**：如 `three.min.js` 的 MIT 声明（`@license Copyright ... SPDX-License-Identifier: MIT`）不能删。
4. **不引入构建步骤**：依然保持「推代码即上线」。

现状：正式版（`game.js` / `audio.js`）零依赖；`proto3d.html` 原型使用 vendored 的 `three.min.js`（r128）。

---

## 代码约定

1. **`ctx.save()` 与 `restore()` 必须严格配对** —— 曾因漏配对导致画面偏移 + 点击错位。
2. **DOM 永远盖在 canvas 上**：处决特写期间要隐藏 `#hud` / `#bottom`。
3. **音乐随机用 `Math.random`，不要用 `sRand`** —— `sRand` 是每日挑战的种子流，占用会破坏确定性。
4. **新增武器/Boss/成就**都是纯数据 + 少量分支，参照 `WEAPON_DEFS` / `BOSS_POOL` / `ACH_LIST` 的既有形状加即可。

## 发布流程

1. 改 `verEl.textContent`（加功能 +0.1，修 bug +0.01）
2. `CHANGELOG.md` 顶部加一条
3. `node --check game.js`（和 `audio.js`）
4. `git commit` → `git tag vX.Y.Z` → 推送
5. 网络受限时用 `_api_push2.js`（GitHub API 推送）与 `_api_tag.js`（建 tag）

线上验证：抓 `https://dddddarkin.github.io/neon-dodge/game.js` 里的 `verEl.textContent` 看版本号，Pages 重建约 45~60 秒。
