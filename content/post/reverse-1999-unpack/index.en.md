---
title: "Reverse: 1999 Music Extraction"
description: The background music is really good
slug: reverse-1999-unpack
date: 2023-06-03 19:00:00+0800
image: cover.jpg
keywords:
    - "Reverse: 1999"
    - background music
    - unpack
categories:
    - dev
tags:
    - dev
---
> This article was translated by GPT 5.5.

> This article is only for technical sharing (although overall it is not encrypted), and does not provide any file downloads, etc.  
> The background music is so good that I cannot stand it; I can only wait for uploaders to transcribe it or for the official OST

## APK Extraction
After extracting with apktool, the `assets` directory structure is as follows.

{{% details summary="assets directory structure" %}}

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

{{% /details %}}
It is obvious that there is an `audio` directory. After entering it, I found that all the files are in `.wem` and `.bnk` formats.
This is music produced by the Wwise engine. Just use [foobar2000](https://www.foobar2000.org/), then load [vgmstream encoder](https://www.foobar2000.org/components/view/foo_input_vgmstream).
After that, you can drag the files in to listen. If you want to export them to other formats, you need to configure encoders for foobar2000. A collection of free encoders is provided on the [foobar website](https://www.foobar2000.org/getfile/Free_Encoder_Pack-2023-04-30.exe).

The background music is under `/assets/Android/audios/Android`, and the character voice lines are under `/assets/Android/audios/Android/en`.

Recommending a few personal favorites; I have not finished listening to everything yet.
+ 413740884
+ 606444140
+ 920492058
+ 693995789
+ 1006746416
+ 35865688
+ 140810080

I will write a personal take on the story after a while. I have been a bit busy recently, so it will probably be later. I am off to listen to the music 🎧🎶
