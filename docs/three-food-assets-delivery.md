# 三类食物四阶段交付记录

2026-11-09；工作目录 D:/project/jiaoguang。执行顺序为实际参考图生成 → 建模 → 几何/材质微调 → mobile/desktop接入。

## 交付范围与来源

| 食物 | 实际来源 | 四阶段 | 展示模式 |
| --- | --- | --- | --- |
| 黄金炸鸡块 | image/gpt-image-2.5单块参考图 → Lux3D CN任务4954280 → 单一纹理网格共享实例 | 6/4/2/1块；幸存块固定transform | physical-size-stable，所有阶段scale1/position0/yaw0 |
| 鲜柠气泡饮 | image/gpt-image-2.5参考图 → 本地闭合参数杯/液体/冰/柠檬，实际参考果肉采样 | 可用内高85/60/35/10% | physical-size，杯体不变 |
| 浓郁巧克力布朗尼 | image/gpt-image-2.5整块参考图 → Lux3D CN任务4955541 → UV保持裁切/独立蛋糕内部封面 | 完整/75/50/25%宽度 | physical-size-stable，统一物理标定 |

每类source4、processed8、public runtime8个GLB均已就位。catalog与manifest含全部新食物的来源、派生过程、哈希、字节及限制。参考图原件与生成任务记录在 food-showcase-reference-prompts.json；cover来自实际参考图。饮品封面保留不透明白底以保护玻璃边缘；菜单卡片使用实际可旋转3D预览。

炸鸡mobile每块32018三角形，六块192108；四阶段共2092708字节，desktop共4826108字节。手机几何比原候选减少约65%。布朗尼实际解码整块约80×34.996×64.998mm，后三阶段宽度约60/40/20mm，量化误差在报告内。饮品实际85×120×85mm，液体可用内高8..118mm。

## 验收证据

- 严格GLB校验通过48个canonical GLB及对应runtime；旧三类食物86个GLB哈希与接入前完全一致。
- Python工具测试16项通过；其中新增NUL JSON padding拒绝、合法空格padding/零BIN接受和稳定展示枚举回归。
- 最终完整Vitest139项/20文件全部通过，包含独立review发现的饮品音频问题对应2个新增回归。最终生产构建（包含tsc）与48资产严格校验再次通过。
- 类型检查与生产构建通过。构建仍提示Three主体bundle大于500KB，未为本任务额外改动拆包结构。
- Playwright：showcase-foods、burger、pizza、rosemary-fries共15项通过，包含390/1440px三新食物的四阶段、每阶段3次交互、结束与replay，以及旧食品拖转、错误重试和设置持久化。
- 新菜单3D预览单独2项双端测试通过：加载ready、拖转更改rotation、保持菜单不误导航、无pageerror。
- 实际截图位于 artifacts/showcase-browser/，每类每端各4阶段；另有菜单预览截图。测试均使用真实磁盘资产，不使用临时响应改写。
- 固定原点数学回归覆盖多阶段bounds、多幸存点、多yaw/pitch与相机投影，幸存部分位置不因当前bounds重居中而漂移。旧食品展示模式保持不变。
- 透明材质fade保留原始opacity/transparent/depthWrite；饮品无crumbs/recoil。启用声音时显式跳过固体录音及合成咀嚼音，保留触觉及里程碑提示音。

## 费用与限制

本次两次有效Lux3D图生模型报价各20 credits，合计40；授权预算2000，剩余1960。图片生成另走所选image渠道，不在Lux3D credits中。未因截图、简化、裁切、透明体本地建模增加Lux收费任务。

炸鸡重复同一原型，底面未认证为完全水密；布朗尼原模型有15条非流形微边，裁切后继承计数10/7/4，source封口无开放边，但优化后未认证完美流形。切面为带孔隙纹理的平面盖；饮品采用alpha透明近似以避免嵌套透射重影，冰块简化、浅底低液位偏淡，不声称真实物理折射。manifest的dimensionsMm为mesh-local accessor范围，含Meshopt量化时不能代替真实世界尺寸；真实尺寸来自Three解码后的Box3报告。

相关可复现脚本、完整命令、原始下载、报告与接入前备份位于 artifacts/chicken-image3d、artifacts/lemonade-reference3d、artifacts/brownie-image3d；独立Lux REPORT回执另存各任务目录。未提交体验FEEDBACK。
