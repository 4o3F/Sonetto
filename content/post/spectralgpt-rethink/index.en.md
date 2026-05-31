---
title: SpectralGPT Paper Experiments and Reflections
description: Notes on recent downstream task results, possible issues, and improvement ideas from our group's work based on SpectralGPT
slug: spectralgpt-rethink
date: 2024-09-18 00:00:00+0000
image: cover.jpg
categories:
    - ai
tags:
    - essay
    - ai
---
> This article was translated by GPT 5.5.

## SpectralGPT Network Architecture

Overall, it is still an Encoder-Decoder architecture.
1. The Encoder is a plain Vision Transformer. To reduce computation, it adds an MAE-based pretraining stage.  
2. In both downstream tasks, change detection and semantic segmentation, the Decoder first passes features through convolutional layers for feature fusion, then feeds them into pyramid-structured convolutions for the downstream task.

The main innovation lies in the MAE pretraining stage. Based on the characteristics of remote-sensing multispectral images, it turns the original 2D MAE into a 3D MAE with the channel dimension included.
However, in its implementation, it converts the original channel dimension into a time dimension, then uses `unsqueeze` to create a channel dimension of 1. The code implementation is rather unsatisfactory.

## Downstream Tasks

### Semantic Segmentation
For semantic segmentation, among the three datasets currently available in our group, two aerial datasets reached SOTA level, but performance on the remote-sensing dataset was very poor. I think the main reasons are as follows:
+ Global receptive field issue: the individual image size of the two aerial datasets is 1600x640, the ViT uses img_size 128 and patch_size 16, and many classes do not rely much on a global receptive field.
  Patch splitting only affects a very small part of the edges and has little impact on overall accuracy, so it can reach SOTA.
+ Channel MAE issue: the satellite remote-sensing dataset has only 4 spectral data channels. Compared with the 12-channel dataset used in the original SpectralGPT paper, the channels have higher discreteness and greater differences.
  At the same time, because there are only 4 channels, when splitting channels and performing MAE, they can only be split in groups of 2, which further increases the model's learning difficulty. By contrast, the two aerial datasets,
  because they only use 3 channels, are almost no different from the original ViT+MAE, so reaching SOTA is reasonable. After the aerial dataset was trained with 4 channels as a whole, it also improved by around 10 points compared with before, which is enough to prove that this is a problem.

### Change Detection
For change detection, we tried the WHU dataset, and the results were poor. At present, I guess there are several reasons:
+ Receptive field issue caused by patch splitting: the original paper provides test data on the OSCD dataset, but it cannot achieve good results on the WHU dataset, so I checked the differences between the two datasets.
  It can be seen that the WHU dataset has higher resolution. After being split with 96 pixels as img_size, the amount of data is very large, and many changed buildings are split into two or even three images.
  This prevents the model from observing the overall shape of buildings, which then prevents it from judging where changes occurred. Later attempts to change img_size to 512 still could not effectively improve the F1 score, which also supports this issue.
+ The decoder cannot support complex tasks. Because change detection itself needs to complete both building recognition and change detection, a simple decoder may not be able to handle the task. There is no experimental data supporting this issue;
  it is purely my personal guess.

## Possible Solutions and Follow-up Ideas

1. At present, I think that because patching in a plain ViT will inevitably break the connections between patches, changes need to be made in the embed stage so it can be aware of surrounding information. Here I think the
   Overlapped Patch Embed used in Segformer is a relatively good idea, because it ensures information redundancy between patches.
2. Multi-scale issues. Pyramid models are generally good choices for many tasks, and this can also be proven on models with a CNN backbone.
   Therefore, using multi-layer Transformers or other similar attention mechanisms to implement multi-scale processing may solve the issue effectively.
3. For multiple modalities in the target tasks, the decoder definitely needs to be switched. The main problem is how to let the encoder pretrain on multiple completely different datasets while still extracting features from all of them.
   This may require increasing the dimension sufficiently during the embed process to ensure the model can learn them separately.
