# 篝火远征队 Campfire Expedition

像素风放置挂机小队 RPG（网页版优先，后续打包安卓 APK）。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 战斗模拟单元测试
npm run build      # 生成 dist/ 静态网页
```

## 目录

- `src/sim/` 纯逻辑战斗模拟（固定步长 0.1s，与渲染解耦，可用于离线结算）
- `src/data/` 职业 / 怪物 / 地图配置
- `src/art/` 程序生成的像素占位美术
- `src/scenes/` Phaser 场景与 HUD
