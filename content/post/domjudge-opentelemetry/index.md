---
title: 为DomJudge添加OpenTelemetry监控
description: 为DomJudge添加OpenTelemetry可观测监控
slug: domjudge-opentelemetry
date: 2025-05-19 17:00:00+0800
image: cover.jpg
categories:
  - daily
  - dev
tags:
  - daily
  - dev
---

> 本文使用UpTrace作为可视化工具，如果使用其他的需要自行调整ENDPOINT等。

## 为PHP配置OpenTelemetry组件

首先安装需要的依赖库
```shell
sudo apt-get install gcc make autoconf php-dev
sudo pecl install opentelemetry
```

然后修改`/etc/php/<version>/fpm/php.ini`文件，添加下面的内容
```ini
[opentelemetry]
extension=opentelemetry.so
```

然后在PHP FPM domjudge池的配置文件里添加如下环境变量
```
env[OTEL_PHP_AUTOLOAD_ENABLED] = "true"
env[OTEL_SERVICE_NAME] = "domjudge-web"
env[OTEL_TRACES_EXPORTER] = "otlp"
env[OTEL_EXPORTER_OTLP_PROTOCOL] = "http/protobuf"
env[OTEL_EXPORTER_OTLP_TRACES_ENDPOINT] = "https://api.uptrace.dev/v1/traces"
env[OTEL_EXPORTER_OTLP_HEADERS] = "uptrace-dsn=https://oYGpL7xyKhFC7dPaYSktbA@api.uptrace.dev"
env[OTEL_LOG_LEVEL] = "debug"
env[OTEL_PHP_LOG_DESTINATION] = "error_log"
```

检查配置文件是否正确，并重启fpm服务
```shell
php-fpm<version> -t
systemctl restart php<version>-fpm
```

## 安装对应的composer包
接下来导航到解压后的DomJudge release包下（注意是还没到/opt下的未安装的路径），然后添加instrument-installer，注意要--no-scripts因为默认会加载数据库相关的程序，我们不需要那些
```shell
composer require open-telemetry/opentelemetry-instrumentation-installer -vvv --no-scripts
```

接下来要对`lib/vendor/open-telemetry/opentelemetry-instrumentation-installer/installer_internals.php`做一些修改

修改`github.com`的到镜像加速地址，比如
```php
function get_pickle() {
  $content = file_get_contents("https://ghfast.top/github.com/FriendsOfPHP/pickle/releases/latest/download/pickle.phar");
  $fp = fopen('pickle.phar', 'w');
  fwrite($fp, $content);
  fclose($fp);
}
```
之后按需修改`make_advanced_setup`中的指令执行，建议是把所有的`2>&1`都去掉，这样可以避免看不到错误信息，再修改`require`指令，添加`-vvv`参数
```php
function make_composer_require_command($package_name, $version, $options) {
  return "composer require {$package_name}{$version} {$options} -vvv";
}
```

再把`composer update`指令给去掉，我们可不像搞坏DomJudge的其他依赖
```shell
execute_command('composer update --no-interaction', ' ');
```

之后便可以执行安装了，这里建议使用`advanced`模式安装，可以自由选择。  
注意这里安装的并不全，要想监控数据库数据的话还需要`open-telemetry/opentelemetry-auto-doctrine`~~但这个包目前版本要求有问题，我发了PR等等看，后续我会更新的~~，已修复。

安装完成后我们需要手动更新需要的依赖，注意symfony-client需要手动修版本使其和DomJudge的匹配，不然update过不去。
```shell
composer update open-telemetry/* -vvv --no-interaction --no-scripts
```
```shell
sudo ./lib/vendor/bin/install-otel-instrumentation advanced
```
+ 对于`http-provider`建议选择`symfony/http-client`
+ 其他的必选项建议都使用stable的而不要使用dev的
+ 接下来会询问是否安装`open-telemetry/opentelemetry-auto-symfony`，选择是
+ `pdo`的部分需要php版本高于8.2才可以
+ `laravel`,`wordpress`,`slim`这些都不需要

然后要把`webapp`以及`lib/vendor`挪到安装目录下覆盖原始文件

## 非全新安装添加

如果并非是全新安装的话，需要进行cache清理和相关权限设置，按照如下的步骤
1. 进入`/opt/domjudge/domserver/webapp`，然后删除`var`目录
2. 接下来重建`var`并更改所有者`mkdir var && chown www-data var`
3. 使用正确的权限进行cache清理和目录重建`sudo -u www-data php bin/console cache:clear --env=prod`