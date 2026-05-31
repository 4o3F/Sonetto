---
title: Jenkins Docker部署与维护
description: Jenkins Docker的部署/换源/更新操作
slug: jenkins-docker
date: 2024-08-15 00:00:00+0000
image: cover.jpg
categories:
  - intern
  - dev
tags:
  - intern
  - dev
  - ci
  - jenkins
---

> 由于实习公司多台生产与测试服务器之前一直是由运维人员手动一台台部署的，而消耗了大量的时间，因此部署了一台Jenkins
> CI，此处为之前部署过程中的一些记录性总结。

## Docker部署

先是最简单的Docker部署，不多赘述了就，直接上指令。

```shell
# Docker换源
nano /etc/docker/daemon.json

# 拉取Jenkins镜像
docker pull jenkins/jenkins

# 启动Jenkins
docker run -p 9095:8080 -p 50000:50000 --name jenkins -v /root/jenkins:/var/jenkins_home jenkins/jenkins

# 查看日志
docker logs jenkins
```

## Jenkins换源

Jenkins有着强大的插件系统和海量社区插件，然而在国内服务器上的话需要换源才能正常使用，先是更换Update Center源

```shell
nano hudson.model.UpdateCenter.xml
```

替换为USTC源，因为TUNA把服务器所在的网段整个屏蔽了😓

```xml

<sites>
    <site>
        <id>default</id>
        <url>https://mirrors.ustc.edu.cn/jenkins/updates/update-center.json</url>
    </site>
</sites>
```

之后如果直接去更新插件，会发现.....还是下载不了...主要是作为索引的json里面的下载URL没换，换源换了个寂寞，需要将索引文件中的也全部替换，因此先找到
`jenkins_home\updates`目录下的`default.json`，然后执行指令

```shell
sed -i 's#https://updates.jenkins.io/download#https://mirrors.ustc.edu.cn/jenkins#g' default.json && sed -i 's#https://www.google.com#https://cn.bing.com#g' default.json
```

这样便可以直接从插件中心中安装了。

## Jenkins更新

Docker内的Jenkins主程序未向外映射，更新的话需要进入内部进行更新，首先把新版`jenkins.war`放入宿主机`jenkins_home`
目录下，然后找到Jenkins的Docker容器名

```shell
docker ps --format "{{.ID}}: {{.Image}} {{.Names}}"
```

接着进入容器内

```shell
docker container exec -u 0 -it <容器名> /bin/bash
```

将新版本war包复制过来

```shell
mv /var/jenkins_home/jenkins.war /usr/share/jenkins/
```

然后更新权限

```shell
chown jenkins:jenkins /usr/share/jenkins/jenkins.war
```

最终退出Docker容器然后将其重启

```shell
docker restart <容器名>
```

