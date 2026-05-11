---
title: ICPC 西安邀请赛 2026 总结
description: ICPC 西安邀请赛 2026 总结
slug: icpc-2026-review
date: 2026-05-02 17:00:00+0800
image: cover.jpg
categories:
  - daily
  - dev
tags:
  - daily
  - dev
---

> 本次邀请赛运维方面几乎没出什么问题（机器太烂死机这我是真没辙），只有对部分流程有些许调整，本文后续可能会拓展（取决于我能想起来多少细节）

## 优化脚本

### Excel随机密码生成

修正了随机性问题，确保没有重复

{{% details summary="VBA代码" %}}

```vba
Option Explicit

Private GeneratedPasswords As Collection
Private IsRandomized As Boolean

Function RandomPassword(length As Integer) As String
    Dim chars As String
    Dim i As Integer
    Dim result As String
    Dim attempts As Long
    
    ' 参数校验
    If length < 1 Or length > 128 Then
        RandomPassword = "ERROR: 密码长度必须在 1~128 之间"
        Exit Function
    End If
    
    ' 仅首次初始化随机种子
    If Not IsRandomized Then
        Randomize
        IsRandomized = True
    End If
    
    ' 初始化集合
    If GeneratedPasswords Is Nothing Then
        Set GeneratedPasswords = New Collection
    End If
    
    Const charsSet As String = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    chars = charsSet
    
    attempts = 0
    On Error Resume Next          ' 只设置一次
    
    Do
        attempts = attempts + 1
        
        result = ""
        For i = 1 To length
            result = result & Mid(chars, Int(Rnd() * Len(chars)) + 1, 1)
        Next i
        
        GeneratedPasswords.Add result, result
        
        If Err.Number = 0 Then
            Exit Do
        Else
            Err.Clear
        End If
        
        If attempts > 10000 Then
            On Error GoTo 0
            Err.Raise vbObjectError + 513, "RandomPassword", _
                "在10000次尝试内未能生成不重复的密码，请检查长度参数。"
        End If
    Loop
    
    On Error GoTo 0
    RandomPassword = result
End Function

' 重置函数（可选）
Sub ResetPasswordGenerator()
    Set GeneratedPasswords = Nothing
    IsRandomized = False
    MsgBox "密码生成器已重置。", vbInformation
End Sub
``` 

{{% /details %}}
### 打印脚本 (DomJudge)

{{% details summary="参考代码" %}}

```python
#!/usr/bin/env python3
import subprocess
import sys
import tempfile
import os
import random
import re
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
PRINTER_IPS = ['10.12.13.231','10.12.13.232','10.12.13.233','10.12.13.234']
#PRINTER_IPS = ['10.12.13.233']

OUTPUT_DIR = "/opt/domjudge/print_backup"

def escape_typst_string(s: str) -> str:
    if s is None:
        return ""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def typst_text(s: str) -> str:
    return f'#text("{escape_typst_string(s)}")'


def raw_block(content: str, lang: str) -> str:
    longest = max((len(match.group(0)) for match in re.finditer(r"`+", content)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}{lang}\n{content}\n{fence}"


