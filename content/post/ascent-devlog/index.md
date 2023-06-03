---
title: Ascent开发记录
description: 记录一下Ascent开发过程中遇到的那些Android问题和解决方案
slug: ascent-devlog
date: 2023-06-03 00:00:00+0000
image: cover.jpg
categories:
    - dev
tags:
    - dev
---

## 前言

> Ascent目前并未开源，等待正式发布后一段时候才会开源，这主要是为了防止整个项目直接被人拿走加一堆广告就四处分发，
> 但是主题程序我也没有做加固，防君子不防小人

Ascent原本是为了方便单设备在安卓系统上获取米哈游游戏的抽卡历史记录链接而开发的，
但后来发现这一整套流程也可以用于其他需要adb shell权限来运行的程序，比如说冰箱等，
方便在只有单独一台设备而无电脑的情况下开启

整个程序开源后我也会尝试将其变为一个通用型的工具软件。

开发过程中由于高版本安卓系统的限制以及ADB自身的一些限制，对于我这水平的还是有不小的难度的，
尤其是大量资料版本过老或者不正确，造成了不小的麻烦。在此我会将主要要点梳理一下，供想要走类似途径的人查阅。

由于整体高度依赖ADB无线调试，因此无法在无Wifi的情况下使用，暂时没有想到绕过的办法。

## ADB配对与连接

ADB无线调试必须要先进行配对后才能进行连接，配对的时候双方会交换密钥进行认证，
这个过程原本我想的是用Rust来写一个模拟的，灵感来源自[https://github.com/MuntashirAkon/libadb-android](https://github.com/MuntashirAkon/libadb-android)

我的具体代码在这里[https://github.com/4o3F/Antagonism](https://github.com/4o3F/Antagonism)
进行了小一个月的尝试(菜的一P)但是最终没能成功。尤其是在安卓的ADB无法直接当成一个模块替换，而GDB调试我又不是很熟练的情况下，无法解决ADB Host解密失败的问题，如果有佬能指出问题所在将不胜感激
![ADB unable to decrypt](adb-unable-to-decrypt.png)
测试后怀疑是SPAKE2交换数据的地方出现了问题，可能是BoringSSL和RustCrypto的实现不一致，
但是我无法自己实现一个可行的，在折磨了半个月后遂放弃该方案。

方向转变为直接将原本在Windows和Linux上运行的ADB Client端移植到ARM平台来运行
现有资料都是基于低版本的ADB，而带着配对功能的ADB Client则版本更高，无奈只能用现有资料拼凑出了一份可行方案，暂时也未开源[https://github.com/4o3F/adb4arm](https://github.com/4o3F/adb4arm)择时公开


## 安卓应用运行二进制文件

## 安卓权限与ADB改造

## Flutter Isolated与Background Service

## Flutter Rust Bridge与多线程数据同步


> 持续更新中，未完待续   
> 最后更新： 2023/6/3
