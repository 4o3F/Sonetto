---
title: Converting a Semantic Segmentation Dataset to Instance Segmentation
description: Notes on converting a semantic segmentation dataset into an instance segmentation dataset while handling special cases such as polygons with holes
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
> This article was translated by GPT 5.5.

> The requirement for this task was mainly to replace a semantic segmentation model with the object detection model YOLOv8, so another target task could be achieved better. Therefore, the semantic segmentation dataset needed to be converted into an instance segmentation dataset.
> But because most targets in this dataset are honeycomb-like, meaning they contain many irregular polygon holes, how to handle this situation needs to be considered.  
> All code mentioned in this article is in [https://github.com/4o3F/rgb2yolo](https://github.com/4o3F/rgb2yolo), but it has not been carefully organized, so if you need it, you will still need to compile and modify it yourself.

## First Attempt
The first attempt was [https://github.com/ultralytics/JSON2YOLO](https://github.com/ultralytics/JSON2YOLO), a tool written by YOLO's developers. It can indeed handle polygons with holes,
but running once on a dataset of around 1.2k samples takes nearly 7 hours, which is far too inefficient. Another problem is that it merges everything of one class into a single object, causing a lot of incorrect pixels outlined by intermediate connection lines. So I abandoned it and tried writing my own.

## V1
Since I had been writing Rust recently, and probably only Golang can reach a similar development efficiency, but image processing in Golang is honestly a bit troublesome, I directly tried using the `image` and `image-proc` crates to finish it.
This was the version at commit 67bfb96bbba71beb57fb1bb5bee07f25e7a105c6. But because the algorithm used by `image`'s `find_contours` function could not handle multiple child ownership relationships,
the resulting output had many missing or incorrect parts, so I could only give up.

## V2
This version switched to Rust bindings for OpenCV, using OpenCV's complete `find_contours` function and supporting algorithms to finish the task. It also used Tokio to implement high-performance parallel computation. Finally, the CPU could run above 90 instead of Python's anxiety-inducing 5.
The specific flow is as follows.  

First, create a `JoinSet` to store all tasks. A `Semaphore` is also needed to ensure it does not instantly freeze all processes. There also needs to be a map storing class correspondences to map data of different colors to objects.
```rust
let mut threads = JoinSet::new();
let sem = Arc::new(Semaphore::new(10));
let mut color_class_map = HashMap::<Rgb<u8>, u32>::new();
```
Then enter the specific processing part. Before that, a semaphore must be acquired.
```rust
let permit = Arc::clone(&sem);
let color_class_map = color_class_map.clone();
threads.spawn(async move {
    let _permit = permit.acquire().await.unwrap();
});
```
Then read the image, convert it to RGB data, and iterate over all target colors.
```rust
let img: image::ImageBuffer<Rgb<u8>, Vec<u8>> = image::open(entry.path()).unwrap().into_rgb8();
for (color, class_id) in color_class_map.clone().iter() {}
```
After that, enter the OpenCV processing part. First, create a matrix to store grayscale image data, then iterate over all pixels and convert the image for the target color into grayscale image data.

{{% details summary="Grayscale conversion" %}}

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

{{% /details %}}
After that, call the `find_contours` function to obtain all polygons. Note that the `hierarchy` obtained here is very important; it is the key to later handling internal holes.
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
Then comes the most important part: handling polygons with holes. The core principle is to first find the nearest points between the hole border and the outer border. These two points are then connected by a line, so the outer border line enters the inner hole border from this connection point, goes around once, and then connects back to the outer border.
Because the border points are ordered, the order of the inner border points needs to be reversed during processing, so that it can connect with the outer border. Also note the number of border points: if there are fewer than 3, it cannot form a real polygon, so it needs to be discarded.

{{% details summary="Contour handling and polygon generation" %}}

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

{{% /details %}}
After that, process the data and add the class identifier at the front.
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
Finally, write it to the file. Note that `image`'s default writing uses std and is not asynchronous, so it will slow down the whole async process, turn it back into a synchronous process, and block other tasks. Therefore, asynchronous file writing needs to be implemented manually.
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
The final step is to wait for all tasks to finish.
```rust
while threads.join_next().await.is_some() {}
```

## Additional Notes
Besides this, it should be noted that YOLO's own data loading and processing part is written terribly, full of magic numbers and bugs. One issue related to the above is that when it loads polygon data, it forcefully expands it to 1000 points through linear interpolation.
But because an object may touch the image edge, a right-angle edge may be linearly interpolated into a beveled edge. Therefore, `resample_segments` can be changed to the following:

{{% details summary="Improved resample_segments" %}}

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

{{% /details %}}
This can solve the problem described above.

> A little rambling... I really wish I could draw, so I could draw my own OC.... I keep changing avatars, but still never feel especially satisfied with them. Annoying.