def main():
    # 检查输入参数数量。仅在参数不足时输出简短错误信息。
    if len(sys.argv) < 8:
        print("Error: Missing required script arguments.")
        sys.exit(1)

    file_path, original, language, username, teamname, teamid, location = sys.argv[1:8]
    teamname_text = typst_text(f"Team Name: {teamname}")
    location_text = typst_text(f"Location: {location}")
    original_text = typst_text(f"Source Code: {original}")

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

        code_block = raw_block(code, lang_detected.lower())

        # 构建 Typst 内容
        typst_content = f"""
#set text(font: "Noto Sans CJK SC", size: 9pt)
#set page(
    header: [
        #text(8pt, [{teamname_text}])
        #h(1fr)
        #text(8pt, [{location_text}])
        #line(length: 100%)
    ],
    margin: (x: 1cm, y: 1.5cm)
)

= {original_text}

{code_block}
"""
        # 写入临时文件供编译
        with open(typst_file, "w", encoding="utf-8") as f:
            f.write(typst_content)
        # 编译 Typst 到 PDF
        try:
            # 确保 'typst-cli' 已安装并配置在 PATH 中
            # 成功时不输出任何信息
            typst_cmd = ["/usr/local/bin/typst", "compile", typst_file, pdf_file]
            subprocess.run(typst_cmd, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print("Error: Source code compilation failed.")
            print(f"Temp directory: {tmpdir}")
            print(f"Typst file: {typst_file}")
            print(f"Typst file exists: {os.path.exists(typst_file)}")
            if os.path.exists(typst_file):
                print(f"Typst file size: {os.path.getsize(typst_file)}")
            print(f"Temp directory entries: {os.listdir(tmpdir)}")
            print(f"Output PDF: {pdf_file}")
            print(f"Command: {' '.join(typst_cmd)}")
            print(f"Return code: {e.returncode}")
            if e.stdout:
                print(f"Typst stdout:\n{e.stdout}")
            if e.stderr:
                print(f"Typst stderr:\n{e.stderr}")
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
```

{{% /details %}}

### 打印脚本 (Client)

需要下一个`SumatraPDF.exe`放入对应的位置，这样可以避免打印机不支持直接打印raw PDF stream的时候卡死在任务队列中。

{{% details summary="参考代码" %}}

```python
import secrets
import shutil
import subprocess
import time
from pathlib import Path
from wsgiref.simple_server import make_server

BASE_DIR = Path(__file__).resolve().parent
SUMATRA_PATH = BASE_DIR / "SumatraPDF" / "SumatraPDF.exe"
LOG_FILE = BASE_DIR / "Print.log"
SUCCESS_DIR = BASE_DIR / "Success"
ERROR_DIR = BASE_DIR / "Error"
TEMP_DIR = BASE_DIR / "Temp"
CHARSET = "23456789qwertyupasdfghjkzxcvbnm"
PORT = 12306


def random_filename(length=10):
    return "".join(secrets.choice(CHARSET) for _ in range(length)) + ".pdf"


def print_target_file(filename):
    try:
        filename = filename.resolve()
        print(f"PDF path before print: {filename}")
        print(f"PDF exists before print: {filename.exists()}")
        print(f"PDF size before print: {filename.stat().st_size if filename.exists() else 'missing'}")
        print(f"SumatraPDF path: {SUMATRA_PATH}")
        print(f"SumatraPDF exists: {SUMATRA_PATH.exists()}")

        print_cmd = [
            str(SUMATRA_PATH),
            "-print-to-default",
            "-silent",
            str(filename),
        ]
        result = subprocess.run(
            print_cmd,
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"Print failed for {filename.name} with return code {result.returncode}")
            print(f"Print command: {print_cmd!r}")
            if result.stdout:
                print(f"SumatraPDF stdout:\n{result.stdout}")
            if result.stderr:
                print(f"SumatraPDF stderr:\n{result.stderr}")
            return False

        print(f"Submitted print job for {filename.name}")
        return True
    except Exception as exc:
        print(f"Print failed for {filename.name}: {exc}")
        return False


def log_status(filename, success):
    target_dir = SUCCESS_DIR if success else ERROR_DIR
    target_dir.mkdir(exist_ok=True)
    current_date = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    status = "Success" if success else "Failed"

    with LOG_FILE.open("a", encoding="utf-8") as log_file:
        log_file.write(f"{current_date} {status}: {filename.name}\n")

    try:
        shutil.copy2(filename, target_dir / filename.name)
    except OSError as exc:
        with LOG_FILE.open("a", encoding="utf-8") as log_file:
            log_file.write(f"{current_date} Copy failed: {filename.name}: {exc}\n")


def read_content_length(environ):
    try:
        return max(0, int(environ.get("CONTENT_LENGTH") or 0))
    except ValueError:
        return 0


def application(environ, start_response):
    request_length = read_content_length(environ)
    TEMP_DIR.mkdir(exist_ok=True)
    filename = TEMP_DIR / random_filename()

    with filename.open("wb") as output_file:
        output_file.write(environ["wsgi.input"].read(request_length))

    success = print_target_file(filename)
    log_status(filename, success)

    start_response("200 OK", [("Content-Type", "text/plain; charset=utf-8")])
    return [b"Successful."]


if __name__ == "__main__":
    httpd = make_server("0.0.0.0", PORT, application)
    print(f"serving http on port {PORT}...")
    httpd.serve_forever()

```

{{% /details %}}

### 压测

此次正赛前用新写的[Onyx压测工具](https://github.com/4o3F/Onyx)对全流程做了压力测试，效果不错能很显著的预先发现问题。  
DomJudge官方的压测工具都好几年没更新了，而且还是scala写的，很难绷。

### 滚榜

此次滚榜首次在生产环境测试了新写的[Pyrite滚榜](https://github.com/4o3F/Pyrite)，目前来看效果还可以，详细的使用教程可以见GitHub上的README。  
目前现在残余的问题有如下几个：

+ 主持人无法单次点击后直接到下一个奖项揭幕，导致需要台下有人来配合点，就会有配合不到位的情况，后续需要优化下变成点击一次直接跳到下一个奖项出现。
+ 添加一个配置项，使得n个队伍滚榜完成后，滚动展示这n个队伍，然后再进入下一组颁奖。

### 选手机相关

由于这次完全切换到了2026新版镜像，Natsume以及配套的client configure脚本等都有较多的修正，以及为了适配Brotli压缩进而搞得本地TLS终结。  
详细的可见后续更新过的Natsume README，或者看最近的commit log。

## Contest Live Deploy - 完整制作流程

从 raw disk image 制作 Debian Live USB 部署盘，支持空盘和双系统(Windows+Linux)场景，关键步骤需人工确认。

### 前置条件

- 一台 Debian/Ubuntu 机器（用于构建）
- 原始 raw disk image 文件（假设路径为 `/path/to/contest.img`）
- 一个 USB 存储设备

### Step 0: 安装依赖

```bash
sudo apt update  
sudo apt install -y \
  live-build \
  squashfs-tools \
  debootstrap \
  kpartx \
  dosfstools \
  parted
```

### Step 1: 从 raw image 中提取 rootfs 并打包为 squashfs

{{% details summary="提取rootfs并打包squashfs" %}}

```bash
# 创建工作目录
mkdir -p ~/contest-work && cd ~/contest-work

# 挂载 raw image
# kpartx 会自动解析分区表并创建 /dev/mapper/loopXpN 设备
sudo kpartx -av /path/to/contest.img

# 查看分区映射，找到 Linux root 分区（通常是最大的 ext4 分区）
lsblk -f /dev/loop0    # 确认哪个分区是 rootfs

# 挂载 rootfs 分区（loop0p4 是 ext4 rootfs）
sudo mkdir -p /mnt/img-root
sudo mount /dev/mapper/loop0p4 /mnt/img-root

# 确认挂载内容正确
ls /mnt/img-root/
# 应该能看到 bin/ etc/ home/ usr/ var/ 等标准 Linux 目录结构

# 打包为 squashfs（排除不需要的目录）
sudo mksquashfs /mnt/img-root filesystem.squashfs \
  -comp zstd \
  -Xcompression-level 19 \
  -e boot/efi \
  -e proc \
  -e sys \
  -e dev \
  -e run \
  -e tmp \
  -e lost+found \
  -e swap.img \
  -progress

# 完成后取消挂载
sudo umount /mnt/img-root
sudo kpartx -dv /path/to/contest.img

echo "squashfs 大小:"
ls -lh filesystem.squashfs
```

{{% /details %}}

> **注意**：如果 image 中的 rootfs 不是 loop0p4，请根据 `lsblk -f /dev/loop0` 的输出调整。
> 如果压缩速度太慢或目标机器解压慢，可以换用 `-comp lz4` 牺牲压缩率换速度。

### Step 2: 初始化 live-build 项目

{{% details summary="初始化live-build项目" %}}

```bash
mkdir -p ~/contest-live && cd ~/contest-live

# 如果是全新开始，清理旧状态（保留 cache）
sudo lb clean 2>/dev/null

lb config \
  --distribution bookworm \
  --archive-areas "main contrib non-free non-free-firmware" \
  --mirror-bootstrap "https://mirrors.tuna.tsinghua.edu.cn/debian/" \
  --mirror-chroot "https://mirrors.tuna.tsinghua.edu.cn/debian/" \
  --mirror-binary "https://mirrors.tuna.tsinghua.edu.cn/debian/" \
  --mirror-chroot-security "https://mirrors.tuna.tsinghua.edu.cn/debian-security/" \
  --mirror-binary-security "https://mirrors.tuna.tsinghua.edu.cn/debian-security/" \
  --debian-installer none \
  --memtest none \
  --binary-images iso-hybrid \
  --bootloaders grub-efi \
  --architectures amd64 \
  --linux-flavours amd64 \
  --apt-indices false \
  --cache true
```

{{% /details %}}

### Step 3: 添加需要的软件包

```bash
cat > config/package-lists/contest.list.chroot <<'EOF'
parted
dosfstools
e2fsprogs
squashfs-tools
grub-efi-amd64
grub-efi-amd64-bin
arch-install-scripts
os-prober
pciutils
usbutils
EOF
```


### Step 4: 放入 squashfs 镜像

```bash
mkdir -p config/includes.chroot/usr/local/share/icpc/

ln ~/contest-work/filesystem.squashfs \
   config/includes.chroot/usr/local/share/icpc/filesystem.squashfs
```

### Step 5: 创建安装脚本

由于需要人工交互确认，不适合放在 live-config hook（hook 在后台执行，无 TTY）。
改为：**脚本放入 PATH，通过 autologin + `.bash_profile` 在登录时自动启动。**

#### 5a: 安装脚本

{{% details summary="contest-install安装脚本" %}}

```bash
mkdir -p config/includes.chroot/usr/local/bin/

cat > config/includes.chroot/usr/local/bin/contest-install <<'SCRIPTEOF'
#!/bin/bash
set -euo pipefail

# ============================================================
# Contest Image Installer
# Supports:
#   - empty disk:  create full GPT (EFI + root)
#   - dual-boot:   preserve Windows, overwrite Linux partition
# Interactive: key steps require manual confirmation
# ============================================================

SQUASHFS="/usr/local/share/icpc/filesystem.squashfs"
MOUNT_TARGET="/mnt/target"

# ── Colors ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
banner() {
    echo ""
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  $*${NC}"
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════${NC}"
    echo ""
}

# ── Confirm prompt ──────────────────────────────
confirm() {
    local msg="$1"
    echo ""
    echo -e "${YELLOW}${BOLD}WARNING: $msg${NC}"
    read -rp "  Type 'yes' to continue, anything else to abort: " answer
    if [[ "$answer" != "yes" ]]; then
        err "Aborted by user."
        exit 1
    fi
    echo ""
}

# ── Preflight ───────────────────────────────────
[ "$EUID" -eq 0 ] || { err "Must run as root"; exit 1; }
[ -f "$SQUASHFS" ] || { err "squashfs not found: $SQUASHFS"; exit 1; }

banner "Contest Image Installer"

# ════════════════════════════════════════════════
# PHASE 1: 选择目标磁盘
# ════════════════════════════════════════════════

# 检测 Live 介质
LIVE_DEV=$(lsblk -ndo PKNAME "$(findmnt -no SOURCE /run/live/medium 2>/dev/null)" 2>/dev/null || true)
[ -n "$LIVE_DEV" ] && LIVE_DEV="/dev/$LIVE_DEV"

log "Available disks:"
echo ""
echo "  ┌──────────────────────────────────────────────────────┐"
lsblk -dpo NAME,SIZE,MODEL,TRAN | while IFS= read -r line; do
    dev=$(echo "$line" | awk '{print $1}')
    if [[ "$dev" == "$LIVE_DEV" ]]; then
        echo -e "  │ ${line}  ${YELLOW}← Live USB${NC}"
    else
        echo "  │ $line"
    fi
done
echo "  └──────────────────────────────────────────────────────┘"
echo ""

while true; do
    read -rp "Enter target disk (e.g. sda, nvme0n1): " TARGET_DISK
    if [[ ! -b "/dev/$TARGET_DISK" ]]; then
        err "Device /dev/$TARGET_DISK does not exist, try again"
        continue
    fi
    if [[ "/dev/$TARGET_DISK" == "$LIVE_DEV" ]]; then
        err "Cannot select the Live USB medium, try again"
        continue
    fi
    break
done

log "Target disk: /dev/$TARGET_DISK"

# ════════════════════════════════════════════════
# PHASE 2: 分析分区 — 判断空盘 or 双系统
# ════════════════════════════════════════════════

banner "Analyzing Partitions"

EFI_PART=""
LINUX_ROOT_PART=""
WINDOWS_PARTS=()
DISK_MODE=""  # "dual-boot" | "empty"

PART_COUNT=$(lsblk -lno NAME "/dev/$TARGET_DISK" | tail -n +2 | wc -l)

if [[ "$PART_COUNT" -eq 0 ]]; then
    DISK_MODE="empty"
    warn "Disk is empty (no partition table)"
else
    log "Current partition layout:"
    echo ""
    lsblk -o NAME,SIZE,FSTYPE,PARTLABEL,PARTTYPE "/dev/$TARGET_DISK"
    echo ""

    while IFS= read -r part; do
        devpath="/dev/$part"
        part_type=$(blkid -s PART_ENTRY_TYPE -o value "$devpath" 2>/dev/null || true)
        fs_type=$(blkid -s TYPE -o value "$devpath" 2>/dev/null || true)

        # EFI System Partition
        if [[ "${part_type^^}" == "C12A7328-F81F-11D2-BA4B-00A0C93EC93B" ]]; then
            EFI_PART="$devpath"
            log "  EFI partition: $EFI_PART ($fs_type)"
            continue
        fi

        # Microsoft 分区 (by GUID) — but check actual filesystem first
        case "${part_type^^}" in
            EBD0A0A2-B9E5-4433-87C0-68B6B72699C7|\
            E3C9E316-0B5C-4DB8-817D-F92DF00215AE|\
            DE94BBA4-06D1-4D40-A16A-BFD50179D6AC)
                # ext4/ext3/xfs/btrfs with MS GUID = Linux target (OEM quirk)
                if [[ "$fs_type" =~ ^(ext[234]|xfs|btrfs)$ && -z "$LINUX_ROOT_PART" ]]; then
                    LINUX_ROOT_PART="$devpath"
                    log "  Linux partition (MS GUID): $LINUX_ROOT_PART ($fs_type) — ${RED}WILL FORMAT${NC}"
                else
                    WINDOWS_PARTS+=("$devpath")
                    log "  Windows partition: $devpath ($fs_type) — ${GREEN}KEEP${NC}"
                fi
                continue
                ;;
        esac

        # NTFS/exFAT — 视为 Windows
        if [[ "$fs_type" == "ntfs" || "$fs_type" == "exfat" ]]; then
            WINDOWS_PARTS+=("$devpath")
            log "  NTFS/exFAT partition: $devpath — ${GREEN}KEEP${NC}"
            continue
        fi

        # Linux 分区 (by standard Linux GUID) — 取第一个作为目标
        if [[ -z "$LINUX_ROOT_PART" ]]; then
            case "${part_type^^}" in
                0FC63DAF-8483-4772-8E79-3D69D8477DE4|\
                4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709)
                    LINUX_ROOT_PART="$devpath"
                    log "  Linux partition: $LINUX_ROOT_PART ($fs_type) — ${RED}WILL FORMAT${NC}"
                    ;;
            esac
        fi

        # Other partitions (swap, OEM recovery, etc.) — skip silently
        if [[ -n "$fs_type" ]]; then
            log "  Other partition: $devpath ($fs_type) — ${GREEN}KEEP${NC}"
        fi
    done < <(lsblk -lno NAME "/dev/$TARGET_DISK" | tail -n +2)

    # 判断模式: 有 EFI + 有 Linux 分区 → dual-boot (preserve other partitions)
    if [[ -n "$LINUX_ROOT_PART" && -n "$EFI_PART" ]]; then
        DISK_MODE="dual-boot"
    else
        DISK_MODE="empty"
        warn "No EFI + Linux partition found, treating as empty disk"
    fi
