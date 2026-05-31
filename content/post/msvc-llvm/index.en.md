---
title: Configuring MSVC Clang with LLVM
description: Notes on configuring Clang and LLVM in a Windows MSVC environment
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
> This article was translated by GPT 5.5.

> I do not recommend using the LLVM distribution bundled with Visual Studio; it could not compile properly in my tests

## Download & Install LLVM
Download link [https://github.com/llvm/llvm-project/releases/latest](https://github.com/llvm/llvm-project/releases/latest)
Find `LLVM-{version}-win` and download the build matching your system architecture.

## Install MSVC Support
At minimum, install the following components in Visual Studio
+ MSVC build tools
+ Windows SDK
+ C++ CMake tools for Windows (install this if you use CMake instead of NMake)
+ **MSBuild support for LLVM (clang-cl) toolset**

## Configure Environment Variables
To let MSVC and build systems such as CMake recognize and use Clang as the compiler, configure several environment variables, explained one by one below
+ `PATH`: add the `LLVM/bin` directory to the system `PATH`
+ `LIBCLANG_PATH`: `LLVM\bin`, pointing to the directory containing `clang.exe` and `clang-cl.exe`
+ `LLVMInstallDir`: `LLVM`, pointing to the root directory of the LLVM installation, which should contain directories such as `include` and `lib`
+ `CC`: `LLVM\bin\clang-cl.exe`, setting the C compiler to Clang
+ `CXX`: `LLVM\bin\clang-cl.exe`, setting the CPP compiler to Clang
+ `CMAKE_CXX_COMPILER`: if using CMake, same as above
+ `CPATH`: points to the location of the MSVC-installed header files. Adjust manually as needed, for example `C:\Program Files (x86)\Windows Kits\10\Include\10.0.22621.0\ucrt,C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.38.33130\include`
