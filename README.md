## Realm 一键转发脚本

参考自 https://www.nodeseek.com/post-183613-1 ，感谢原教程作者。

本脚本在原教程基础上增加了 Realm 安装、转发规则管理、服务重启、脚本更新和可视化面板管理功能。

## v3.8.0 更新重点

- 每条规则新增“暂停 / 启用”操作，暂停时保留监听地址、多远端、策略和权重。
- 新增“已用上传 / 已用下载”，每 15 秒刷新，并支持跨页多选清空流量。
- 流量由 nftables 按中转监听地址统计 TCP/UDP、IPv4/IPv6 网络字节，不会重复计算远端链路，包含协议头和重传。
- 流量从升级后开始统计，不补算之前的流量。历史记录保存在 Realm 配置旁的 `.traffic.json` 文件中，面板重启可继续累计；系统突然断电最多丢失最近一个采样周期的数据。
- 暂停配置保存在 TOML 注释中，Realm 仅读取启用的规则；切换状态会重启 Realm，其他规则仍启用，但已有连接可能短暂重连。
- 清空流量只重置所选规则的统计起点，不重启、不修改转发配置。
- 安装脚本自动安装 nftables；若系统权限或内核不支持统计，面板会提示原因并显示上次保存值。
- nftables 仅使用面板自己的计数表，不修改系统其他防火墙表或放行/拦截规则。

- 新增“复制所选”，支持跨页复制，粘贴到批量添加即可导入。
- 复制和导入完整保留监听地址、多远端、负载均衡策略和权重。
- 批量添加兼容旧版 IPv4 / IPv6 文本格式及复制规则，失败时保留未导入的内容。
- 加高批量添加输入框，放大运行状态并突出绿色运行、红色停止状态。

- 删除服务控制标题和说明，将 Realm 服务运行状态移至服务操作栏。
- 启动、停止、重启和退出登录按钮缩小，统一使用白色弱化样式。

- 面板头部显示服务器活动网卡上的 IPv4 / IPv6 地址，优先显示公网地址。
- 减少规则列表上下留白，加宽编辑、删除按钮，文字大小保持不变。

- 一个监听端口可以配置主远端和多个额外远端。
- 支持 `roundrobin` 轮询和 `iphash` 来源 IP 固定策略。
- 支持为每个远端设置独立权重。
- 规则列表会显示全部远端、负载均衡策略和权重。
- 面板和命令行脚本修改规则时会保留多远端配置。
- 修复旧版面板升级时静态资源目录嵌套、前后端版本不一致的问题。
- 规则列表新增“编辑”按钮，可修改监听端口、全部远端、策略和权重。
- 默认每页显示规则数调整为 100 条。
- 新安装面板的默认密码调整为 `Qwer1234.`。
- 登录成功后的会话有效期调整为 30 天，主动退出仍会立即失效。
- Debian glibc 版本过旧时，安装脚本会自动改用 Realm musl 静态版本。
- 修复 Realm 2.9.5 在没有转发规则时因缺少 `endpoints` 字段而无法启动的问题。
- 安装或重置 Realm 时会自动修复已有的空配置，无需手工编辑 TOML。
- 添加、批量添加和编辑转发规则均改为弹窗操作，页面顶部提供两个添加入口。
- 规则列表支持逐条勾选、当前页全选和跨页批量删除。
- 批量删除只保存一次配置，并在完成后统一重启服务。
- 面板升级为现代化卡片式布局，优化状态展示、表格、按钮和移动端体验。

## 脚本界面预览

```text
################################################
#        Realm 一键转发脚本 (v3.8.0)         #
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
curl -L https://github.com/panhui/realm/releases/download/v3.8.0/realm.sh -o realm.sh && chmod +x realm.sh && ./realm.sh
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

规则创建后，可以在规则列表中点击“编辑”。面板会在弹窗中加载原规则，保存时检查监听端口冲突并重启 Realm；关闭弹窗或点击“取消”可放弃修改。

## 可视化面板配置

面板配置文件路径：

```text
/root/realm/web/config.toml
```

默认配置：

```toml
[auth]
password = "Qwer1234."

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
