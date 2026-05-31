---
title: Jenkins Docker Deployment and Maintenance
description: Jenkins Docker deployment / mirror replacement / update operations
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
> This article was translated by GPT 5.5.

> Because multiple production and test servers at the internship company had previously been deployed one by one manually by operations staff, which consumed a lot of time, I deployed a Jenkins
> CI instance. These are some notes from that earlier deployment process.

## Docker Deployment

Start with the simplest Docker deployment. There is not much to say, so here are the commands directly.

```shell
# Change Docker registry mirror
nano /etc/docker/daemon.json

# Pull the Jenkins image
docker pull jenkins/jenkins

# Start Jenkins
docker run -p 9095:8080 -p 50000:50000 --name jenkins -v /root/jenkins:/var/jenkins_home jenkins/jenkins

# View logs
docker logs jenkins
```

## Configuring Jenkins Mirrors

Jenkins has a powerful plugin system and a large number of community plugins. However, on servers in mainland China, mirrors need to be configured before it can be used normally. First, change the Update Center source.

```shell
nano hudson.model.UpdateCenter.xml
```

Replace it with the USTC mirror, because TUNA blocked the entire IP range where the server was located.

```xml

<sites>
    <site>
        <id>default</id>
        <url>https://mirrors.ustc.edu.cn/jenkins/updates/update-center.json</url>
    </site>
</sites>
```

After that, if you update plugins directly, you will find that they still cannot be downloaded. The main reason is that the download URLs inside the JSON used as the index were not changed, so changing the source alone did almost nothing. You need to replace all of them in the index file as well. First find
`default.json` under the `jenkins_home\updates` directory, then run the command below.

```shell
sed -i 's#https://updates.jenkins.io/download#https://mirrors.ustc.edu.cn/jenkins#g' default.json && sed -i 's#https://www.google.com#https://cn.bing.com#g' default.json
```

After this, plugins can be installed directly from the plugin center.

## Updating Jenkins

The Jenkins main program inside Docker is not mapped outside. To update it, you need to enter the container. First put the new `jenkins.war` into the host's `jenkins_home`
directory, then find the Docker container name for Jenkins.

```shell
docker ps --format "{{.ID}}: {{.Image}} {{.Names}}"
```

Then enter the container.

```shell
docker container exec -u 0 -it <container_name> /bin/bash
```

Copy the new war package over.

```shell
mv /var/jenkins_home/jenkins.war /usr/share/jenkins/
```

Then update the permissions.

```shell
chown jenkins:jenkins /usr/share/jenkins/jenkins.war
```

Finally, exit the Docker container and restart it.

```shell
docker restart <container_name>
```

