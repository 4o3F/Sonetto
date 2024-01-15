---
title: MSVC Clang与LLVM联合配置
description: 记录在Windows MSVC环境下配置Clang与LLVM
slug: msvc-llvm
date: 2024-01-15 00:00:00+0000
image: cover.jpg
categories:
    - dev
tags:
    - dev
    - msvc
    - clang
    - llvm
---
> 不建议使用Visual Studio内置的LLVM发行版，笔者测试的时候无法正常编译

## 下载&安装LLVM
下载链接[https://github.com/llvm/llvm-project/releases/latest](https://github.com/llvm/llvm-project/releases/latest)
找到其中的`LLVM-{version}-win`，按照系统位数下载

## 安装MSVC支持
需要在Visual Studio中至少安装以下的几个组件
+ MSVC生成工具
+ Windows SDK
+ 用于Windows的C++ CMake工具（如果使用CMake而不是NMake的话可以安装）
+ **对 LLVM (clang-cl) 工具集的 MSBuild 支持**

## 配置环境变量
为了让MSVC和Cmake等构建系统识别并使用Clang作为编译器，需要配置多个环境变量，下面逐一解释
+ `PATH`: 将`LLVM/bin`目录添加进系统`PATH`
+ `LIBCLANG_PATH`: `LLVM\bin`指向`clang.exe`和`clang-cl.exe`所在的目录
+ `LLVMInstallDir`: `LLVM`指向LLVM安装的根目录，其中应该包含`include`、`lib`等目录
+ `CC`: `LLVM\bin\clang-cl.exe`设置C编译器为Clang
+ `CXX`: `LLVM\bin\clang-cl.exe`设置CPP编译器为Clang
+ `CMAKE_CXX_COMPILER`: 如果使用CMake的话，同上
+ `CPATH`: 指向MSVC安装的头文件的位置，根据需要手动调整，如`C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\ucrt,C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.38.33130\include`
