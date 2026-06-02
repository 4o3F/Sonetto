---
title: Superpixel Algorithm Comparison
description: Comparison of commonly used superpixel algorithms as of 2026
slug: superpixel-algorithm-compare
date: 2026-06-02 00:00:00+0000
lastmod: 2024-08-14 00:00:00+0000
image: cover.jpg
categories:
  - research
  - dev
tags:
  - research
  - dev
---

> This article was translated by GPT 5.5.

## 1. What Are Superpixels

Superpixels are an image pre-segmentation method. They aggregate spatially adjacent pixels with similar colors or textures into a number of small regions. Compared with directly processing individual pixels, superpixels convert an image from a **pixel-level representation** into a **region-level representation**.

An ideal superpixel result usually has the following properties:

- **High internal consistency**: pixels inside the same superpixel should belong to the same object, surface, or semantic category as much as possible.
- **Boundaries that fit real image boundaries**: superpixel boundaries should cover object boundaries, semantic boundaries, or salient appearance boundaries as much as possible.
- **A moderate number of regions**: too few regions make the segmentation too coarse and prone to crossing real boundaries; too many regions increase the cost of subsequent computation.

The main purpose of superpixels is not to directly complete semantic segmentation, but to provide a more stable and compact intermediate representation for subsequent image analysis. Common use cases include:

- Image segmentation preprocessing.
- Region-level feature aggregation.
- Object boundary analysis.
- Image annotation propagation.
- Region graph construction.
- Candidate region generation in weakly supervised or interactive segmentation.

In these scenarios, superpixel quality affects the reliability of downstream algorithms. If a superpixel crosses a real semantic boundary, such as containing both road and vehicle pixels, the features or labels later extracted from that region will be mixed and contaminated. Conversely, if superpixels can fit real boundaries well, downstream algorithms can more easily distinguish different objects or semantic categories at the region level.

Therefore, when evaluating superpixel algorithms, we should not only look at the number of regions or only at visual appearance. Instead, we should consider all of the following:

- **Boundary adherence**: whether real semantic boundaries are covered by superpixel boundaries.
- **Region purity**: whether each superpixel avoids mixing multiple real categories as much as possible.
- **Computational cost**: how many superpixel regions are produced for each image.

## 2. Experimental Dataset and Compared Algorithms

### 2.1 Dataset

This comparison uses the full training set of the Cityscapes dataset:

- **Dataset**: Cityscapes
- **Split**: train
- **Processed samples**: 2975 / 2975
- **Failures**: 0

Cityscapes is a commonly used dataset for autonomous driving and street-scene understanding. It contains complex urban street scenes with roads, vehicles, pedestrians, buildings, traffic facilities, and more. It is suitable for testing how well superpixel algorithms fit real semantic boundaries, because the images contain many thin objects, small targets, occlusion relationships, and complex boundaries.

### 2.2 Diagnostic Scope

This experiment only compares the superpixel algorithms themselves. The evaluation covers:

- The degree of overlap between superpixel boundaries and Cityscapes ground-truth semantic boundaries.
- The semantic purity inside superpixel regions.
- The number of superpixels generated per image and the distribution of region sizes.
- Visualization of superpixel boundaries on sample images.

This experiment does not evaluate any downstream tasks, such as semantic segmentation model accuracy, region merging quality, or feature classification performance. Therefore, the conclusions in this article only describe performance at the superpixel level and are not directly equivalent to the final benefit in downstream tasks.

### 2.3 Experimental Configuration

The main configuration of this experiment is as follows:

- **comparison_name**: `superpixel_full`
- **split**: `train`
- **samples**: 2975 / 2975
- **failures**: 0
- **tolerance_px**: 2
- **purity_threshold**: 0.95

Here:

- **tolerance_px = 2**: when evaluating boundary overlap, an offset of up to 2 pixels between superpixel boundaries and ground-truth semantic boundaries is allowed.
- **purity_threshold = 0.95**: if the proportion of pixels belonging to the dominant class inside a superpixel region is lower than 95%, that region is treated as a mixed region.

### 2.4 Compared Algorithms

This comparison includes 6 superpixel methods:

