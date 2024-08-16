---
title: 用Jenkins Pipeline实现服务器集群部署
description: 用Jenkins Pipeline实现服务器集群不停机自动化部署
slug: jenkins-pipeline-deploy
date: 2024-08-16 00:00:00+0000
image: cover.jpg
categories:
  - intern
  - dev
tags:
  - intern
  - dev
---

> 临走之前公司希望最后能搞定生产服务器的自动发布，因此有了此文

## Jenkins Pipeline编译与部署

### Jenkins Pipeline配置

Jenkins的Pipeline是依靠于插件实现的，所以目前我是安装了以下这些插件

- Pipeline
- Pipeline Graph Analysis Plugin
- Pipeline Maven Integration Plugin
- Pipeline: Stage View Plugin
- SSH Pipeline Steps

其余的很多基础插件会作为依赖自动被安装。

### Pipeline编写

详细细节会在注释中给出

```groovy
def remotes = [
    [name: "project-1", host: "IP", allowAnyHosts: true],
    // 可以继续添加更多的 remote
]

pipeline {
    agent any

    environment {
        // 用于配置后面的文件名
        PROJECT = 'PROJECT_NAME'
    }

    stages {
        stage('Preparation') {
            steps {
                // Git拉取代码
                git branch: 'dev', credentialsId: '403F_VCS', url: 'https://git.url'
            }
        }

        stage('Maven Package') {
            steps {
                script {
                    // 这里的maven-3.9.8是在系统配置中配置完成的
                    withMaven(globalMavenSettingsConfig: 'maven_mirror_and_properties', maven: 'maven-3.9.8', mavenSettingsConfig: '', traceability: true) {
                        // JAVA_HOME特别采用jdk_1.8是因为当前项目代码中用了javax，必须要用8
                        withEnv(["JAVA_HOME=/var/jenkins_home/tools/jdk_1.8"]) {
                            sh '"mvn" clean package -U'
                        }
                    }
                }
            }
        }

        // 这一阶段会获取Git Commit Hash并进行组合后形成新的文件名
        stage('Post Process Artifacts') {
            steps {
                script {
                    echo "${PROJECT}"
                    // 获取Commit Hash以供后面使用
                    def commitHash = sh(script: 'git log -n 1 --pretty=format:\'%H\'', returnStdout: true).trim()
                    def project = "${PROJECT}"
                    def fileName = "${new Date().format('yyyyMMddHHmmss')}-${commitHash}.war"
                    echo "Build project ${project}, git commit ${commitHash}"

                    // 删除掉target文件夹中生成的其他文件，只留存一个最终的war包
                    sh "find target -mindepth 1 -type f ! -name '*.war' -exec rm -f {} +"
                    sh "find target -mindepth 1 -type d ! -name '.' ! -name '..' -exec rm -rf {} +"
                    def warFilesCount = sh(script: 'ls target/*.war 2>/dev/null | wc -l', returnStdout: true).trim().toInteger()
                    
                    // 确保最终留下来的war包只有一个
                    if (warFilesCount == 1) {
                        def warFile = sh(script: 'ls target/*.war', returnStdout: true).trim()

                        if (fileName.isEmpty()) {
                            error "file_name env variable not found!"
                        }

                        // 重命名最终的war包
                        sh "mv '${warFile}' 'target/${project}_${fileName}'"

                        echo "WAR file renamed"
                    } else {
                        error "WAR file in target not single!"
                    }
                }
            }
        }

        // 留存一份最终的war包供后续归档与回滚等使用
        stage('Results') {
            steps {
                archiveArtifacts artifacts: 'target/*.war'
            }
        }
        
        // 部署阶段
        stage('Deploy') {
            steps {
                script {
                    // 所有需要部署的服务器采用同一个SSH RSA Key，这样可以保证一个用户凭证可以连接所有的服务器
                    withCredentials([sshUserPrivateKey(credentialsId: 'aliyun-prod', keyFileVariable: 'identity', usernameVariable: 'username')]) {
                        remotes.each { remote ->
                            remote.user = userName
                            remote.identityFile = identity
                            stage("Stop Tomcat server") {
                                sshCommand remote:remote, command: 'bash /usr/local/deploy/shutdown.sh'
                            }
                            stage("Upload new WAR package") {
                                def warFile = sh(script: 'ls target/*.war 2>/dev/null', returnStdout: true).trim()
                                sshPut remote: remote, from: warFile, into: '/usr/local/deploy/server.war'
                            }
                            stage("Start up Tomcat") {
                                sshCommand remote:remote, command: 'bash /usr/local/deploy/start.sh'
                            }
                            stage("Check Tomcat startup status") {
                                sshCommand remote:remote, command: 'bash /usr/local/deploy/check.sh'
                            }
                        }
                    }
                }
            }
        }
    }
}
```