fi

log "Disk mode: $DISK_MODE"

# ════════════════════════════════════════════════
# PHASE 3: 确定分区策略 + 人工确认
# ════════════════════════════════════════════════

banner "Partition Strategy"

case "$DISK_MODE" in
    dual-boot)
        log "Strategy: Preserve Windows, overwrite Linux partition only"
        log "  EFI  : $EFI_PART (keep, no format)"
        log "  Root : $LINUX_ROOT_PART (will format as ext4)"
        log "  Windows partitions (${#WINDOWS_PARTS[@]}): all preserved"
        confirm "Format $LINUX_ROOT_PART ? (Windows partitions untouched)"
        ;;

    empty)
        log "Strategy: Create new GPT partition table"
        log "  Partition 1: EFI System Partition (512 MiB, FAT32)"
        log "  Partition 2: Linux root (all remaining space, ext4)"
        confirm "Create new partition table on /dev/$TARGET_DISK ? (ALL data will be lost)"
        ;;
esac

# ════════════════════════════════════════════════
# PHASE 4: 执行分区
# ════════════════════════════════════════════════

banner "Partitioning"

if [[ "$DISK_MODE" == "empty" ]]; then
    log "Creating GPT partition table..."
    parted -s "/dev/$TARGET_DISK" mklabel gpt
    parted -s "/dev/$TARGET_DISK" mkpart ESP fat32 1MiB 513MiB
    parted -s "/dev/$TARGET_DISK" set 1 esp on
    parted -s "/dev/$TARGET_DISK" mkpart contest-root ext4 513MiB 100%
    sfdisk --part-type "/dev/$TARGET_DISK" 2 4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709
    partprobe "/dev/$TARGET_DISK"
    udevadm settle

    if [[ "$TARGET_DISK" == nvme* ]]; then
        EFI_PART="/dev/${TARGET_DISK}p1"
        LINUX_ROOT_PART="/dev/${TARGET_DISK}p2"
    else
        EFI_PART="/dev/${TARGET_DISK}1"
        LINUX_ROOT_PART="/dev/${TARGET_DISK}2"
    fi

    log "Formatting EFI partition..."
    mkfs.fat -F32 "$EFI_PART"