| Method ID | Backend | Description |
|---|---|---|
| `rust_slic_r24_c10` | `rust_slic` | Rust implementation of SLIC, used as the baseline |
| `opencv_slic_r24_c10` | `opencv_slic` | OpenCV SLIC |
| `opencv_slico_r24` | `opencv_slico` | OpenCV SLICO |
| `opencv_mslic_r24_c10` | `opencv_mslic` | OpenCV MSLIC |
| `opencv_lsc_r24` | `opencv_lsc` | OpenCV LSC |
| `opencv_seeds_target_r24` | `opencv_seeds` | OpenCV SEEDS |

These methods cover common superpixel algorithms based on clustering, local search, or seed expansion. The focus of the comparison is not to prove that a certain algorithm is absolutely best in all scenarios, but to observe their differences in boundary adherence, region purity, and cost on Cityscapes street-scene images.

## 3. Evaluation Metrics

This comparison uses the following metrics:

| Metric | Meaning | Trend |
|---|---|---:|
| `recall_t` | The proportion of ground-truth semantic boundaries covered by superpixel boundaries within `tolerance_px=2` | Higher is better |
| `precision_t` | The proportion of superpixel boundaries that align with ground-truth semantic boundaries | Higher is better |
| `f1_t` | Harmonic mean of tolerant precision and tolerant recall | Higher is better |
| `missed_gt_boundary_rate_t` | The proportion of ground-truth semantic boundaries not covered by superpixel boundaries, i.e. `1 - recall` | Lower is better |
| `pixel_impurity` | The proportion of selected pixels that do not belong to the dominant class of their region | Lower is better |
| `mixed_region_pixel_rate` | The proportion of pixels that fall inside mixed regions | Lower is better |
| `mean_num_regions` | The average number of superpixel regions per image | Lower means lower computational cost |

These metrics can be divided into three categories:

- **Boundary coverage metrics**: `recall_t`, `missed_gt_boundary_rate_t`.
- **Region purity metrics**: `pixel_impurity`, `mixed_region_pixel_rate`.
- **Cost metric**: `mean_num_regions`.

It should be noted that all methods have relatively low `precision_t`. This is common in superpixel tasks: superpixel algorithms usually produce many internal region boundaries inside an image, and these boundaries do not necessarily correspond to real semantic boundaries. Therefore, low precision does not necessarily mean that an algorithm has failed; it mainly indicates that the method produces many internal splits.

In this analysis, the more important question is the combined judgment of:

- Whether enough real semantic boundaries are covered.
- Whether cross-category mixed regions are reduced.
- Whether these goals are achieved with an acceptable number of regions.

## 4. Overall Results

### 4.1 Boundary Adherence

| Method | Recall@t | Missed boundary | Precision@t | F1@t |
|---|---:|---:|---:|---:|
| `rust_slic_r24_c10` | 76.10% | 23.90% | 8.09% | 14.63% |
| `opencv_slic_r24_c10` | 80.50% | 19.50% | 7.15% | 13.13% |
| `opencv_slico_r24` | 56.06% | 43.94% | 5.68% | 10.31% |
| `opencv_mslic_r24_c10` | 92.91% | 7.09% | 6.19% | 11.60% |
| `opencv_lsc_r24` | 68.84% | 31.16% | 7.78% | 13.98% |
| `opencv_seeds_target_r24` | 65.38% | 34.62% | 7.04% | 12.72% |

### 4.2 Region Purity and Computational Cost

| Method | Backend | Average region count | Pixel impurity | Mixed-region pixel rate |
|---|---|---:|---:|---:|
| `rust_slic_r24_c10` | `rust_slic` | 4,513.5 | 2.59% | 10.66% |
| `opencv_slic_r24_c10` | `opencv_slic` | 3,824.0 | 2.78% | 11.41% |
| `opencv_slico_r24` | `opencv_slico` | 3,654.8 | 3.27% | 12.45% |
| `opencv_mslic_r24_c10` | `opencv_mslic` | 21,499.9 | 1.76% | 7.15% |
| `opencv_lsc_r24` | `opencv_lsc` | 3,608.2 | 2.96% | 11.63% |
| `opencv_seeds_target_r24` | `opencv_seeds` | 2,048.0 | 3.72% | 14.27% |

The overall results can be summarized as follows:

