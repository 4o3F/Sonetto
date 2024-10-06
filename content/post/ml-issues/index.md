---
title: 机器学习踩过的坑
description: 记录一些在折腾机器学习的过程中网上搜不到的奇怪问题
slug: ml-issues
date: 2024-09-20 00:00:00+0000
image: cover.jpg
categories:
  - ai
  - dev
tags:
  - ai
  - dev
---

### OpenCV读取TIFF数据通道错误

表现为即使设置了`imread`的`flag`为`IMREAD_UNCHANGED`，OpenCV读取后只有一个通道或者通道数不对应；更换Pillow后报错

```text
PIL.UnidentifiedImageError: cannot identify image file
```

这时候使用Pillow的TIFF插件开启Debug

```python
from PIL import TiffImagePlugin
TiffImagePlugin.DEBUG = True
with open(image_path, 'rb') as f:
    TiffImagePlugin.TiffImageFile(f)
```

会发现报错

```text
Traceback (most recent call last):
  File ".venv\Lib\site-packages\PIL\TiffImagePlugin.py", line 1409, in _setup
    self._mode, rawmode = OPEN_INFO[key]
                          ~~~~~~~~~^^^^^
KeyError: (b'II', 1, (1,), 1, (16, 16, 16, 16), (0, 0, 0))
```

