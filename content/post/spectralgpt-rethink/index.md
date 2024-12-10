---
title: SpectralGPT论文实验与相关思考
description: 记录近期组内基于SpectralGPT所做的下游任务效果、可能问题与改进方法
slug: spectralgpt-rethink
date: 2024-09-18 00:00:00+0000
image: cover.jpg
categories:
    - ai
tags:
    - essay
    - ai
---

## SpectralGPT网络结构

整体还是Encoder-Decoder架构
1. Encoder为单纯的Vision Transformer，为了降低运算量添加了基于MAE的预训练阶段  
2. Decoder在变化检测和语义分割两个下游任务中，都是先过卷积层进行特征融合，再输入到金字塔结构的卷积中进行下游任务

主要创新点在于MAE的预训练阶段，针对遥感多光谱图像的特点，将原本属于2D的MAE转变为了带通道这一维度的三维MAE，
但其在实现过程中却是将原本的通道维度转化为一个时间维度，再unsqueeze出一个为1的通道维度来，代码实现差强人意。

## 下游任务

### 语义分割
在语义分割方面，在组内现有的三个数据集上，有两个航拍数据集达到了SOTA水平，然而对于遥感数据集却很差，我认为主要有以下几个原因
+ 全局感受野问题：两个航拍数据集单张图像大小为1600x640，ViT使用的为img_size 128，patch_size 16，同时多个分类不怎么依赖于全局感受野，
  patch切割只会影响边缘的很少一部分，对整体精度影响不大， 因而其效果可以达到SOTA
+ 通道MAE问题：卫星遥感数据集只有4个通道光谱数据，与SpectralGPT原论文中使用的12个通道的数据集相比之下，多个通道间离散程度高、差异性大，
  同时由于只有4个通道因此在对通道进行切分并进行MAE时，只能以2个通道一组进行切分，更加加剧了模型的学习难度；反观两个航拍数据集，
  由于只能以3为通道因此与原始ViT+MAE几乎无差别，达到SOTA也是情理之中，航拍数据集在以4个通道为整体进行训练后也比之前高出了10个点左右，足以证明这是个问题。

### 变化检测
在变化检测方面，尝试了WHU数据集，效果很差，目前猜测有以下几个原因
+ patch切分导致的感受野问题：原文中给出了OSCD数据集的测试数据，然而WHU数据集上却无法达到很好的效果，进而查看下俩数据集的区别。
  可以发现WHU数据集分辨率更高，以96像素为img_size切分后数据量很大，同时很多变化了的建筑物被切分到了两张甚至三张图片中，
  这导致模型无法观察到建筑物整体形状，进而导致其无法判断哪里有变化。后期尝试的将img_size转变为512依然无法有效提升F1分数也可以佐证该问题。
+ decoder无法支撑复杂任务，因为变化监测本身需要同时完成建筑物识别与变化监测两个步骤，因此简单的decoder可能无法完成任务，该问题并没有实验数据佐证，
  单纯为个人猜测。

## 可能的解决方案与后续思路

1. 目前我认为单纯的ViT由于patch势必会破坏相互之间的联系，因此需要在embed阶段做更改使其能够意识到周边信息，这里我认为Segformer中使用的
   Overlapped Patch Embed是一个比较好的思路，保证了patch间的信息冗余。
2. 多尺度问题，金字塔模型对于多种任务来说算是比较好的选择，在CNN backbone的模型上也能证明这一点，
   因此多层Transformer或者其他类似注意力机制来实现多尺度可能可以有效解决。
3. 对于目标中的多模态，decoder肯定是需要切换的，主要问题在于如何让encoder能够在多个完全不同的数据集上面进行pretrain同时还能都提取出特征，
   这可能需要在embed过程中升维足够高，保证模型能分别学习。