- **MSLIC has the strongest boundary coverage and region purity, but the number of regions increases significantly.**
- **Rust SLIC has the best overall F1 and a moderate region count, making it the most balanced baseline.**
- **OpenCV SLIC improves boundary recall with a lower region count, but its region purity is slightly worse.**
- **LSC, SEEDS, and SLICO do not show clear advantages under the current configuration.**

## 5. Detailed Algorithm Comparison

### 5.1 MSLIC: Highest Boundary Coverage and Lowest Contamination, but Highest Cost

`opencv_mslic_r24_c10` is the strongest method in this comparison in terms of boundary coverage and region purity:

- **Recall@t**: 92.91%, the best result.
- **Missed GT boundary rate**: 7.09%, the best result.
- **Pixel impurity**: 1.76%, the best result.
- **Mixed-region pixel rate**: 7.15%, the best result.

Compared with `rust_slic_r24_c10`:

- **Boundary recall increase**: +16.72 percentage points.
- **Missed boundary decrease**: -16.81 percentage points.
- **Pixel impurity decrease**: -0.84 percentage points.
- **Mixed-region pixel rate decrease**: -3.51 percentage points.

Sample-level comparison also shows that MSLIC's advantage is very stable:

- On 2974 / 2975 samples, MSLIC has higher boundary recall than Rust SLIC.
- On 2955 / 2975 samples, MSLIC has lower pixel impurity than Rust SLIC.

This indicates that MSLIC's advantage is not caused by a small number of samples, but is consistent across the full Cityscapes train split.

However, MSLIC's weakness is equally obvious: it produces far more regions than the other methods.

- **Average Rust SLIC region count**: 4,513.5.
- **Average MSLIC region count**: 21,499.9.
- **Ratio relative to Rust SLIC**: about 4.63x.
- **MSLIC median region count**: 14,587.
- **MSLIC region count P90**: 43,823.
- **MSLIC maximum region count**: 118,470.

Therefore, MSLIC can be viewed as a high-quality, high-cost option. It is suitable for scenarios that prioritize boundary coverage and region purity, but it should be used cautiously if later processing is sensitive to the number of regions.

Conclusion: **MSLIC is the strongest method in this experiment for boundary adherence and region purity, but it has the highest computational cost and is not suitable as an unconditional default choice.**

### 5.2 Rust SLIC: The Most Balanced Baseline

Although `rust_slic_r24_c10` does not have the highest recall, it performs best in the overall trade-off:

- **F1@t**: 14.63%, the highest among the six methods.
- **Mean regions**: 4,513.5.
- **Pixel impurity**: 2.59%, second only to MSLIC.
- **Mixed-region pixel rate**: 10.66%, second only to MSLIC.

The sample-level F1 winner count is:

- `rust_slic_r24_c10` achieves the best F1 on 2333 / 2975 samples.

This shows that Rust SLIC's advantage lies in balance: it does not increase the number of regions as dramatically as MSLIC, while still maintaining good boundary coverage and region purity.

Conclusion: **Rust SLIC is the most balanced baseline in this comparison and is suitable for scenarios that need to balance quality and computational cost.**

### 5.3 OpenCV SLIC: Low-cost Boundary Recall Improvement, but Slightly Worse Purity

The main characteristic of `opencv_slic_r24_c10` is that it uses fewer regions than Rust SLIC while achieving higher boundary recall:

- **Recall@t**: 80.50%, an increase of +4.40 percentage points compared with Rust SLIC's 76.10%.
- **Mean regions**: 3,824.0, about 15% fewer than Rust SLIC's 4,513.5.

Its drawback is slightly worse region purity:

- **Pixel impurity**: 2.78%, higher than Rust SLIC's 2.59%.
- **Mixed-region pixel rate**: 11.41%, higher than Rust SLIC's 10.66%.
- **F1@t**: 13.13%, lower than Rust SLIC's 14.63%.

The sample-level comparison shows:

- **Recall higher than Rust SLIC**: 2609 / 2975 samples.
- **F1 higher than Rust SLIC**: 232 / 2975 samples.
- **Pixel impurity lower than Rust SLIC**: 490 / 2975 samples.

