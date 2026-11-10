# 独立食物模型资产库

这里是项目模型的正式来源。复制整个 assets 目录即可带走最终模型、阶段校准、来源参考和加工脚本。当前项目从本目录同步到 public 后加载。

## 找模型

- pepperoni-pizza：披萨；rosemary-fries：薯条；classic-burger：汉堡。
- 每类的 processed/mobile 和 processed/desktop 是最终模型，文件名 0–3 对应画面第 1–4 阶段。
- source 保存构建参考和材质烘焙前版本；这些参考不保证是未经修改的上游原始输出。
- catalog.json 是食物 ID、运行文件前缀、阶段数、点击数、缩放、位置、方向及呈现策略的唯一配置入口，应用直接读取。
- manifest.json 记录最终模型哈希、文件大小、网格局部包围盒和处理说明。dimensionsMm 不包含节点变换，不能直接当作最终场景尺寸。
- pipeline 是加工工具存档；各食物 pipeline 保存专用脚本。旧披萨脚本带原项目路径，属于可追溯配方；独立重跑须按输入路径调整，并非一键完整重建。
- reports 保存同步记录和体积报告。

## 新增或替换 GLB

从项目根目录执行（需要 Python 3；烘焙另需 numpy/Pillow）：

```powershell
# 示例：添加只有一个阶段的新资产；相同文件也可同时作为 mobile/desktop 输入
python tools/new_asset.py --food-id dessert --stage-count 1 --stage 0 --mobile C:\models\dessert.glb --desktop C:\models\dessert.glb
python tools/assets.py inventory
python tools/assets.py verify --canonical-only
python tools/assets.py sync
python tools/assets.py verify
```

导入会登记 catalog；已存在模型默认拒绝覆盖，明确替换时加 --force。四阶段食物需导入全部声明阶段后再 inventory。接入菜单还需在 src/data/foods.ts 添加名称、封面、声音及 assetStages('dessert')，并关联菜单条目；仅导入资产不会自动生成菜单。

项目根目录 tools 下是执行入口。独立带走 assets 后，可将 pipeline 中 assets.py / new_asset.py / bake_materials.py 复制到资产包上一级的 tools 目录使用。

## 模型和画面的一致性

最终 GLB 内含食物几何、UV、内嵌贴图和 PBR 材质。此前网页加载后额外做的颜色、粗糙度、金属度调整已烘焙到最终 GLB；场景 extras.foodMaterialsBaked 标记让应用跳过重复调色。几何修复结果已经写入文件。

应用的相机、环境光、色调映射、背景和交互动画仍属于应用。缩放/居中/底部对齐存于 catalog 和应用呈现规则，没有改写顶点坐标。不同软件灯光不同，渲染不会逐像素相同；导入器也须支持文件声明的 EXT_meshopt_compression / EXT_texture_webp 等扩展。本次未在 Blender 等专业软件内逐个验证。

## 优化与体积

旧优化配方使用 glTF-Transform 4.5.1、Meshopt、几何简化比例 0.35、1024px WebP、prune/weld；这是历史配方，不代表所有现有模型都执行过。汉堡桌面版使用更高分辨率贴图；披萨和薯条当前 mobile/desktop 文件基本一致。

本次材质烘焙使用无损 PNG，清理不再引用的贴图数据，保留网格压缩。其目标是独立携带外观，不是承诺网络负载已最优。查看 reports/current-runtime.md 的真实体积。后续压缩应输出候选并进行外观对比后再替换，避免破坏配料细节。