## 服务器本机部署部分

有些命令，比如宿主机上原始的Tomcat的关停、文件替换，以及最终的重启动与启动结果确保，这些任务会随着宿主机不同而可能有些许不同，
因此更适合直接远程执行Bash脚本而非通过Jenkins执行复杂的脚本。

### 现有服务关停

```shell
#!/bin/sh

bash /usr/local/tomcat8.5/bin/shutdown.sh
# 等待30s以让Tomcat graceful shutdown
sleep 30
# 若30s后仍然没有关停则将其kill掉
pids=$(ps aux | grep java | grep tomcat | grep -v grep | grep -v bash | awk '{print $2}') && [ -n "$pids" ] && echo "$pids" | xargs kill -9 || echo "Tomcat already down"
```

### 启动新服务端

```shell
#!/bin/sh
# 备份现有服务端以备不时之需
mv /usr/local/tomcat8.5/project /usr/local/tomcat8.5/project_$(date +"%Y%m%d_%H%M%S")
unzip /usr/local/deploy/server.war -d /usr/local/tomcat8.5/project
bash /usr/local/tomcat8.5/bin/startup.sh
```

### 监控新服务端启动

```shell
#!/bin/bash

LOG_FILE="/usr/local/logs/wj_project.log"
SEARCH_STRING="FrameworkServlet 'wj_project': initialization completed"
TIMEOUT=300  # 5分钟
CHECK_INTERVAL=10  # 每10秒检查一次
elapsed_time=0

# 等待日志文件被创建
while [ ! -f "$LOG_FILE" ]; do
    echo "日志文件 $LOG_FILE 不存在，等待创建..."
    sleep $CHECK_INTERVAL
    elapsed_time=$((elapsed_time + CHECK_INTERVAL))

    # 如果超过超时时间，退出
    if [ $elapsed_time -ge $TIMEOUT ]; then
        echo "错误：在$TIMEOUT秒内未创建日志文件 $LOG_FILE。"
        exit 1
    fi
done

# 获取日志文件的最后一行
last_position=$(wc -l < "$LOG_FILE")

while [ $elapsed_time -lt $TIMEOUT ]; do
    # 获取当前日志文件的行数
    current_position=$(wc -l < "$LOG_FILE")

    # 如果日志文件有新内容
    if [ "$current_position" -gt "$last_position" ]; then
        # 检查新添加的内容
        tail -n $((current_position - last_position)) "$LOG_FILE" | grep -q "$SEARCH_STRING"

        if [ $? -eq 0 ]; then
            echo "找到字符串：$SEARCH_STRING"
            exit 0
        fi

        # 更新最后检查的位置
        last_position=$current_position
    fi

    echo "未找到字符串: $SEARCH_STRING 等待中"
    sleep $CHECK_INTERVAL
    elapsed_time=$((elapsed_time + CHECK_INTERVAL))
done

echo "错误：在$TIMEOUT秒内未找到字符串：$SEARCH_STRING"
exit 1
```

然后使集群中的机器逐个重新部署，来避免服务中断。