Conclusion: **OpenCV SLIC is a valuable low-cost option for improving recall. It is not necessarily more balanced than Rust SLIC, but it is worth testing when we want to see whether semantic boundary coverage can still be improved with fewer regions.**

### 5.4 LSC: Did Not Meet Expectations Under the Current Configuration

`opencv_lsc_r24` does not outperform Rust SLIC under the current Cityscapes setting:

- **LSC recall**: 68.84%, lower than Rust SLIC's 76.10%, with a difference of -7.26 percentage points.
- **LSC F1**: 13.98%, lower than Rust SLIC's 14.63%.
- **LSC impurity**: 2.96%, higher than Rust SLIC's 2.59%.
- **LSC mixed rate**: 11.63%, higher than Rust SLIC's 10.66%.

The sample-level comparison is also weak:

- **Recall higher than Rust SLIC**: 3 / 2975 samples.
- **F1 higher than Rust SLIC**: 355 / 2975 samples.
- **Pixel impurity lower than Rust SLIC**: 12 / 2975 samples.

Conclusion: **Under the current `region_size=24` and default LSC ratio configuration, LSC does not have a clear advantage.**

This does not mean that LSC is unusable under all parameter settings, but the current configuration should not be prioritized.

### 5.5 SEEDS: Current Configuration Is Too Coarse and Misses Many Boundaries

`opencv_seeds_target_r24` has a significantly lower average region count than the other methods:

- **Mean regions**: 2048.0.

This lower region count brings lower cost, but it also leads to insufficient boundary coverage:

- **Recall@t**: 65.38%.
- **Missed boundary rate**: 34.62%.
- **Pixel impurity**: 3.72%.
- **Mixed-region pixel rate**: 14.27%.

Compared with Rust SLIC:

- **Recall decrease**: -10.72 percentage points.
- **Pixel impurity increase**: +1.13 percentage points.
- **Mixed-region rate increase**: +3.61 percentage points.
- **Region count is about 0.45x that of Rust SLIC**.

Conclusion: **The current SEEDS configuration is too coarse and tends to miss real semantic boundaries. If SEEDS is evaluated further, the target region count should be increased and swept.**

Possible follow-up configurations include:

- `opencv_seeds_n3600`
- `opencv_seeds_n4500`
- `opencv_seeds_n6000`

### 5.6 SLICO: Weakest Performance Under the Current Configuration

`opencv_slico_r24` is the weakest method in this comparison:

- **Recall@t**: 56.06%.
- **Missed boundary rate**: 43.94%.
- **F1@t**: 10.31%.
- **Pixel impurity**: 3.27%.
- **Mixed-region pixel rate**: 12.45%.

Compared with Rust SLIC, the sample-level comparison shows almost no advantage:

- **Recall higher than Rust SLIC**: 4 / 2975 samples.
- **F1 higher than Rust SLIC**: 4 / 2975 samples.
- **Pixel impurity lower than Rust SLIC**: 4 / 2975 samples.

Conclusion: **SLICO is not suitable as a priority candidate under the current configuration.**

## 6. Sample-level Stability Analysis

To avoid averages hiding sample-level differences, this experiment also counted the best-performing method for each image.

### 6.1 Boundary Recall Winner

| Method | Winning sample count |
|---|---:|
| `opencv_mslic_r24_c10` | 2972 |
| `opencv_slic_r24_c10` | 2 |
| `rust_slic_r24_c10` | 1 |

Explanation: **MSLIC almost completely dominates the other methods in boundary recall.**

### 6.2 Boundary F1 Winner

| Method | Winning sample count |
|---|---:|
| `rust_slic_r24_c10` | 2333 |
| `opencv_lsc_r24` | 338 |
| `opencv_slic_r24_c10` | 149 |
| `opencv_mslic_r24_c10` | 124 |
| `opencv_seeds_target_r24` | 31 |
| `opencv_slico_r24` | 0 |

Explanation: **Rust SLIC has a clear advantage in F1, which shows that it is more balanced between boundary coverage and over-segmentation.**

### 6.3 Pixel Impurity Winner

| Method | Winning sample count |
|---|---:|
| `opencv_mslic_r24_c10` | 2949 |
| `rust_slic_r24_c10` | 19 |
| `opencv_slic_r24_c10` | 7 |

