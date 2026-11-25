# 安装文档

> **如果不会安装**：下载一个 WorkBuddy，用 DeepSeek 最新模型，把本仓库链接丢给它，让它按本文档帮你装。
>
> 使用前请先读 [README 顶部的免责协议](README.md#免责协议)。

从零把这套签到跑到自己的 Cloudflare 账号上。

装完之后：三个平台自动签到、签到完给你发消息、页面上能看到每个账号剩多少积分、什么时候到期。

---

## 最快的方式：双击一下（推荐）

压缩包里有个 `deploy.cmd`，双击它，会问你两件事：

1. **Cloudflare API Token** —— 去 [这里](https://dash.cloudflare.com/profile/api-tokens) → Create Token → 模板选 **Edit Cloudflare Workers** → 直接继续创建 → 复制
2. **页面登录密码** —— 你自己定，16 位以上

然后它全自动做完这些：

```
建 KV 命名空间 → 上传 worker.js（附带 KV 绑定 + 两个 Secret）→ 打开 workers.dev 访问 → 配好每天早上 8:10 的定时
```

跑完屏幕上会打印**地址、登录密码、MASTER_KEY**。打开地址登录，逐个添加账号就完事。

> `MASTER_KEY` 务必立刻存进密码管理器。它是加密账号令牌的钥匙，丢了只能全部重新扫码。
>
> 脚本是 `.cmd` + `.ps1`，只用 Windows 自带的 PowerShell 和 .NET，**不需要装 node、不需要装 wrangler**。

---

## 手动方式

不想跑脚本、或者想装到别的平台，看下面的步骤。全程网页操作，约 5 分钟。

---

## 零、开始前准备

- 一个 Cloudflare 账号（免费版够用，Workers 免费额度每天 10 万次请求）
- 三个平台里你想托管的那几个的登录方式（抖音 / 微信 / 浏览器）
- 一个密码管理器——`MASTER_KEY` 丢了只能全部重新扫码，没有找回途径

---

## 一、部署 Worker

### 方式 A：网页控制台（推荐）

**① 建 Worker**

[Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Create Worker**，起个名字（如 `signin-all`）→ Deploy。

**② 建 KV 命名空间**

左侧 **Storage & Databases** → **KV** → **Create a namespace**，名字随便（如 `signin-kv`）。

> 只需要一个。三个平台的数据靠 key 前缀隔离（`trae:` / `wb:` / `qoder:`），不用建三个。

**③ 贴代码**

回到 Worker → **Edit code** → 把 `worker.js` **全文**粘进去 → **Deploy**。

（`worker.js` 约 220 KB，是打包产物。**不要**再让构建工具处理一遍。）

**④ 加绑定和密钥**

Worker → **Settings** → **Variables and Secrets**：

| 类型 | 名称 | 值 | 必需 |
| --- | --- | --- | --- |
| KV Namespace | `KV` | 选第 ② 步建的那个 | ✅ |
| Secret | `MASTER_KEY` | 44 字符 base64，见下 | ✅ |
| Secret | `ADMIN_TOKEN` | 你自己定的登录密码，建议 16 位以上 | ✅ |

生成 `MASTER_KEY`：浏览器按 **F12** → **Console** → 粘贴执行

```js
btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
```

输出一定是 **44 个字符、以 `=` 结尾**。把它存进密码管理器。

> `MASTER_KEY` 用来加密所有账号令牌。**它一旦丢失或被改，KV 里的令牌全部解不开**，只能删掉账号重新扫码。

**⑤ 加定时任务**

Worker → **Settings** → **Triggers** → **Cron Triggers** → **Add**，填：

```
10 0 * * *
```

这是 UTC 时间，等于北京时间 **08:10**。想一天跑多次就再加，但**每跑一次发一条通知**：

| Cron | 北京时间 |
| --- | --- |
| `10 0 * * *` | 08:10 |
| `17 4 * * *` | 12:17 |
| `37 15 * * *` | 23:37 |

### 方式 B：命令行（wrangler）

```bash
npm i -g wrangler
wrangler login
wrangler kv namespace create KV      # 记下返回的 id，填进 wrangler.toml
# 改 wrangler.toml 的 name 和 KV id
wrangler secret put MASTER_KEY
wrangler secret put ADMIN_TOKEN
wrangler deploy --no-bundle
```

`--no-bundle` 必须加：`worker.js` 已经是打包结果，再让 esbuild 处理一遍只会引入风险。

> 用 `wrangler.toml` 部署时，**线上有的 binding 必须全部声明**（KV、plain text 变量），否则部署后会被清掉。Secrets 不用声明，不会被删。

---

## 二、登录并添加账号

打开你的 Worker 域名（`https://<名字>.<子域>.workers.dev`），输入 `ADMIN_TOKEN` 登录。

### Trae（抖音扫码）

点「添加账号」→ 抖音扫码确认 → 浏览器会跳到一个**打不开的** `127.0.0.1` 页面，这是正常的 → 复制地址栏**整段链接** → 回控制台粘到右侧输入框。

> 粘的是扫码之后那个 `127.0.0.1:17388/...` 的地址，不是前面授权页的地址。

### WorkBuddy（微信扫码）

点「添加账号」→ 新窗口打开官方登录页 → 微信扫码确认 → 账号自动出现，窗口自动关闭。二维码约 5–6 分钟有效。

> 官方登录页禁止被内嵌，所以开的是新窗口。

### Qoder（国内版设备授权）

点「添加账号（国内版）」→ 新窗口登录并确认授权 → Worker 轮询到结果后自动入库。

---

## 三、配置通知（可选但强烈建议）

控制台右上角「通知」按钮，两种通道可同时开：

**Telegram**
1. 找 [@BotFather](https://t.me/BotFather) 发 `/newbot`，拿到 Bot Token
2. 给你的 bot 发一条消息，然后访问 `https://api.telegram.org/bot<TOKEN>/getUpdates`，取 `chat.id`

**QQ 机器人**
需要 AppID、Secret、openid（C2C 私聊）。

填完点「测试」，收到就说明通了。

> **QQ 官方机器人有主动消息配额**，配额用完那条推不出去。看重「每天必达」就让 Telegram 当主通道。

配置用 `MASTER_KEY` 加密后存在 KV，不落明文。

---

## 四、验证装好了

把 `<域名>` 和 `<密码>` 换掉：

```bash
# 1. 服务活着吗
curl -H "X-Admin-Token: <密码>" https://<域名>/api/ping

# 2. 余额能不能拿到（第一次会慢 1-3 秒，要真去三个平台查）
curl -H "X-Admin-Token: <密码>" "https://<域名>/api/balance?force=1"

# 3. 手动跑一次签到并写快照
curl -X POST -H "X-Admin-Token: <密码>" https://<域名>/api/snapshot

# 4. 看历史
curl -H "X-Admin-Token: <密码>" "https://<域名>/api/history?days=7"
```

第 2 步返回里每个平台的 `total` 应该和页面顶部的合计一致。第 4 步的 `notify` 里能看到上次通知的时间和 `ok`。

**最后一步验证定时真的会发**：等一次 Cron 到点，看手机有没有响，或者查 `/api/history` 里 `notify.ts` 的时间戳变没变。

---

## 五、装错了怎么查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 打开页面提示「未绑定 KV」 | 没加 `KV` binding，或变量名拼错 | Settings → Variables and Secrets 检查，变量名必须正好是 `KV` |
| 账号全部「令牌失效」 | `MASTER_KEY` 被改过 | 删掉账号重新扫码；确认 `MASTER_KEY` 没被换 |
| 定时跑完没收到通知 | 通知没配 / QQ 配额用完 / 平台接口挂了 | 页面上看「通知 HH:MM 失败」，有就是发出去了被拒收 |
| 余额显示 `—` | 该平台接口这次失败了 | 点右上角时间强制刷新；还不行看 `/<平台>/api/probe` 的原始返回 |
| 页面能开但签到全失败 | 平台改了接口 | 用 `/trae/api/probe`、`/wb/api/probe` 看上游返回什么 |
| 部署后报 `SyntaxError` | 粘的代码被截断，或被构建工具二次处理 | 重新完整粘贴，别用 `wrangler deploy` 不带 `--no-bundle` |

---

## 六、升级与回滚

### 回滚到打补丁前

```bash
cp baseline/worker.baseline.js worker.js
wrangler deploy --no-bundle
```

网页版：把 `baseline/worker.baseline.js` 的内容粘进 Edit code 覆盖，Deploy。

### 重新生成 worker.js

补丁打在打包产物上，不是源码：

```bash
python tools/patch.py baseline/worker.baseline.js worker.js
```

脚本逐处校验锚点唯一性，失配就 `ANCHOR FAIL` 退出，不会产出半成品。

---

## 七、安全提醒

- `ADMIN_TOKEN` 是唯一入口密码，**别用弱密码**，别和别的服务共用
- `MASTER_KEY` 丢失 = 全部重新扫码，但**泄露** = 别人解得出你的账号令牌，同样严重
- 账号令牌在 Worker 内存里必然有一刻是明文——用不用取决于你信不信自己这套部署
- 非官方工具，平台接口随时可能变；签到行为可能违反服务条款，**账号风险自负**
- 多账号、批量跑更容易触发风控，建议只给自己的账号用