然而如果将TIF文件用ENVI打开却可以正常浏览，通道数也正确。
接下来查看[Pillow源码](https://github.com/python-pillow/Pillow/blob/5b3d39c116d012a1a533b7a59360b2451addc36a/src/PIL/TiffImagePlugin.py#L140-L258)
中给出的可接受范围

```python
 OPEN_INFO = { 
     # (ByteOrder, PhotoInterpretation, SampleFormat, FillOrder, BitsPerSample, 
     #  ExtraSamples) => mode, rawmode 
     (II, 0, (1,), 1, (1,), ()): ("1", "1;I"), 
     (MM, 0, (1,), 1, (1,), ()): ("1", "1;I"), 
     (II, 0, (1,), 2, (1,), ()): ("1", "1;IR"), 
     (MM, 0, (1,), 2, (1,), ()): ("1", "1;IR"), 
     (II, 1, (1,), 1, (1,), ()): ("1", "1"), 
     (MM, 1, (1,), 1, (1,), ()): ("1", "1"), 
     (II, 1, (1,), 2, (1,), ()): ("1", "1;R"), 
     (MM, 1, (1,), 2, (1,), ()): ("1", "1;R"), 
     (II, 0, (1,), 1, (2,), ()): ("L", "L;2I"), 
     (MM, 0, (1,), 1, (2,), ()): ("L", "L;2I"), 
     (II, 0, (1,), 2, (2,), ()): ("L", "L;2IR"), 
     (MM, 0, (1,), 2, (2,), ()): ("L", "L;2IR"), 
     (II, 1, (1,), 1, (2,), ()): ("L", "L;2"), 
     (MM, 1, (1,), 1, (2,), ()): ("L", "L;2"), 
     (II, 1, (1,), 2, (2,), ()): ("L", "L;2R"), 
     (MM, 1, (1,), 2, (2,), ()): ("L", "L;2R"), 
     (II, 0, (1,), 1, (4,), ()): ("L", "L;4I"), 
     (MM, 0, (1,), 1, (4,), ()): ("L", "L;4I"), 
     (II, 0, (1,), 2, (4,), ()): ("L", "L;4IR"), 
     (MM, 0, (1,), 2, (4,), ()): ("L", "L;4IR"), 
     (II, 1, (1,), 1, (4,), ()): ("L", "L;4"), 
     (MM, 1, (1,), 1, (4,), ()): ("L", "L;4"), 
     (II, 1, (1,), 2, (4,), ()): ("L", "L;4R"), 
     (MM, 1, (1,), 2, (4,), ()): ("L", "L;4R"), 
     (II, 0, (1,), 1, (8,), ()): ("L", "L;I"), 
     (MM, 0, (1,), 1, (8,), ()): ("L", "L;I"), 
     (II, 0, (1,), 2, (8,), ()): ("L", "L;IR"), 
     (MM, 0, (1,), 2, (8,), ()): ("L", "L;IR"), 
     (II, 1, (1,), 1, (8,), ()): ("L", "L"), 
     (MM, 1, (1,), 1, (8,), ()): ("L", "L"), 
     (II, 1, (1,), 2, (8,), ()): ("L", "L;R"), 
     (MM, 1, (1,), 2, (8,), ()): ("L", "L;R"), 
     (II, 1, (1,), 1, (12,), ()): ("I;16", "I;12"), 
     (II, 0, (1,), 1, (16,), ()): ("I;16", "I;16"), 
     (II, 1, (1,), 1, (16,), ()): ("I;16", "I;16"), 
     (MM, 1, (1,), 1, (16,), ()): ("I;16B", "I;16B"), 
     (II, 1, (1,), 2, (16,), ()): ("I;16", "I;16R"), 
     (II, 1, (2,), 1, (16,), ()): ("I", "I;16S"), 
     (MM, 1, (2,), 1, (16,), ()): ("I", "I;16BS"), 
     (II, 0, (3,), 1, (32,), ()): ("F", "F;32F"), 
     (MM, 0, (3,), 1, (32,), ()): ("F", "F;32BF"), 
     (II, 1, (1,), 1, (32,), ()): ("I", "I;32N"), 
     (II, 1, (2,), 1, (32,), ()): ("I", "I;32S"), 
     (MM, 1, (2,), 1, (32,), ()): ("I", "I;32BS"), 
     (II, 1, (3,), 1, (32,), ()): ("F", "F;32F"), 
     (MM, 1, (3,), 1, (32,), ()): ("F", "F;32BF"), 
     (II, 1, (1,), 1, (8, 8), (2,)): ("LA", "LA"), 
     (MM, 1, (1,), 1, (8, 8), (2,)): ("LA", "LA"), 
     (II, 2, (1,), 1, (8, 8, 8), ()): ("RGB", "RGB"), 
     (MM, 2, (1,), 1, (8, 8, 8), ()): ("RGB", "RGB"), 
     (II, 2, (1,), 2, (8, 8, 8), ()): ("RGB", "RGB;R"), 
     (MM, 2, (1,), 2, (8, 8, 8), ()): ("RGB", "RGB;R"), 
     (II, 2, (1,), 1, (8, 8, 8, 8), ()): ("RGBA", "RGBA"),  # missing ExtraSamples 
     (MM, 2, (1,), 1, (8, 8, 8, 8), ()): ("RGBA", "RGBA"),  # missing ExtraSamples 
     (II, 2, (1,), 1, (8, 8, 8, 8), (0,)): ("RGBX", "RGBX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8), (0,)): ("RGBX", "RGBX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8), (0, 0)): ("RGBX", "RGBXX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8), (0, 0)): ("RGBX", "RGBXX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (0, 0, 0)): ("RGBX", "RGBXXX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (0, 0, 0)): ("RGBX", "RGBXXX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8), (1,)): ("RGBA", "RGBa"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8), (1,)): ("RGBA", "RGBa"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8), (1, 0)): ("RGBA", "RGBaX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8), (1, 0)): ("RGBA", "RGBaX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (1, 0, 0)): ("RGBA", "RGBaXX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (1, 0, 0)): ("RGBA", "RGBaXX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8), (2,)): ("RGBA", "RGBA"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8), (2,)): ("RGBA", "RGBA"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8), (2, 0)): ("RGBA", "RGBAX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8), (2, 0)): ("RGBA", "RGBAX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (2, 0, 0)): ("RGBA", "RGBAXX"), 
     (MM, 2, (1,), 1, (8, 8, 8, 8, 8, 8), (2, 0, 0)): ("RGBA", "RGBAXX"), 
     (II, 2, (1,), 1, (8, 8, 8, 8), (999,)): ("RGBA", "RGBA"),  # Corel Draw 10 
     (MM, 2, (1,), 1, (8, 8, 8, 8), (999,)): ("RGBA", "RGBA"),  # Corel Draw 10 
     (II, 2, (1,), 1, (16, 16, 16), ()): ("RGB", "RGB;16L"), 
     (MM, 2, (1,), 1, (16, 16, 16), ()): ("RGB", "RGB;16B"), 
     (II, 2, (1,), 1, (16, 16, 16, 16), ()): ("RGBA", "RGBA;16L"), 
     (MM, 2, (1,), 1, (16, 16, 16, 16), ()): ("RGBA", "RGBA;16B"), 
     (II, 2, (1,), 1, (16, 16, 16, 16), (0,)): ("RGBX", "RGBX;16L"), 
     (MM, 2, (1,), 1, (16, 16, 16, 16), (0,)): ("RGBX", "RGBX;16B"), 
     (II, 2, (1,), 1, (16, 16, 16, 16), (1,)): ("RGBA", "RGBa;16L"), 
     (MM, 2, (1,), 1, (16, 16, 16, 16), (1,)): ("RGBA", "RGBa;16B"), 
     (II, 2, (1,), 1, (16, 16, 16, 16), (2,)): ("RGBA", "RGBA;16L"), 
     (MM, 2, (1,), 1, (16, 16, 16, 16), (2,)): ("RGBA", "RGBA;16B"), 
     (II, 3, (1,), 1, (1,), ()): ("P", "P;1"), 
     (MM, 3, (1,), 1, (1,), ()): ("P", "P;1"), 
     (II, 3, (1,), 2, (1,), ()): ("P", "P;1R"), 
     (MM, 3, (1,), 2, (1,), ()): ("P", "P;1R"), 
     (II, 3, (1,), 1, (2,), ()): ("P", "P;2"), 
     (MM, 3, (1,), 1, (2,), ()): ("P", "P;2"), 
     (II, 3, (1,), 2, (2,), ()): ("P", "P;2R"), 
     (MM, 3, (1,), 2, (2,), ()): ("P", "P;2R"), 
     (II, 3, (1,), 1, (4,), ()): ("P", "P;4"), 
     (MM, 3, (1,), 1, (4,), ()): ("P", "P;4"), 
     (II, 3, (1,), 2, (4,), ()): ("P", "P;4R"), 
     (MM, 3, (1,), 2, (4,), ()): ("P", "P;4R"), 
     (II, 3, (1,), 1, (8,), ()): ("P", "P"), 
     (MM, 3, (1,), 1, (8,), ()): ("P", "P"), 
     (II, 3, (1,), 1, (8, 8), (2,)): ("PA", "PA"), 
     (MM, 3, (1,), 1, (8, 8), (2,)): ("PA", "PA"), 
     (II, 3, (1,), 2, (8,), ()): ("P", "P;R"), 
     (MM, 3, (1,), 2, (8,), ()): ("P", "P;R"), 
     (II, 5, (1,), 1, (8, 8, 8, 8), ()): ("CMYK", "CMYK"), 
     (MM, 5, (1,), 1, (8, 8, 8, 8), ()): ("CMYK", "CMYK"), 
     (II, 5, (1,), 1, (8, 8, 8, 8, 8), (0,)): ("CMYK", "CMYKX"), 
     (MM, 5, (1,), 1, (8, 8, 8, 8, 8), (0,)): ("CMYK", "CMYKX"), 
     (II, 5, (1,), 1, (8, 8, 8, 8, 8, 8), (0, 0)): ("CMYK", "CMYKXX"), 
     (MM, 5, (1,), 1, (8, 8, 8, 8, 8, 8), (0, 0)): ("CMYK", "CMYKXX"), 
     (II, 5, (1,), 1, (16, 16, 16, 16), ()): ("CMYK", "CMYK;16L"), 
     # JPEG compressed images handled by LibTiff and auto-converted to RGBX 
     # Minimal Baseline TIFF requires YCbCr images to have 3 SamplesPerPixel 
     (II, 6, (1,), 1, (8, 8, 8), ()): ("RGB", "RGBX"), 
     (MM, 6, (1,), 1, (8, 8, 8), ()): ("RGB", "RGBX"), 
     (II, 8, (1,), 1, (8, 8, 8), ()): ("LAB", "LAB"), 
     (MM, 8, (1,), 1, (8, 8, 8), ()): ("LAB", "LAB"), 
 } 
```
可以发现对应不上，所以需要手动设置，查看第二列对应的数据应该为`Photometric Interpretation`，用`tiffinfo`查看
```
=== TIFF directory 0 ===
TIFF Directory at offset 0x10 (16)
  Image Width: 36382 Image Length: 36951
  Bits/Sample: 16
  Sample Format: unsigned integer
  Compression Scheme: None
  Photometric Interpretation: min-is-black
  Extra Samples: 3<unspecified, unspecified, unspecified>
  Samples/Pixel: 4
  Rows/Strip: 1
  Planar Configuration: single image plane
  Tag 33550: 2.000000,2.000000,0.000000
  Tag 33922: 0.000000,0.000000,0.000000,1129800.409673,4203018.573073,0.000000
  Tag 34735: 1,1,0,7,1024,0,1,1,1025,0,1,1,1026,34737,22,0,2049,34737,7,22,2054,0,1,9102,3072,0,1,32649,3076,0,1,9001
  Tag 34737: WGS 84 / UTM zone 49N|WGS 84|
  GDAL Metadata: <GDALMetadata>
  <Item name="DataType">Generic</Item>
</GDALMetadata>

  GDAL NoDataValue: 65535
```
接着手动设置对应的Tag，`Photometric Interpretation`对应的为262
```shell
tiffset -d $page-number -s 262 2 input.tif
```
之后还要对齐最后的`ExtraSamples`
```shell
tiffset -d $page-number -s 338 1 2 input.tif
```
然后Pillow和OpenCV就可以正常读取了