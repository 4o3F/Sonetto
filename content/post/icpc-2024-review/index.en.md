---
title: ICPC EC Final 2024 Hosting Review & Memo
description: A personal memo summarizing issues encountered while hosting this EC Final and potential improvements
slug: icpc-2024-review
date: 2025-01-01 00:00:00+0000
image: cover.jpg
categories:
    - daily
    - dev
tags:
    - daily
    - dev
---
> This article was translated by GPT 5.5.

> Notes on the issues encountered while hosting this contest, as a personal memo

### Operations

1. Ensure the servers have two independent power supplies, and connect the core switch and servers to different circuits to prevent a similar server + switch power outage.
2. Linux Kernel and Nginx need single-machine high-concurrency optimization; otherwise they will be saturated and fail directly.
3. Confirm whether JetBrains IDE activation keys are stored under `~/.config` as separate `.key` files (it seems to be an ICPC-specific version, with an activation method different from other versions). If so, next time there is no need to manually delete the related files. Directly change the `.key` in `/etc/skel`, then delete and recreate the users. (Update on 2025/1/2: confirmed that it is in the `clion.key` file. It can be directly replaced to activate. Note the `useradd -m` parameter.)
4. The printing program needs to be rewritten to adjust encoding and prevent garbled text when converting GBK to UTF-8.
5. Note that DomJudge configuration overrides php-fpm configuration, so changes need to be made in its configuration file.
6. External scoreboard Caddyfile backup
    ```text
    {
        auto_https off
        debug
    }
    http://127.0.0.1:2333 {
        @staticfile path_regexp allowed_files \.(js|css|png)$
        handle @staticfile {
            reverse_proxy http://192.168.0.66:80
        }
        handle /* {
            rewrite * /public?static=true
            reverse_proxy http://192.168.0.66:80
        }
    }
    ```
7. Remote unlock and lock-screen shell scripts backed up here
    ```shell
    # Automatically unlock
    #!/bin/bash
    
    USERNAME="your_username"
    GDM_CONFIG="/etc/gdm3/custom.conf"
    
    sudo bash -c "echo '[daemon]' >> $GDM_CONFIG"
    sudo bash -c "echo 'AutomaticLoginEnable=true' >> $GDM_CONFIG"
    sudo bash -c "echo 'AutomaticLogin=$USERNAME' >> $GDM_CONFIG"
    
    sudo /etc/init.d/gdm3 restart
    
    # Automatically lock the screen
    #!/bin/bash
    
    USERNAME="your_username"
    GDM_CONFIG="/etc/gdm3/custom.conf"
    
    sudo sed -i "/AutomaticLoginEnable=true/d" $GDM_CONFIG
    sudo sed -i "/AutomaticLogin=$USERNAME/d" $GDM_CONFIG
    
    sudo loginctl terminate-user $USERNAME
    sudo /etc/init.d/gdm3 restart
    ```
8. Note that scoreboard freezing needs to go through CDS. Pulling directly from the DomJudge API cannot handle frozen-scoreboard issues.

### Management

1. Clearer naming rules are needed, especially when calling over walkie-talkies; the names need to be easy to hear. If necessary, train volunteers to use words instead of single characters.
2. Table number labels, making it easier to locate the corresponding seats.
3. All credentials and documents need to be checked, including but not limited to the cards teams use to leave the venue, to prevent impersonation.
4. Volunteer turnover was too severe, information gaps between people were too large, and some group assignments were very abstract. Next time, consider requiring availability for a continuous block of time.
