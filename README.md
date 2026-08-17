## Realm 一键转发脚本

参考自 https://www.nodeseek.com/post-183613-1 ，感谢原教程作者。

本脚本在原教程基础上增加了 Realm 安装、转发规则管理、服务重启、脚本更新和可视化面板管理功能。

## v3.3.0 更新重点

- 一个监听端口可以配置主远端和多个额外远端。
- 支持 `roundrobin` 轮询和 `iphash` 来源 IP 固定策略。
- 支持为每个远端设置独立权重。
- 规则列表会显示全部远端、负载均衡策略和权重。
- 面板和命令行脚本修改规则时会保留多远端配置。

## 脚本界面预览

```text
################################################
#        Realm 一键转发脚本 (v3.3.0)         #
################################################
 Realm 状态: 运行中
 面板 状态: 已安装但未启动
------------------------------------------------
  1. 安装 / 重置 Realm
  2. 卸载 Realm
------------------------------------------------
  3. 添加转发规则
  4. 添加端口段转发
  5. 删除转发规则
  6. 查看当前配置
------------------------------------------------
  7. 启动服务
  8. 停止服务
  9. 重启服务
------------------------------------------------
  10. 更新脚本
  11. 面板管理
  0. 退出脚本
################################################
```

## 一键安装

### Debian / Ubuntu / CentOS

```bash
curl -L https://github.com/panhui/realm/releases/download/v3.3.0/realm.sh -o realm.sh && chmod +x realm.sh && ./realm.sh
```

或使用主分支最新版：

```bash
curl -L https://raw.githubusercontent.com/panhui/realm/refs/heads/main/realm.sh -o realm.sh && chmod +x realm.sh && ./realm.sh
```

### Alpine Linux

Alpine 默认可能没有 Bash，先安装运行依赖：

```sh
apk add --no-cache bash curl
curl -L https://raw.githubusercontent.com/panhui/realm/refs/heads/main/realm.sh -o realm.sh
chmod +x realm.sh
bash ./realm.sh
```

## 系统支持

| 系统 | 包管理器 | 服务管理 | Realm 二进制 |
| --- | --- | --- | --- |
| Debian / Ubuntu | `apt-get` | systemd | `unknown-linux-gnu` |
| CentOS / RHEL | `yum` | systemd | `unknown-linux-gnu` |
| Alpine Linux | `apk` | OpenRC | `unknown-linux-musl` |

支持架构：

- `x86_64` / `amd64`
- `aarch64` / `arm64`

## 默认 Realm 配置

脚本首次部署环境时会自动创建 `/root/.realm/config.toml`：

```toml
[network]
no_tcp = false
use_udp = true

# 参考模板
# [[endpoints]]
# listen = "0.0.0.0:本地端口"
# remote = "落地机IP:目标端口"

[[endpoints]]
listen = "0.0.0.0:1234"
remote = "0.0.0.0:5678"
```

## 多远端与负载均衡

在面板的“添加转发规则”区域填写主远端，并在“额外远端”中每行填写一个完整的 `IP:端口`。有额外远端时，可以选择：

- `roundrobin`：新连接按照权重轮询到各个远端。
- `iphash`：相同来源 IP 尽量使用同一个远端。

权重留空时，每个节点默认为 `1`。例如三个节点填写 `2, 1, 1`，流量比例约为 2:1:1。面板生成的 Realm 配置如下：

```toml
[[endpoints]]
listen = "[::]:10000"
remote = "10.0.0.11:443"
extra_remotes = ["10.0.0.12:443", "10.0.0.13:443"]
balance = "roundrobin: 2, 1, 1"
```

轮询以新连接为单位；已经建立的 TCP 连接不会在多个远端之间切换。

## 可视化面板配置

面板配置文件路径：

```text
/root/realm/web/config.toml
```

默认配置：

```toml
[auth]
password = "123456"

[server]
port = 8081
session_secret = ""

[https]
enabled = false
cert_file = "./certificate/cert.pem"
key_file = "./certificate/private.key"

[realm]
config_path = "/root/.realm/config.toml"
```

建议安装后立即修改默认密码。生产环境建议启用 HTTPS，并设置固定 `session_secret`。

## Release 自动构建

推送 `v*` tag 后，GitHub Actions 会自动构建面板后端并发布：

- `realm-panel-linux-amd64.zip`
- `realm-panel-linux-arm64.zip`
- `realm.sh`

本仓库不再提交 `web/realm_web`、`dist/`、`*.zip`、`*.tar.gz` 等构建产物。

## 官方 Realm 文档

更多 Realm 配置请参考官方项目：

https://github.com/zhboner/realm
