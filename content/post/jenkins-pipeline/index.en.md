---
title: Deploying a Server Cluster with Jenkins Pipeline
description: Using Jenkins Pipeline for zero-downtime automated deployment of a server cluster
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
> This article was translated by GPT 5.5.

> Before I left, the company wanted the final task to be getting automatic production server deployment done, so this article came about.

## Jenkins Pipeline Build and Deployment

### Jenkins Pipeline Configuration

Jenkins Pipeline is implemented through plugins, so I currently installed the following plugins:

- Pipeline
- Pipeline Graph Analysis Plugin
- Pipeline Maven Integration Plugin
- Pipeline: Stage View Plugin
- SSH Pipeline Steps

Many other basic plugins will be installed automatically as dependencies.

### Writing the Pipeline

Detailed points are given in the comments.

{{% details summary="Complete Pipeline script" %}}

```groovy
def remotes = [
    [name: "project-1", host: "IP", allowAnyHosts: true],
    // You can continue adding more remotes
]

pipeline {
    agent any

    environment {
        // Used to configure the file names below
        PROJECT = 'PROJECT_NAME'
    }

    stages {
        stage('Preparation') {
            steps {
                // Pull code from Git
                git branch: 'dev', credentialsId: '403F_VCS', url: 'https://git.url'
            }
        }

        stage('Maven Package') {
            steps {
                script {
                    // maven-3.9.8 here has already been configured in System Configuration
                    withMaven(globalMavenSettingsConfig: 'maven_mirror_and_properties', maven: 'maven-3.9.8', mavenSettingsConfig: '', traceability: true) {
                        // JAVA_HOME explicitly uses jdk_1.8 because the current project code uses javax and must use Java 8
                        withEnv(["JAVA_HOME=/var/jenkins_home/tools/jdk_1.8"]) {
                            sh '"mvn" clean package -U'
                        }
                    }
                }
            }
        }

        // This stage gets the Git commit hash and combines it into the new file name
        stage('Post Process Artifacts') {
            steps {
                script {
                    echo "${PROJECT}"
                    // Get the commit hash for later use
                    def commitHash = sh(script: 'git log -n 1 --pretty=format:\'%H\'', returnStdout: true).trim()
                    def project = "${PROJECT}"
                    def fileName = "${new Date().format('yyyyMMddHHmmss')}-${commitHash}.war"
                    echo "Build project ${project}, git commit ${commitHash}"

                    // Delete other files generated in the target directory, keeping only the final WAR package
                    sh "find target -mindepth 1 -type f ! -name '*.war' -exec rm -f {} +"
                    sh "find target -mindepth 1 -type d ! -name '.' ! -name '..' -exec rm -rf {} +"
                    def warFilesCount = sh(script: 'ls target/*.war 2>/dev/null | wc -l', returnStdout: true).trim().toInteger()
                    
                    // Ensure only one final WAR package remains
                    if (warFilesCount == 1) {
                        def warFile = sh(script: 'ls target/*.war', returnStdout: true).trim()

                        if (fileName.isEmpty()) {
                            error "file_name env variable not found!"
                        }

                        // Rename the final WAR package
                        sh "mv '${warFile}' 'target/${project}_${fileName}'"

                        echo "WAR file renamed"
                    } else {
                        error "WAR file in target not single!"
                    }
                }
            }
        }

        // Keep a copy of the final WAR package for later archiving and rollback
        stage('Results') {
            steps {
                archiveArtifacts artifacts: 'target/*.war'
            }
        }
        
        // Deployment stage
        stage('Deploy') {
            steps {
                script {
                    // All servers to deploy use the same SSH RSA key, ensuring one user credential can connect to all servers
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

{{% /details %}}

## Server-Side Local Deployment Part

Some commands, such as stopping the original Tomcat on the host, replacing files, and finally restarting and ensuring the startup result, may differ slightly depending on the host.
Therefore, it is more suitable to execute Bash scripts remotely directly, rather than executing complex scripts through Jenkins.

### Stopping the Existing Service

```shell
#!/bin/sh

bash /usr/local/tomcat8.5/bin/shutdown.sh
# Wait 30s to let Tomcat shut down gracefully
sleep 30
# If it has not stopped after 30s, kill it
pids=$(ps aux | grep java | grep tomcat | grep -v grep | grep -v bash | awk '{print $2}') && [ -n "$pids" ] && echo "$pids" | xargs kill -9 || echo "Tomcat already down"
```

### Starting the New Server

```shell
#!/bin/sh
# Back up the existing server in case it is needed later
mv /usr/local/tomcat8.5/project /usr/local/tomcat8.5/project_$(date +"%Y%m%d_%H%M%S")
unzip /usr/local/deploy/server.war -d /usr/local/tomcat8.5/project
bash /usr/local/tomcat8.5/bin/startup.sh
```

### Monitoring New Server Startup

{{% details summary="Server startup monitoring script" %}}

```shell
#!/bin/bash

LOG_FILE="/usr/local/logs/wj_project.log"
SEARCH_STRING="FrameworkServlet 'wj_project': initialization completed"
TIMEOUT=300  # 5 minutes
CHECK_INTERVAL=10  # Check every 10 seconds
elapsed_time=0

# Wait for the log file to be created
while [ ! -f "$LOG_FILE" ]; do
    echo "Log file $LOG_FILE does not exist, waiting for creation..."
    sleep $CHECK_INTERVAL
    elapsed_time=$((elapsed_time + CHECK_INTERVAL))

    # Exit if the timeout is exceeded
    if [ $elapsed_time -ge $TIMEOUT ]; then
        echo "Error: log file $LOG_FILE was not created within $TIMEOUT seconds."
        exit 1
    fi
done

# Get the last line of the log file
last_position=$(wc -l < "$LOG_FILE")

while [ $elapsed_time -lt $TIMEOUT ]; do
    # Get the current number of lines in the log file
    current_position=$(wc -l < "$LOG_FILE")

    # If the log file has new content
    if [ "$current_position" -gt "$last_position" ]; then
        # Check the newly added content
        tail -n $((current_position - last_position)) "$LOG_FILE" | grep -q "$SEARCH_STRING"

        if [ $? -eq 0 ]; then
            echo "Found string: $SEARCH_STRING"
            exit 0
        fi

        # Update the last checked position
        last_position=$current_position
    fi

    echo "String not found: $SEARCH_STRING; waiting"
    sleep $CHECK_INTERVAL
    elapsed_time=$((elapsed_time + CHECK_INTERVAL))
done

echo "Error: string not found within $TIMEOUT seconds: $SEARCH_STRING"
exit 1
```

{{% /details %}}

Then redeploy the machines in the cluster one by one to avoid service interruption.