fi

# 格式化 Linux root 分区
log "Formatting $LINUX_ROOT_PART as ext4..."
umount "$LINUX_ROOT_PART" 2>/dev/null || true
mkfs.ext4 -F -L "contest-root" "$LINUX_ROOT_PART"

# 显示最终分区布局
log "Final partition layout:"
lsblk -o NAME,SIZE,FSTYPE,PARTLABEL "/dev/$TARGET_DISK"

confirm "Partitioning done. Continue with system installation?"

# ════════════════════════════════════════════════
# PHASE 5: 解压系统
# ════════════════════════════════════════════════

banner "Extracting System Files"

mkdir -p "$MOUNT_TARGET"
mount "$LINUX_ROOT_PART" "$MOUNT_TARGET"

log "Extracting squashfs (this may take a few minutes)..."
unsquashfs -f -d "$MOUNT_TARGET" "$SQUASHFS"

# 确保关键目录存在
mkdir -p "$MOUNT_TARGET"/{proc,sys,dev,run,tmp,boot/efi}

log "Extraction complete"
log "Disk usage:"
df -h "$MOUNT_TARGET" | tail -1

# ════════════════════════════════════════════════
# PHASE 6: 安装 bootloader
# ════════════════════════════════════════════════

banner "Installing GRUB Bootloader"

