---
title: ICPC 西安区域赛 2025 办赛总结&备忘录
description: 总结下此次ICPC西安区域赛办赛中遇到的问题以及潜在改进方法
slug: icpc-2025-regional-review
date: 2025-10-21 00:00:00+0800
image: cover.jpg
categories:
  - daily
  - dev
tags:
  - daily
  - dev
---

## 前期准备

### 选手机

由于ICPC World Final官方镜像2025的直接是磁盘镜像文件了，因此这回还是采用2024版本的镜像。  
注意由于选手机需要完全断电再搬运，有的时间会乱掉，因此需要搭建起来一台NTP授时服务器，采用[ntpd-rs](https://github.com/pendulum-project/ntpd-rs)
来搭建。

Natsume的`static`目录下的结构记录如下
```text
static/
├── caddy.deb
├── client_config.toml
├── clion.key
├── configure_client.sh
├── configure_judgehost.sh
├── key.pub
├── natsume_client
├── wallpaper.jpg
└── wallpaper.png
```

其他部分依然维持之前的配置不变，批量化处理等现有的Natsume功能已经能够完全覆盖了，无须新的更改。

### 服务器

#### PHP相关配置
+ 在`/etc/php/8.3/fpm/php.ini`中设置`memory_limit = 2G`，因为题目被处理过程中如果样例点等过大会导致爆内存
+ 修改MariaDB配置`/etc/mysql/my.cnf`
  ```
  [mysqld]
  max_connections=1000
  innodb_log_file_size=512M
  max_allowed_packet=500M
  ```
+ 将`admin`和`jury`加到DomJudge这个Team里面，这样上传题目的时候会自动测试Jury Solution
+ 上传完队伍图片和学校LOGO后要确认权限，`sudo chown -R www-data:www-data /opt/domjudge/domserver/webapp/public`
+ CDS必须要使用Linux来跑，Windows上跑不起来会有奇奇怪怪的问题
+ presAdmin和presClient注意要有不同的指令
  ```
  .\presAdmin.bat https://10.12.13.20:2335/api/contests/ presAdmin <password>
  .\client.bat https://10.12.13.20:2335/api/ presentation <password>
  ```
+ 注意CDS配置的时候CCS URL最后不能有/，不然的话他会把/也识别为contest id的一部分，很无语
+ presClient的中文，这是老问题了需要换字体来修复

#### 优化后的外榜反代
优化了外榜缓存，使其缓存所有需要的文件类型
```Caddyfile
{
    auto_https off
    debug
    cache {
        ttl 0s
    }
}

:80 {
    @staticfile path_regexp allowed_files \.(js|css|png|jpg|ttf|woff2|svg|ico)$
    handle @staticfile {
        cache {
            ttl 604800s
        }
        reverse_proxy http://10.12.13.20 {
            header_down Cache-Control "public, max-age=604800, must-revalidate"
        }
    }

    handle /* {
        cache {
            ttl 3s
            stale 5s
        }
        rewrite * /public?static=true
        reverse_proxy http://10.12.13.20
    }
}
```

#### 打印

新编写的打印代码，主要是为了解决中文编码问题，直接换Typst了也省着Latex那么重的依赖了

比赛到一半有个队报告说他们无法打印，查了下才发现他们队名里面带`# ""`导致Typst编译不了了，紧急临时加了个转义给干过去了

~~~python
#!/usr/bin/env python3
import subprocess
import sys
import tempfile
import os
import random
from datetime import datetime

# 允许的文件 MIME 类型映射到 Typst 语法高亮名称
ALLOWED_MIME = {
    "text/x-c": "C",
    "text/x-c++": "Cpp",
    "text/x-java-source": "Java",
    "text/x-python": "Python",
    "text/x-script.python": "Python",
    "text/plain": "Python",  # 有些系统将 Python 标记为 text/plain
}

# 打印机 IP 地址列表
PRINTER_IPS = ['10.12.13.150','10.12.13.151','10.12.13.152','10.12.13.153']

OUTPUT_DIR = "/opt/domjudge/print_backup"

def escape_typst_string(s: str) -> str:
    """
    转义会破坏 Typst 字符串/语法的字符：
    - 先转义反斜杠
    - 再转义双引号（因为我们把文本放在双引号里）
    - 再转义大括号，防止与 Typst 内部插值或块冲突
    """
    if s is None:
        return ""
    s = s.replace("\\", "\\\\")
    s = s.replace('"', '\\"')
    s = s.replace("{", "\\{")
    s = s.replace("}", "\\}")
    return s


def main():
    # 检查输入参数数量。仅在参数不足时输出简短错误信息。
    if len(sys.argv) < 8:
        print("Error: Missing required script arguments.")
        sys.exit(1)

    file_path, original, language, username, teamname, teamid, location = sys.argv[1:8]
    teamname = escape_typst_string(teamname)
    

    # --- 步骤 1: 检查 MIME 类型 ---
    try:
        # 检测文件 MIME 类型
        mime_type = subprocess.check_output(["file", "-b", "--mime-type", file_path], text=True).strip()
    except subprocess.CalledProcessError:
        print("Error: Failed to detect file type.")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: Required 'file' command not found.")
        sys.exit(1)

    if mime_type not in ALLOWED_MIME:
        print("Error: Unsupported file type. Printing denied.")
        sys.exit(1)

    lang_detected = ALLOWED_MIME[mime_type]

    # --- 步骤 2: 确保输出目录存在 ---
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --- 步骤 3: 生成 Typst 模板并编译 PDF ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pdf_filename = f"team{teamid}_{timestamp}.pdf"
    pdf_file = os.path.join(OUTPUT_DIR, pdf_filename)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        typst_file = os.path.join(tmpdir, "print.typ")

        # 读取源代码内容
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as src:
                code = src.read()
        except IOError:
            print("Error: Failed to read source file.")
            sys.exit(1)

        # 构建 Typst 内容
        typst_content = f"""
#set text(font: "Noto Sans CJK SC", size: 9pt)
#set page(
    header: [
        // 左侧展示 teamname
        #text(8pt, "Team Name: {teamname}")
        // 弹性空间，将右侧元素推到最右边
        #h(1fr) 
        // 右侧展示 location
        #text(8pt, "Location: {location}")
        // 页眉底部分隔线
        #line(length: 100%)
    ],
    margin: (x: 1cm, y: 1.5cm)
)

= Source Code: {original}

```{lang_detected.lower()}
{code}
```
"""
        # 写入临时文件供编译
        with open(typst_file, "w", encoding="utf-8") as f:
            f.write(typst_content)

        # 编译 Typst 到 PDF
        try:
            # 确保 'typst-cli' 已安装并配置在 PATH 中
            # 成功时不输出任何信息
            subprocess.run(["typst", "compile", typst_file, pdf_file], check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            # 编译失败，输出简洁错误信息
            print("Error: Source code compilation failed.")
            sys.exit(1)
        except FileNotFoundError:
            print("Error: Required 'typst' command not found.")
            sys.exit(1)

    # --- 步骤 4: 随机选择打印机并推送打印任务 ---
    
    if not PRINTER_IPS:
        print("Error: No printer addresses configured.")
        sys.exit(1)

    chosen_ip = random.choice(PRINTER_IPS)
    curl_url = f'http://{chosen_ip}:12306/'
    
    # 移除：print(f"Selected printer IP: {chosen_ip}")

    # 构建 curl 命令
    curl_cmd = [
        'curl',
        '-X', 'POST',
        '--fail-with-body', 
        '--connect-timeout', '10', 
        '--max-time', '30',        
        '-H', 'Content-Type: application/octet-stream',
        '--data-binary', f'@{pdf_file}', 
        curl_url
    ]

    try:
        # 执行 curl 命令
        print_result = subprocess.run(
            curl_cmd, 
            check=True, 
            capture_output=True, 
            text=True
        )
        
        # --- 步骤 5: 输出最终结果 ---
        # 成功时，仅输出主要的成功信息
        print(f"✅ Print job successfully dispatched")
        # 移除：打印机响应的详细 stdout/stderr
        
    except subprocess.CalledProcessError as e:
        # 打印任务失败，输出简洁的错误信息和服务器响应（如果存在）
        server_response = e.stdout.strip()
        if server_response:
            print(f"❌ Print job failed to dispatch. Server responded: {server_response}")
        else:
            print(f"❌ Print job failed to dispatch. Check network connection or printer status.")
        sys.exit(1)
        
    except FileNotFoundError:
        print("Error: Required 'curl' command not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()
~~~

对应的DomJudge内的打印指令如下

```shell
python3 /opt/domjudge/print_filter_typst.py [file] [original] [language] [username] [teamname] [teamid] [location] 2>&1
```

#### 滚榜

~~Resolver的字体还需要更多字体，相比于presentation，直接替换成黑体会出问题，还得合并原始的和新的字体~~
在付出了接近3天的各种折腾时间后，鉴于实际滚榜的时候给了10GB内存仍然爆炸，我们一致同意写Resolver这玩意的人有点问题，与其折腾他不如自己重新写一个来得快，就跟Natsume一样，准备下回之前搓一个出来

## 赛中问题

相比于上回邀请赛的一团乱麻这回算是比预料中的好太多了，毕竟全程基本只有我一个人在搞，再加上OrangeJ师兄抽空帮我配一下评测机+赛时帮忙，之前搞过的部分这回基本没出啥问题

除了DomJudge在热身赛的时候莫名其妙的崩了，表现为CPU负载不高，PHP FPM进程看起来完全健康，然而就是直接访问不了，重启下PHP FPM立刻就能好，主要是这没有任何错误日志，
也无法稳定复现，因为前一天我们自己拿Oha试了下跑压力测试啥事没有，就很奇怪，后来准备把能想到的部分都改一遍，根据正赛情况判断主要问题应该出现在下面这个地方

```
pm = static
pm.max_children = 500      ; ~40 per gig of memory(16gb system -> 500)
pm.max_requests = 5000
pm.status_path = /fpm_status
```

默认的max_children是40，完全撑不起来赛场所有选手的访问，在这之后由于无法确认到底真的修复了没有，觉得起一种简单粗暴的办法，直接监控死了就重新拉，让GPT搓了一个出来

```shell
#!/bin/bash

# ========== 配置部分 ==========
URL="http://10.12.13.20/public"     # 要监控的URL
TIMEOUT=5                           # 超时时间（秒）
INTERVAL=5                          # 每次检查间隔（秒）
SERVICE="php8.3-fpm"                # 要重启的服务名，可改成 php8.2-fpm 等
LOG_FILE="./fpm_monitor.log"
# ==============================

while true; do
    START_TIME=$(date +%s%3N)
    HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time $((TIMEOUT)) "$URL")
    END_TIME=$(date +%s%3N)

    ELAPSED_MS=$((END_TIME - START_TIME))
    ELAPSED_SEC=$(echo "scale=3; $ELAPSED_MS / 1000" | bc)

    if (( $(echo "$ELAPSED_SEC > $TIMEOUT" | bc -l) )) || [ "$HTTP_CODE" -ne 200 ]; then
        fpm_status=$(curl -s --max-time 1 http://localhost:8080/fpm_status)
        echo $fpm_status >> "$LOG_FILE"
        echo -e "\n" >> "$LOG_FILE"
        echo "$(date '+%F %T') [WARN] $URL response time ${ELAPSED_SEC}s or code=$HTTP_CODE, restarting $SERVICE" >> "$LOG_FILE"
        systemctl restart "$SERVICE"
    else
        echo "$(date '+%F %T') [INFO] $URL response time ${ELAPSED_SEC}s or code=$HTTP_CODE" >> "$LOG_FILE"
    fi

    sleep "$INTERVAL"
done
```

但即使这样，在正赛的最后，由于所有人全都再狂交直接把服务器CPU全部打满，到了是崩了下，但由于拉的够快选手应该几乎无感觉

全程监控可见主服务器宽带基本稳定在50MB/s的状态，而外榜服务器则全程打满，下回需要给两台服务器都搞成链路聚合的，不然网络压力过大了。

热身赛完事后，俩人全都一门心思在保证正赛别崩上，俩人谁都没搞过滚榜，也都没看出来Unfreeze Time不对🤦‍♂️，导致一结束直接放榜了，下回注意直接不设置Unfreeze Time就好了，
滚榜的话就看之后重新写一个解析程序来搞吧，Resolver实在是太难用了，很难想象一个最新稳定版没有之前版本兼容性强的程序.......