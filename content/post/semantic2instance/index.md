---
title: 语义分割数据集转为目标分割
description: 记录一下如何将一个语义分割数据集转为目标分割数据集，同时考虑含洞多边形等特殊情况
slug: semantic2instance
date: 2024-05-01 00:00:00+0000
image: cover.jpg
categories:
    - dev
    - ai
tags:
    - dev
    - ai
---

> 这任务的需求主要是把一个语义分割模型替换成目标检测模型YOLOv8，来更好地实现另一个目标任务，所以需要将语义分割数据集转为目标分割数据集，
> 但由于这个数据集中大部分的目标都为蜂窝状，即其中有大量不规则的多边形洞，所以需要考虑如何处理这种情况  
> 本文中涉及的所有代码都在[https://github.com/4o3F/rgb2yolo](https://github.com/4o3F/rgb2yolo)中，但是没有经过详细的整理，所以有需要的话还需要自行编译修改

## 首次尝试
首次尝试的是[https://github.com/ultralytics/JSON2YOLO](https://github.com/ultralytics/JSON2YOLO)，这是YOLO的开发者写的工具，确实是可以处理带洞多边形，
但是由于跑一次1.2k大小的数据集需要接近7h，这个效率太差了，而且还有个问题在于他会把所有一个class的都合并成为一个物体，导致有大量中间连接线框出的错误像素，因而弃用转而尝试自己编写

## V1
由于最近在写Rust，同时能达到同样开发效率的可能就一个Golang了，但是Golang写这种图片处理的着实有点难搞，因而直接尝试用image和image-proc这两个crate来完成，
这也就是commit 67bfb96bbba71beb57fb1bb5bee07f25e7a105c6的版本，但是由于image的find_contours函数所使用的算法无法处理child的多重从属关系，
所以出来的结果会有很多缺失或者错误部分，因而只能放弃

## V2
这版转而采用了OpenCV的Rust绑定，利用OpenCV完善的find_contours函数与配套算法来完成，同时基于Tokio来实现高性能并行计算(终于能看到CPU跑到90以上而不是Python那边那看着就着急的5了)
具体流程如下  

先要新建个JoinSet来保存所有任务，同时还需要一个Semaphore来确保不会瞬间卡死所有进程，还需要一个保存了class对应关系的map来将不同颜色的数据映射为对象
```rust
let mut threads = JoinSet::new();
let sem = Arc::new(Semaphore::new(10));
let mut color_class_map = HashMap::<Rgb<u8>, u32>::new();
```
而后进入具体处理部分，在此之前需要拿到个信号量
```rust
let permit = Arc::clone(&sem);
let color_class_map = color_class_map.clone();
threads.spawn(async move {
    let _permit = permit.acquire().await.unwrap();
});
```
再读取图片，转换为RGB数据并遍历所有目标颜色
```rust
let img: image::ImageBuffer<Rgb<u8>, Vec<u8>> = image::open(entry.path()).unwrap().into_rgb8();
for (color, class_id) in color_class_map.clone().iter() {}
```
之后就要进入到OpenCV的处理部分了，首先新建一个矩阵来保存灰度图数据，之后遍历所有像素，将目标颜色的图片转为灰度图数据
```rust
let mut mat = opencv::core::Mat::new_rows_cols_with_default(
    768,
    768,
    opencv::core::CV_8U,
    opencv::core::Scalar::all(0.),
)
.unwrap();

// Turn rgb label to gray image mask
for (x, y, pixel) in img.enumerate_pixels() {
    let Rgb([r, g, b]) = pixel;
    let Rgb([tr, tg, tb]) = color;
    if r == tr && g == tg && b == tb {
        // Set mat at x,y to 255
        *mat.at_2d_mut::<u8>(x as i32, y as i32).unwrap() = 255;
    } else {
        *mat.at_2d_mut::<u8>(x as i32, y as i32).unwrap() = 0;
    }
}
```
之后就是调用find_contours函数来获取所有的多边形，注意此时拿到的hierarchy很重要，是后续处理内含洞时候的关键
```rust
let mut contours =
    opencv::core::Vector::<opencv::core::Vector<opencv::core::Point>>::new();

// Same level next
// Same level previous
// Child
// Parent
let mut hierarchy = opencv::core::Vector::<opencv::core::Vec4i>::new();
imgproc::find_contours_with_hierarchy_def(
    &mat,
    &mut contours,
    &mut hierarchy,
    imgproc::RETR_CCOMP,
    imgproc::CHAIN_APPROX_SIMPLE,
)
.unwrap();
```
在之后就是最关键的处理有洞多边形的部分，核心原理是先找到洞边框与外边框最近的点，这两个点之后会用一条线连接起来，让外边框的线从这个链接点进入内部洞的边框，旋转一圈后再链接回外边框，
由于边框的点是有序的，在处理过程中需要将内边框点的顺序翻转，这样才能和外边框连在一起；此外还要注意边框点的数量，少于3个的话无法形成个真正的多边形，因而需要舍弃掉
```rust
let mut combined_contours: Vec<Vec<(i32, i32)>> = Vec::new();

// Now go through all the hierarchy and combine contours
let mut current_index: i32 = 0;
while current_index != -1 && !contours.is_empty() {
    let current_contour = contours.get(current_index as usize).unwrap();
    let current_hierarchy = hierarchy.get(current_index as usize).unwrap();

    let mut parent_points = Vec::<(i32, i32)>::new();
    current_contour.iter().for_each(|point| {
        parent_points.push((point.x, point.y));
    });
    if current_hierarchy.get(2).unwrap() != &-1 {
        // Contain child, go through holes
        let mut child_contour_index = *current_hierarchy.get(2).unwrap();
        loop {
            let child_contour =
                contours.get(child_contour_index as usize).unwrap();
            let child_hierarchy =
                hierarchy.get(child_contour_index as usize).unwrap();

            let mut child_points = Vec::<(i32, i32)>::new();
            child_contour.iter().for_each(|point| {
                child_points.push((point.x, point.y));
            });
            if child_points.len() > 10 {
                // Find the nearest point between child_points and contour_points
                let mut min_distance = f64::MAX;
                let mut child_index = 0;
                let mut parent_index = 0;
                for (i, parent_point) in parent_points.iter().enumerate() {
                    for (j, child_point) in child_points.iter().enumerate() {
                        let distance = f64::from(
                            (parent_point.0 - child_point.0).pow(2)
                                + (parent_point.1 - child_point.1).pow(2),
                        )
                        .sqrt();
                        if distance < min_distance {
                            min_distance = distance;
                            child_index = j;
                            parent_index = i;
                        }
                    }
                }

                // Combine two contours
                let mut new_points = Vec::<(i32, i32)>::new();
                new_points.extend(parent_points.iter().take(parent_index + 1));
                new_points.extend(child_points.iter().skip(child_index));
                new_points.extend(child_points.iter().take(child_index + 1));
                new_points.extend(parent_points.iter().skip(parent_index));
                parent_points = new_points;
            }
            child_contour_index = *child_hierarchy.first().unwrap();
            if child_contour_index == -1 {
                break;
            }
        }
    }
    // No more child
    if parent_points.len() > 10 {
        // Can't form valid polygon
        combined_contours.push(parent_points);
    }

    current_index = *current_hierarchy.first().unwrap();
}
```
再之后就是处理数据，加入最前方的class标志
```rust
for contour in combined_contours.iter() {
    let mut result = String::new();
    result.push_str(class_id.to_string().as_str());
    result.push(' ');
    contour.iter().for_each(|point| {
        result.push_str(&format!(
            "{} ",
            (f64::from(point.1) / f64::from(img.width()))
        ));
        result.push_str(&format!(
            "{} ",
            f64::from(point.0) / f64::from(img.height())
        ));
    });
    result.push('\n');
    labels.push(result);
}
```
最后写入到文件中，注意image默认的写入使用的是std的，并非异步的，因而会拖慢整个异步过程转为同步过程并锁死其他任务，因而需要手动实现异步写文件
```rust
File::create(format!(
    "{}/../output/{}",
    base_path,
    entry
        .file_name()
        .into_string()
        .unwrap()
        .to_string()
        .replace(".png", ".txt")
))
.await
.unwrap()
.write_all(labels.concat().as_bytes())
.await
.unwrap();
```
最终就是等待所有任务结束
```rust
while threads.join_next().await.is_some() {}
```

## 额外备注
在此之外，需要注意的是YOLO本身的数据加载与处理部分写的巨烂无比，充斥着各种magic number和bug，在此说一个和上文相关的就是在其加载polygon数据的时候会通过线性插值将其强制扩充到1000个点，
但是由于物体可能靠着边缘，所以可能会出现直角边缘被线性插值变为斜角的情况，因而可以把resample_segments改为下面的
```python
def resample_segment(s, n):
    # s is a segment with shape (m, 2), where m is the number of points in the segment
    # n is the desired number of points in the resampled segment
    resampled_s = np.empty((0, 2), dtype=s.dtype)
    diff = np.diff(s, axis=0)
    length = np.sum(np.hypot(diff[:, 0], diff[:, 1]))
    step = length / (n - 1)
    current_length = 0
    for i in range(len(s) - 1):
        segment_length = np.hypot(s[i + 1, 0] - s[i, 0], s[i + 1, 1] - s[i, 1])

        while current_length < segment_length and len(resampled_s) < n:
            t = current_length / segment_length
            x = s[i, 0] * (1 - t) + s[i + 1, 0] * t
            y = s[i, 1] * (1 - t) + s[i + 1, 1] * t
            resampled_s = np.vstack((resampled_s, [x, y]))
            current_length += step

        current_length -= segment_length

    if len(resampled_s) < n:
        resampled_s = np.vstack((resampled_s, s[-1]))

    return resampled_s


def resample_segments(segments, n):
    return [resample_segment(s, n) for s in segments]
```
这可以解决上述的问题

> 碎碎念一点.....好希望我自己会画画，这样就能给自己画自设了....头像换来换去还是觉得不老满意的，烦