mount "$EFI_PART" "$MOUNT_TARGET/boot/efi"

# 生成 fstab
log "Generating fstab..."
cat > "$MOUNT_TARGET/etc/fstab" <<EOF
# Auto-generated by contest-image-install
EOF
genfstab -U "$MOUNT_TARGET" >> "$MOUNT_TARGET/etc/fstab"

log "fstab contents:"
cat "$MOUNT_TARGET/etc/fstab"
echo ""

log "Installing GRUB..."
PATH=/usr/sbin:$PATH arch-chroot "$MOUNT_TARGET" \
    grub-install --target=x86_64-efi \
                 --efi-directory=/boot/efi \
                 --bootloader-id=GRUB \
                 --no-nvram

PATH=/usr/sbin:$PATH arch-chroot "$MOUNT_TARGET" update-grub

log "GRUB installed"

# ════════════════════════════════════════════════
# PHASE 7: Cleanup
# ════════════════════════════════════════════════

banner "Installation Complete"

umount "$MOUNT_TARGET/boot/efi" 2>/dev/null || true
umount "$MOUNT_TARGET" 2>/dev/null || true
sync

echo -e "${GREEN}${BOLD}"
echo "  Installation complete"
echo "  Disk: /dev/$TARGET_DISK"
echo "  EFI:  $EFI_PART"
echo "  Root: $LINUX_ROOT_PART"
if [[ ${#WINDOWS_PARTS[@]} -gt 0 ]]; then
    echo "  Windows partitions preserved (${#WINDOWS_PARTS[@]})"
fi
echo -e "${NC}"
echo ""
read -rp "Press Enter to reboot, or Ctrl+C to stay in Live environment: "
reboot
SCRIPTEOF

```

{{% /details %}}

```bash
chmod +x config/includes.chroot/usr/local/bin/contest-install
```

#### 5b: 自动登录并启动脚本

Debian Live 的 `live-config` 会创建默认用户 `user` 并自动登录，因此：
- `.bash_profile` 放到 `/etc/skel/`（`user` 创建时会拷贝）
- 配置免密 sudo，脚本通过 `sudo` 调起

```bash
# 默认用户的 .bash_profile — 登录时自动运行安装脚本
mkdir -p config/includes.chroot/etc/skel/

cat > config/includes.chroot/etc/skel/.bash_profile <<'EOF'
# Auto-launch contest installer on first login
if [ -z "$CONTEST_INSTALL_LAUNCHED" ]; then
    export CONTEST_INSTALL_LAUNCHED=1
    echo ""
    echo "======================================"
    echo "  Contest Image Installer"
    echo "  wait for auto-start..."
    echo "======================================"
    echo ""
    sudo contest-install
fi
EOF
```

配置免密 sudo（让默认用户可以无密码执行安装脚本）：

```bash
mkdir -p config/includes.chroot/etc/sudoers.d/

cat > config/includes.chroot/etc/sudoers.d/contest-install <<'EOF'
# Allow live user to run contest-install without password
user ALL=(root) NOPASSWD: /usr/local/bin/contest-install
EOF

chmod 440 config/includes.chroot/etc/sudoers.d/contest-install
```

### Step 6: 配置 GRUB 启动菜单

```bash
mkdir -p config/includes.binary/boot/grub/

cat > config/includes.binary/boot/grub/grub.cfg <<'EOF'
set default=0
set timeout=5

menuentry "Contest Installer" {
    linux  /live/vmlinuz-* boot=live components quiet
    initrd /live/initrd.img-*
}

menuentry "Contest Installer (Debug - verbose)" {
    linux  /live/vmlinuz-* boot=live components
    initrd /live/initrd.img-*
}
EOF
```

### Step 7: 构建 ISO

```bash
cd ~/contest-live
sudo lb build 2>&1 | tee build.log
```

> 构建时间取决于网络速度和 squashfs 大小，通常 10-30 分钟。
> 产出文件：`live-image-amd64.hybrid.iso`

### Step 8: 写入 U 盘

```bash
# 确认 U 盘设备（请根据实际情况替换 sdX）
lsblk

# 写入（iso-hybrid 格式可以直接 dd）
sudo dd if=live-image-amd64.hybrid.iso of=/dev/sdX bs=4M status=progress oflag=sync
```

> 需要批量部署时，准备多个 U 盘，每个都 dd 一份即可。

### 完整目录结构参考

```
~/contest-live/
├── config/
│   ├── package-lists/
│   │   └── contest.list.chroot                           # 额外安装的包
│   ├── includes.chroot/
│   │   ├── usr/local/bin/
│   │   │   └── contest-install                           # 安装脚本（交互式）
│   │   ├── usr/local/share/icpc/
│   │   │   └── filesystem.squashfs                       # 目标系统 rootfs
│   │   ├── etc/skel/
│   │   │   └── .bash_profile                             # 自动启动安装脚本
│   │   └── etc/sudoers.d/
│   │       └── contest-install                           # 免密 sudo
│   └── includes.binary/
│       └── boot/grub/
│           └── grub.cfg                                  # GRUB 启动菜单
└── live-image-amd64.hybrid.iso                           # 最终产物
```

### 部署流程（现场操作）

```
1. U 盘插入目标机器 → UEFI 选择 USB 启动
2. GRUB 菜单 5 秒倒计时 → "Contest Installer"
3. live-config autologin as user → 10s auto-start installer
4. 脚本交互流程：
   ┌─────────────────────────────────────────────────┐
   │ 显示所有磁盘 → [人工] 输入目标磁盘名           │
   │ 分析分区 → 自动判断: 空盘 or 双系统            │
   │   空盘:   创建 GPT + EFI + root                │
   │   双系统: 保留 Windows，仅覆盖 Linux 分区      │
   │ → [人工] 确认分区操作                           │
   │ 执行分区 + 格式化                               │
   │ → [人工] 确认继续安装                           │
   │ 解压 squashfs + 安装 GRUB                       │
   │ → [人工] 按回车重启                             │
   └─────────────────────────────────────────────────┘
5. 拔掉 U 盘，从硬盘启动
```

约 5-10 分钟/台，含人工确认时间。

---

## (Optional) DOMjudge Judgehost Setup Script

> Reference: https://www.domjudge.org/docs/manual/9.0/install-judgehost.html

One-shot script to configure a deployed machine as a DOMjudge judgehost.
Can be run manually after deployment, or baked into the image before Step 1 (mksquashfs).

Create the script:

{{% details summary="JudgeHost配置脚本" %}}

```bash
cat > setup-judgehost.sh <<'JUDGEEOF'
#!/bin/bash
set -euo pipefail

# ╔════════════════════════════════════════════════════════════╗
# ║  DOMjudge Judgehost Setup Script                          ║
# ║  Edit the variables below before running                  ║
# ╚════════════════════════════════════════════════════════════╝

# ── Configuration (EDIT THESE) ─────────────────────────────
DJVER="9.0.0"
DOMSERVER_URL="http://10.12.13.20/api/"
JUDGEHOST_USER="judgehost"
JUDGEHOST_PASS="passw0rd"
INSTALL_PREFIX="/opt/domjudge"
# CPU cores to use for judging (space-separated), e.g. "0 1 2 3"
JUDGE_CORES="0"
# ───────────────────────────────────────────────────────────

echo "[1/8] Switching to BFSU mirror and installing dependencies..."
sudo sed -i 's/cn.archive.ubuntu.com/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list
sudo sed -i 's/archive.ubuntu.com/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list
sudo sed -i 's/security.ubuntu.com/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list
sudo apt-get update -qq
sudo apt-get install -y -qq make pkg-config sudo debootstrap libcgroup-dev \
    php-cli php-curl php-json php-xml php-zip lsof procps gcc g++ wget
sudo apt-get remove -y apport 2>/dev/null || true

echo "[2/8] Configuring kernel boot parameters (cgroup)..."
sudo sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*/GRUB_CMDLINE_LINUX_DEFAULT="quiet cgroup_enable=memory swapaccount=1"/' /etc/default/grub
sudo update-grub

echo "[3/8] Downloading and building DOMjudge ${DJVER}..."
cd /tmp
if [ ! -d "domjudge-${DJVER}" ]; then
    wget --no-check-certificate -q "https://10.12.13.20:2333/static/domjudge-${DJVER}.tar.gz"
    tar xzf "domjudge-${DJVER}.tar.gz"
fi
cd "domjudge-${DJVER}"
./configure --prefix="${INSTALL_PREFIX}" --quiet
make judgehost -j"$(nproc)"
sudo make install-judgehost

echo "[4/8] Creating users and groups..."
sudo groupadd -f domjudge-run
for core in $JUDGE_CORES; do
    id "domjudge-run-${core}" &>/dev/null || \
        sudo useradd -d /nonexistent -g domjudge-run -M -s /bin/false "domjudge-run-${core}"
done

echo "[5/8] Installing sudoers rules..."
sudo cp "${INSTALL_PREFIX}/judgehost/etc/sudoers-domjudge" /etc/sudoers.d/
sudo chmod 440 /etc/sudoers.d/sudoers-domjudge

echo "[6/8] Installing systemd services..."
sudo cp judge/domjudge-judgedaemon@.service /etc/systemd/system/
sudo cp judge/create-cgroups.service /etc/systemd/system/

# Add [Install] section so systemctl enable works
if ! grep -q '\[Install\]' /etc/systemd/system/domjudge-judgedaemon@.service; then
    sudo tee -a /etc/systemd/system/domjudge-judgedaemon@.service > /dev/null <<'UNIT'

[Install]
WantedBy=multi-user.target
UNIT
fi

sudo systemctl daemon-reload
sudo systemctl enable create-cgroups --now

echo "[7/8] Building chroot environment (this may take a few minutes)..."
sudo DEBMIRROR="https://mirrors.bfsu.edu.cn/ubuntu" "${INSTALL_PREFIX}/judgehost/bin/dj_make_chroot"

echo "[8/8] Configuring REST API credentials and enabling services..."
sudo tee "${INSTALL_PREFIX}/judgehost/etc/restapi.secret" > /dev/null <<EOF
# id  URL  username  password
default ${DOMSERVER_URL} ${JUDGEHOST_USER} ${JUDGEHOST_PASS}
EOF
sudo chmod 640 "${INSTALL_PREFIX}/judgehost/etc/restapi.secret"

for core in $JUDGE_CORES; do
    sudo systemctl enable "domjudge-judgedaemon@${core}"
done

echo "[9/9] Configuring autologin for icpc user (no password)..."
# Remove password for icpc user
sudo passwd -d icpc

# Configure GDM autologin (Ubuntu with GNOME)
if [ -f /etc/gdm3/custom.conf ]; then
    sudo sed -i '/^\[daemon\]/a AutomaticLoginEnable=True\nAutomaticLogin=icpc' /etc/gdm3/custom.conf
    # Avoid duplicate entries if run multiple times
    sudo awk '!seen[$0]++' /etc/gdm3/custom.conf | sudo tee /etc/gdm3/custom.conf.tmp > /dev/null
    sudo mv /etc/gdm3/custom.conf.tmp /etc/gdm3/custom.conf
fi

# Configure LightDM autologin (Ubuntu with LightDM)
if [ -d /etc/lightdm ]; then
    sudo tee /etc/lightdm/lightdm.conf.d/50-autologin.conf > /dev/null <<LIGHTDM
[Seat:*]
autologin-user=icpc
autologin-user-timeout=0
LIGHTDM
fi

echo ""
echo "=========================================="
echo "  Judgehost setup complete!"
echo "  DOMserver: ${DOMSERVER_URL}"
echo "  Judge cores: ${JUDGE_CORES}"
echo "  NOTE: Reboot required for cgroup changes"
echo "=========================================="
JUDGEEOF

chmod +x setup-judgehost.sh
```

{{% /details %}}

Usage:

```bash
# Edit the variables at the top of the script, then:
~/setup-judgehost.sh
sudo reboot
```

> To bake into the image: run this script inside the mounted raw image (chroot) before Step 1,
> then every deployed machine will have judgehost pre-installed. Only the REST API credentials
> (`/opt/domjudge/judgehost/etc/restapi.secret`) may need per-machine adjustment.
