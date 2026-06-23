---
title: "ICPC 比赛赛前部署与性能优化检查清单"
description: "ICPC 比赛赛前部署与性能优化检查清单"
pubDatetime: 2026-03-03T09:00:00.000Z
draft: false
tags:
  - "daily"
  - "dev"
cover: "./cover.jpg"
coverAlt: "ICPC 比赛赛前部署与性能优化检查清单 封面图"
---

> 本文由 GPT 5.5 模型翻译。

# DomJudge 部署

1. 按照[官方手册](https://www.domjudge.org/docs/manual/9.0/index.html)正常安装
2. 从 `/etc/nginx/sites-enabled/default` 删除默认 nginx 页面
3. 修改 `/opt/domjudge/domserver/etc/domjudge-fpm.conf` 中的 FPM 上传参数
4. 将以下内容添加到 `/etc/mysql/my.cnf`

```
[mysqld]
max_connections=1000
innodb_log_file_size=10GB
max_allowed_packet=2GB
slow_query_log=1
slow_query_log_file=/var/log/mysql_slow.log
net_read_timeout = 7200
net_write_timeout = 7200

[mysqldump]
max_allowed_packet = 1G
```

5. 安装 redis，并根据[这篇博客文章](/posts/icpc-2025-regional-review/)将 session 切换到 redis

# JudgeHost 部署

使用以下脚本生成 Docker Compose 文件。

<details>
<summary>JudgeHost Docker Compose 生成脚本</summary>


```shell
#!/usr/bin/env bash
set -euo pipefail

N="${1:-20}"

cat <<'YAML'
services:
YAML

for i in $(seq 1 "$N"); do
  if [[ "$i" -eq 1 ]]; then
    cat <<YAML
  judgehost-$i:
    image: docker.1ms.run/domjudge/judgehost:9.0.0
    hostname: judgedaemon-$i
    restart: unless-stopped
    privileged: true
    environment: &judgehost_env
      DOMSERVER_BASEURL: "http://<在此填写 URL>/"
      JUDGEDAEMON_PASSWORD: "<在此填写密码>"
      DAEMON_ID: "$i"
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    networks:
      - domjudge-net

YAML
  else
    cat <<YAML
  judgehost-$i:
    image: docker.1ms.run/domjudge/judgehost:9.0.0
    hostname: judgedaemon-$i
    restart: unless-stopped
    privileged: true
    environment:
      <<: *judgehost_env
      DAEMON_ID: "$i"
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    networks:
      - domjudge-net

YAML
  fi
done

cat <<'YAML'
networks:
  domjudge-net:
    external: true
    name: domjudge-judgehosts_default
YAML
```


</details>

**比赛期间最好不要修改 judgehost，否则可能会丢失判题任务。**

# Natsume 部署

> 仅适用于高于 0.1.2 的 Natsume 版本

1. 使用以下命令生成 CA 证书

```shell
 openssl ecparam -name prime256v1 -genkey -noout -out ca.key
 openssl req -new -x509 \
     -key ca.key \
     -sha256 \
     -days 365 \
     -out ca.cert \
     -addext "basicConstraints=critical,CA:TRUE" \
     -addext "keyUsage=critical,keyCertSign,cRLSign" \
     -addext "subjectKeyIdentifier=hash"
 openssl pkcs8 -topk8 -inform PEM -in ca.key -outform PEM -out ca_pkcs8.key -nocrypt
```

2. 使用[这个脚本](https://github.com/4o3F/Natsume/blob/main/assets/generate_cert.sh)为 caddy 反向代理生成 TLS 证书
3. 使用 Natsume 数据预处理器预处理数据
4. 创建队伍分类（Participants、Girls 等）
5. 导入由 Natsume 数据预处理器生成的数据：先导入 `organizations.json`，再导入 `teams.json`，最后导入 `accounts.yaml`
6. 提前安装 parallel-ssh

# 监控与性能调优

1. 根据[这篇博客文章](/posts/icpc-2025-regional-review/)构建带 Brotli 的 nginx
2. 安装 Redis，并根据[这篇博客文章](/posts/icpc-2025-regional-review/)将 DomJudge session 存储切换到 Redis
3. 将 opcache monitor 的 `opcache.php` 放到 `/opt/domjudge/status/opcache.php`
4. 将以下内容添加到 `/etc/nginx/nginx.conf` 的 http 块中

```
# DOMjudge 榜单缓存
fastcgi_cache_path /var/cache/nginx/domjudge
   levels=1:2
   keys_zone=dj_scoreboard:20m
   inactive=30s
   max_size=200m
   use_temp_path=off;
```

5. 使用以下命令创建缓存路径

```shell
mkdir -p /var/cache/nginx/domjudge
chown -R www-data:www-data /var/cache/nginx/domjudge
```

6. 编辑 `/opt/domjudge/domserver/etc/nginx-conf-inner`，它应变成如下配置

<details>
<summary>nginx-conf-inner 完整配置</summary>


```
# 由 'nginx-conf-inner.in' 于 Fri Apr  3 08:16:46 AM UTC 2026 生成。

# DOMjudge 内部 nginx 配置
# 单独放在一个文件中以避免配置重复

server_name _default_;

# 将最大上传大小设为无限，因为 PHP 对此另有配置
client_max_body_size 0;

# 阻止机器人索引
add_header X-Robots-Tag "none" always;

# nginx 配置中使用的变量
set $domjudgeRoot /opt/domjudge/domserver/webapp/public;
# 在系统根路径运行时，将这里设为 '' 而不是 /domjudge
set $prefix '';

# 禁止直接打开 .php 文件
location ~ ^/+[^/]+\.php$ { return 404; }

location = /team/scoreboard {
        limit_except GET HEAD { deny all; }

        include fastcgi_params;
        fastcgi_pass domjudge;
        fastcgi_split_path_info ^(.+\.php)(/.*)$;

        fastcgi_param SCRIPT_FILENAME $domjudgeRoot/index.php;
        fastcgi_param SCRIPT_NAME     $prefix/index.php;
        fastcgi_param DOCUMENT_ROOT   $domjudgeRoot;

        fastcgi_param DOCUMENT_URI    /public;
        fastcgi_param QUERY_STRING    "static=true";
        fastcgi_param REQUEST_URI     /public?static=true;

        fastcgi_param SERVER_NAME $host;
        fastcgi_param HTTPS $fastcgi_param_https_variable;

        fastcgi_param HTTP_X_REQUESTED_WITH "";

        fastcgi_cache dj_scoreboard;

        fastcgi_cache_key "$scheme://$host/public?static=true";

        # TTL = 3 秒
        fastcgi_cache_valid 200 3s;
        fastcgi_cache_valid any 0;

        fastcgi_cache_lock on;
        fastcgi_cache_lock_timeout 5s;
        fastcgi_cache_lock_age 5s;

        fastcgi_cache_use_stale updating;
        fastcgi_cache_background_update on;

        fastcgi_ignore_headers Cache-Control Expires Set-Cookie;
        fastcgi_hide_header Set-Cookie;

        add_header X-Cache-Status $upstream_cache_status always;
}

location / {
        root $domjudgeRoot;

        location = /monitor/fpm {
                access_log off;
        
                include fastcgi_params;
        
                fastcgi_param SCRIPT_NAME     /fpm_status;
                fastcgi_param DOCUMENT_URI    /fpm_status;
                fastcgi_param REQUEST_URI     /fpm_status;
                fastcgi_param SCRIPT_FILENAME /fpm_status;
        
                fastcgi_param SERVER_NAME $host;
                fastcgi_param HTTPS $fastcgi_param_https_variable;
        
                fastcgi_pass domjudge;
        }
        
        location ^~ /monitor/ {
                alias /opt/monitor/;
                index index.php index.html;

                try_files $uri $uri/ =404;

                location ~ \.php$ {
                include fastcgi_params;
                fastcgi_split_path_info ^(.+\.php)(/.*)$;

                fastcgi_param SCRIPT_FILENAME $request_filename;

                fastcgi_param SERVER_NAME $host;
                fastcgi_param HTTPS $fastcgi_param_https_variable;
                fastcgi_pass domjudge;
                }
        }

        try_files $uri @domjudgeFront;

        # 单独处理 API 请求，以便拆分日志
        location /api/ {
                try_files $uri @domjudgeFrontApi;
                error_log /var/log/nginx/domjudge-api.log;
                access_log /var/log/nginx/domjudge-api.log;
        }
}

# 或者可以使用前缀安装
location /domjudge { return 301 /domjudge/; }
# 禁止直接打开 .php 文件
location ~ ^/domjudge/+[^/]+\.php$ { return 404; }
location /domjudge/ {
        root $domjudgeRoot;
        rewrite ^/domjudge/(.*)$ /$1 break;
        try_files $uri @domjudgeFront;

        # 单独处理 API 请求，以便拆分日志
        location /domjudge/api/ {
                rewrite ^/domjudge/(.*)$ /$1 break;
                try_files $uri @domjudgeFrontApi;
        }
}

location @domjudgeFront {

        sub_filter_once off;
        sub_filter 'href="/team/scoreboard"' 'href="/team/scoreboard" target="_blank"';

        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        fastcgi_pass domjudge;
        include fastcgi_params;
        fastcgi_param SERVER_NAME $host;
        fastcgi_param SCRIPT_FILENAME $domjudgeRoot/index.php;
        fastcgi_param SCRIPT_NAME $prefix/index.php;
        fastcgi_param REQUEST_URI $prefix$uri?$args;
        fastcgi_param DOCUMENT_ROOT $domjudgeRoot;
        fastcgi_param HTTPS $fastcgi_param_https_variable;
        # 阻止包含前端控制器的 URI。以下请求会返回 404：
        # http://domain.tld/app_dev.php/some-path
        internal;
}

location @domjudgeFrontApi {
        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        fastcgi_pass domjudge;
        include fastcgi_params;
        fastcgi_param SERVER_NAME $host;
        fastcgi_param SCRIPT_FILENAME $domjudgeRoot/index.php;
        fastcgi_param SCRIPT_NAME $prefix/index.php;
        fastcgi_param REQUEST_URI $prefix$uri?$args;
        fastcgi_param DOCUMENT_ROOT $domjudgeRoot;
        fastcgi_param HTTPS $fastcgi_param_https_variable;
        # 阻止包含前端控制器的 URI。以下请求会返回 404：
        # http://domain.tld/app_dev.php/some-path
        internal;

        # API 使用单独日志文件
        error_log /var/log/nginx/domjudge-api.log;
        access_log /var/log/nginx/domjudge-api.log;
}

# X-Frame-Options 头用于防御所谓的“点击劫持”攻击。
# 如果需要在 HTML frame 或 iframe 中加载 DOMjudge 的一部分（例如公共榜单），
# 只对 DOMjudge 的对应部分禁用此 header。
add_header X-Frame-Options "DENY";

# 下列 header 适用于任何 DOMjudge 安装。
add_header Referrer-Policy "same-origin";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";

error_log /var/log/nginx/domjudge.log;
access_log /var/log/nginx/domjudge.log;
```


</details>

7. 根据 opcache monitor 调优 `php.ini` 中的 opcache 参数
