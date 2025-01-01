---
title: ICPC EC Final 2024 办赛总结&备忘录
description: 总结下此次EC Final办赛中遇到的问题以及潜在改进方法，为个人备忘录
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

> 记录下此次办赛中遇到的问题，做个个人备忘录

### 运维方面

1. 保证服务器有两路单独的供电，同时将核心交换机和服务器连接到不同的电路，防止出现和此次类似的服务器+交换机断电问题。
2. 需要对Linux Kernel和Nginx做单机高并发相关的优化，不然的话会被打满直接爆炸。
3. 确认下JetBrain家的IDE激活Key是否存放在`~/.config`下面，作为一个单独的`.key`文件存在（似乎其为ICPC特制版，和其他版本的激活方式不同），若是的话则下次可以无需手动删除相关文件，直接对`/etc/skel`中的`.key`做更改后删除用户重建即可。
4. 打印程序需要重写以调整编码，以防GBK转UTF-8出乱码。
5. 注意DomJudge的配置会覆盖掉php-fpm的配置，因此需要在其配置文件里更改。
6. 外榜Caddyfile备份
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
7. 远程解锁与锁屏shell在此备份
    ```shell
    # 自动解锁
    #!/bin/bash
    
    USERNAME="your_username"
    GDM_CONFIG="/etc/gdm3/custom.conf"
    
    sudo bash -c "echo '[daemon]' >> $GDM_CONFIG"
    sudo bash -c "echo 'AutomaticLoginEnable=true' >> $GDM_CONFIG"
    sudo bash -c "echo 'AutomaticLogin=$USERNAME' >> $GDM_CONFIG"
    
    sudo /etc/init.d/gdm3 restart
    
    # 自动锁屏
    #!/bin/bash
    
    USERNAME="your_username"
    GDM_CONFIG="/etc/gdm3/custom.conf"
    
    sudo sed -i "/AutomaticLoginEnable=true/d" $GDM_CONFIG
    sudo sed -i "/AutomaticLogin=$USERNAME/d" $GDM_CONFIG
    
    sudo loginctl terminate-user $USERNAME
    sudo /etc/init.d/gdm3 restart
    ```

### 管理方面

1. 需要更清晰得命名规则，尤其是在对讲机喊话的时候需要能听得清，如果有需要的话培训志愿者使用单词替代单字。
2. 桌号标签，方便定位对应的座位。
3. 需要对所有的证件进行核对，包括且不限于队伍出门用的卡片，以防顶替。
4. 志愿者来来去去变得太严重了，信息互相之间差的太多，还有得组人很抽象，下次得考虑下要求有整段时间的。