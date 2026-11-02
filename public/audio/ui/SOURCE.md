# 阶段与完成提示音

作者：Kenney (https://kenney.nl)。许可：CC0 1.0，允许个人和商业使用。

- `stage-transition.wav`：Interface Sounds 的 `confirmation_001.wav`，原文件未修改，约 0.295 秒。来源：https://kenney.nl/assets/interface-sounds 。下载镜像：https://cdn.jsdelivr.net/gh/Calinou/kenney-interface-sounds@1.0.0/addons/kenney_interface_sounds/confirmation_001.wav 。运行时阶段递进升调，低音量与咀嚼并行。
- `complete.ogg`：Music Jingles 的 `Pizzicato jingles/jingles_PIZZI10.ogg`，上行拨弦短句。来源：https://kenney.nl/assets/music-jingles 。从官方网站下载并保留原包许可。增加轻量双回声与尾部淡出，最终约 1.18 秒。风格参考休闲手游奖励反馈，未使用 Cut the Rope 游戏原声。

加工命令：

```sh
ffmpeg -i jingles_PIZZI10.ogg -af 'apad=pad_dur=0.25,aecho=0.8:0.7:70|130:0.18|0.1,afade=t=out:st=0.85:d=0.35' -c:a libvorbis -q:a 5 complete.ogg
```

Music Jingles 原包许可见 LICENSE-Kenney.txt。Interface Sounds 官方页面同样标注 CC0：https://creativecommons.org/publicdomain/zero/1.0/ 。
