---
title: Adding OpenTelemetry Monitoring to DomJudge
description: Adding OpenTelemetry observability monitoring to DomJudge
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
> This article was translated by GPT 5.5.

> This article uses UpTrace as the visualization tool. If you use something else, you need to adjust ENDPOINT and other settings yourself.

## Configuring OpenTelemetry Components for PHP

First install the required dependencies.
```shell
sudo apt-get install gcc make autoconf php-dev
sudo pecl install opentelemetry
```

Then modify the `/etc/php/<version>/fpm/php.ini` file and add the following content.
```ini
[opentelemetry]
extension=opentelemetry.so
```

Then add the following environment variables to the PHP FPM DomJudge pool configuration file.
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

Check whether the configuration file is correct, and restart the fpm service.
```shell
php-fpm<version> -t
systemctl restart php<version>-fpm
```

## Installing the Corresponding composer Packages
Next, navigate to the extracted DomJudge release package, meaning the uninstalled path before it is placed under /opt, and add instrument-installer. Note that `--no-scripts` is needed because the default behavior loads database-related programs, and we do not need those.
```shell
composer require open-telemetry/opentelemetry-instrumentation-installer -vvv --no-scripts
```

Next, make some modifications to `lib/vendor/open-telemetry/opentelemetry-instrumentation-installer/installer_internals.php`.

Change the `github.com` URL to a mirror acceleration address, for example:
```php
function get_pickle() {
  $content = file_get_contents("https://ghfast.top/github.com/FriendsOfPHP/pickle/releases/latest/download/pickle.phar");
  $fp = fopen('pickle.phar', 'w');
  fwrite($fp, $content);
  fclose($fp);
}
```
Then modify the command execution in `make_advanced_setup` as needed. I recommend removing all `2>&1` occurrences so error messages are not hidden, and then modifying the `require` command to add the `-vvv` parameter.
```php
function make_composer_require_command($package_name, $version, $options) {
  return "composer require {$package_name}{$version} {$options} -vvv";
}
```

Then remove the `composer update` command. We certainly do not want to break DomJudge's other dependencies.
```shell
execute_command('composer update --no-interaction', ' ');
```

After that, you can run the installation. I recommend using the `advanced` installation mode here so you can choose freely.  
Note that this installation is not complete. If you want to monitor database data, you also need `open-telemetry/opentelemetry-auto-doctrine`~~, but this package currently has version requirement issues. I have submitted a PR and will wait and see; I will update this later~~. This has been fixed.

After installation, we need to manually update the required dependencies. Note that symfony-client needs its version manually pinned so it matches DomJudge, otherwise the update will not go through.
```shell
composer update open-telemetry/* -vvv --no-interaction --no-scripts
```
```shell
sudo ./lib/vendor/bin/install-otel-instrumentation advanced
```
+ For `http-provider`, I recommend choosing `symfony/http-client`.
+ For the other required items, I recommend using stable versions instead of dev versions.
+ Next it will ask whether to install `open-telemetry/opentelemetry-auto-symfony`; choose yes.
+ The `pdo` part requires a PHP version higher than 8.2.
+ `laravel`, `wordpress`, and `slim` are not needed.

Then move `webapp` and `lib/vendor` to the installation directory to overwrite the original files.

## Adding This to a Non-Fresh Installation

If this is not a fresh installation, cache cleanup and related permission settings are required. Follow the steps below.
1. Enter `/opt/domjudge/domserver/webapp`, then delete the `var` directory.
2. Next, recreate `var` and change its owner with `mkdir var && chown www-data var`.
3. Use the correct permissions for cache cleanup and directory recreation: `sudo -u www-data php bin/console cache:clear --env=prod`.