Explanation: **MSLIC has a strongly consistent advantage in reducing mixed-label region contamination.**

## 7. Visualization Results

### 7.1 Visualization File Locations

To avoid exposing internal experiment prefixes in the article source, representative visualization images have been copied into the `images/` folder next to the report.

Each method contains two types of images:

- **Contact sheet**: visualization of superpixel boundary overlays on sample images.
- **Region report**: statistics for the number of regions and the average region-area distribution.

### 7.2 Representative Image References

#### Rust SLIC baseline

![Rust SLIC contact sheet](images/rust_slic_contact_sheet.png)

![Rust SLIC region report](images/rust_slic_region_report.png)

#### OpenCV SLIC

![OpenCV SLIC contact sheet](images/opencv_slic_contact_sheet.png)

![OpenCV SLIC region report](images/opencv_slic_region_report.png)

#### OpenCV MSLIC

![OpenCV MSLIC contact sheet](images/opencv_mslic_contact_sheet.png)

![OpenCV MSLIC region report](images/opencv_mslic_region_report.png)

#### OpenCV SEEDS

![OpenCV SEEDS contact sheet](images/opencv_seeds_contact_sheet.png)

![OpenCV SEEDS region report](images/opencv_seeds_region_report.png)

### 7.3 Visualization Interpretation

From the contact sheets, we can see that different algorithms use the same batch of Cityscapes sample images, so boundary density and coverage style can be compared directly.

Combined with `train_report.png` and the numerical results, the following observations can be made:

- **MSLIC has the densest boundaries and covers small objects and complex boundaries more thoroughly.** This is consistent with its 92.91% boundary recall and 1.76% pixel impurity. However, its region count distribution has an obvious long tail, with a maximum region count of 118,470.
- **Rust SLIC has moderate boundary density, with the region count concentrated around 4.5k/image.** It does not have extremely high boundary coverage like MSLIC, but it maintains good region purity and the best F1.
- **OpenCV SLIC has fewer regions than Rust SLIC, but higher recall.** It can be used as a candidate method for improving boundary coverage at low cost.
- **The current SEEDS configuration is clearly coarser, with an average region count of only 2048.** This is consistent with its lower recall and higher impurity, indicating that the current configuration tends to miss real semantic boundaries.
- **LSC and SLICO do not show visual or statistical advantages over Rust SLIC under the current parameters.**

The visualization results are consistent with the metric conclusions:

- **MSLIC provides the highest boundary coverage and lowest contamination, but at the cost of obvious over-segmentation and computational overhead.**
- **Rust SLIC is the more balanced baseline.**
- **OpenCV SLIC is a low-cost candidate worth further validation.**
- **SEEDS, LSC, and SLICO should not be prioritized under the current configuration.**

## 8. Final Conclusion

This comparison of superpixel algorithms on the Cityscapes train split shows that:

- **MSLIC is the strongest method in boundary coverage and region purity.**
- **Rust SLIC is the most balanced baseline between quality and cost.**
- **OpenCV SLIC is a valuable low-cost candidate for improving recall.**
- **LSC, SEEDS, and SLICO do not have clear advantages under the current configuration.**

The most important numerical results are:

- **MSLIC reduces the missed GT boundary rate from 23.90% to 7.09%.**
- **MSLIC reduces pixel impurity from 2.59% to 1.76%.**
- **MSLIC reduces the mixed-region pixel rate from 10.66% to 7.15%.**
- **MSLIC increases the average region count from about 4.5k to about 21.5k/image.**

Therefore, the overall recommendations are:

- **If the goal is the highest boundary coverage and lowest region contamination, prioritize MSLIC.**
- **If the goal is to balance quality and computational cost, Rust SLIC is still the safer choice.**
- **If the goal is to improve boundary recall at lower cost, OpenCV SLIC is worth further evaluation.**
- **Under the current configuration, LSC, SLICO, and SEEDS are not recommended as priority choices.**

The confidence levels of this report's conclusions are:

- **Superpixel-level conclusions**: High.
- **Cross-dataset generalization conclusions**: Medium, requiring validation on other datasets.
- **Downstream task benefit inference**: Medium, requiring validation on specific tasks.
