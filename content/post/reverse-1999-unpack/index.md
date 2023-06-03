---
title: "重返未来: 1999音乐提取"
description: 背景音乐真好听啊
slug: reverse-1999-unpack
date: 2023-06-03 19:00:00+0800
image: cover.jpg
keywords:
    - 重返未来
    - "重返未来: 1999"
    - 背景音乐
    - "Reverse: 1999"
    - background music
    - unpack
categories:
    - dev
tags:
    - dev
---

> 这篇文章只做技术分享(虽然说整体没加密)，不提供任何文件下载等  
> 背景音乐太好听了，受不了只能等UP主扒谱或者官方出OST了

## APK提取
使用apktool提取后可见`assets`目录结构如下
```
.
├── Android
│   ├── audios
│   │   └── Android
│   │       └── en
│   ├── bundles
│   ├── configs
│   ├── luabytes
│   └── videos
│       └── en
├── bin
│   └── Data
│       ├── Managed
│       │   ├── Metadata
│       │   ├── Resources
│       │   └── etc
│       │       └── mono
│       │           ├── 2.0
│       │           │   └── Browsers
│       │           ├── 4.0
│       │           │   └── Browsers
│       │           ├── 4.5
│       │           │   └── Browsers
│       │           └── mconfig
│       └── Resources
└── sdkfile
```
明显可见`audio`目录，进去看一下，发现全都是`.wem`和`.bnk`格式的文件，
这是Wwiss引擎出来的音乐，直接上[foobar2000](https://www.foobar2000.org/)，然后加载[vgmstream encoder](https://www.foobar2000.org/components/view/foo_input_vgmstream)，
之后可以将文件拖拽进来聆听，如果想导出成其他格式的话，需要给foobar2000配编码器，在[foobar网站上有提供免费编码器的合集](https://www.foobar2000.org/getfile/Free_Encoder_Pack-2023-04-30.exe)

在`/assets/Android/audios/Android`下面的是背景音乐，在`/assets/Android/audios/Android/en`下面的是人物原声

推几首个人特别喜欢的，还没完全听完
+ 413740884
+ 606444140
+ 920492058
+ 693995789
+ 1006746416
+ 35865688
+ 140810080

过段时间会写一篇个人对剧情的看法，最近略忙，估计得晚些，听音乐去了🎧🎶