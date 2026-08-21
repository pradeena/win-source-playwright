# WIN SOURCE Playwright Test Suite — Debugging Session Report

**Date / 日期:** 2026-08-20
**Project / 项目:** `win-source-playwright` (E2E tests for https://www.win-source.net)
**Language / 语言:** English + 中文 (bilingual, English first / 英文在前，中文在后)

---

# Part 1 — English

## 1. Project Overview

`win-source-playwright` is a Playwright-based end-to-end test suite for the live production site **win-source.net** (an obsolete/electronic-parts distributor). There is no application code in this repository — `src/index.html` is an empty placeholder. The real content is under `tests/`, covering five user journeys:

| Spec file | What it checks |
|---|---|
| `home-logo.spec.ts` | Home page logo image renders (non-zero `naturalWidth`) |
| `login.spec.ts` | Login form is visible; optionally performs a real login if `WIN_SOURCE_EMAIL` / `WIN_SOURCE_PASSWORD` are set |
| `pageimage.spec.ts` | A specific product's detail page shows its real product photo |
| `product-search.spec.ts` | Searching a part number leads to the correct product detail page |
| `register.spec.ts` | Registration link, form fields, and a real form submission |

Configuration (`playwright.config.ts`) runs against chromium/firefox/webkit, and already sends a custom header on every request:

```ts
extraHTTPHeaders: {
  "x-ws-automation-key": "$4b5YSE^TgK<iJNU#uF75x",
},
```

This confirms the target site has anti-bot protections that automation traffic is expected to identify itself to.

CI (`.github/workflows/playwright.yml`) runs the full suite on every push/PR to `main`/`master` and uploads the HTML report as an artifact.

## 2. Issues Found and Fixes Applied

### 2.1 `product-search.spec.ts` — anonymous search redirected to login

**Symptom:** `expect(locator).toBeVisible()` timed out (20s) waiting for a search-result link (`a[href*="/products/detail/"]` containing the part number).

**Root cause:** The page's accessibility snapshot at failure time showed the site had redirected to `/login?returnUrl=...&q=LM358BIDR` — i.e. **anonymous searches are now gated behind a login wall**. The test was waiting for an element that could never appear because the browser was never on the search-results page.

**Fix:**
1. Added `scripts/generate-auth.js` — a standalone Node script (not run by `playwright test`) that logs in with real credentials from `.env` (`WIN_SOURCE_EMAIL` / `WIN_SOURCE_PASSWORD`) and saves the authenticated session to `playwright/.auth/user.json` via Playwright's `context.storageState()`. Added `npm run generate-auth` to `package.json`.
2. **Important detail:** the script must open its page inside a browser *context* configured with the same `x-ws-automation-key` header used by `playwright.config.ts` — a plain `chromium.launch()` + `browser.newPage()` bypasses the test runner's `use.extraHTTPHeaders` entirely, and the login page then fails to render within the script's timeout because it's not recognized as legitimate automated traffic.
3. Added to `product-search.spec.ts` (inside `test.describe`, before the `test(...)` call):
   ```ts
   test.use({ storageState: 'playwright/.auth/user.json' });
   ```

### 2.2 `product-search.spec.ts` — second issue after fixing auth: exact-match searches skip the results list

**Symptom (after the auth fix):** the test no longer got redirected to login, but still timed out waiting for the same results-list link, this time genuinely — the failure snapshot showed the browser had already landed on the **product detail page itself** (heading "LM358BIDR", "Part No", "Manufacturer: Texas Instruments", etc.).

**Root cause:** The site's search now redirects straight to the product detail page when the query matches exactly one part number — there is no intermediate results-list page to click through for this case. The original test's assumption ("search → results list → click matching link → detail page") no longer matches the site's behavior for exact matches.

**Fix:** Removed the intermediate results-link wait/click; wait directly for navigation to the detail page instead:

```ts
await Promise.all([
  page.waitForURL(/\/products\/detail\//, { timeout: 20_000 }),
  searchBox.press('Enter'),
]);
```

The final assertions (heading, "Part No", "Manufacturer", "Description", "Texas Instruments") were kept unchanged — they already validate the meaningful end state.

### 2.3 `pageimage.spec.ts` — same login wall, now on product detail pages

**Symptom:** `expect(locator).toBeVisible()` for the product heading timed out (5s default).

**Root cause:** The failure snapshot again showed `Welcome, Please Sign In!` and a `returnUrl` pointing back to the product detail page URL — anonymous direct navigation to a product page is now also gated behind login (broader than just search).

**Fix:** Same pattern as 2.1 — added `test.use({ storageState: 'playwright/.auth/user.json' });` inside `pageimage.spec.ts`'s `test.describe`.

**Verification:** Full suite run after these fixes: 27 total tests, 24 passed, only the 3 (chromium/firefox/webkit) `pageimage.spec.ts` runs were still failing at that point — fixed with 2.3.

### 2.4 `register.spec.ts` (webkit) — blocked by server-side Cloudflare bot filter

**Symptom:** `expect(page).toHaveURL(...)` failed — expected `.../register?returnUrl=%2F`, received `https://www.win-source.net/security-delta-5.html`.

**Root cause:** The site (an ASP.NET MVC / nopCommerce-based app, per the shared `CloudflareBotFilterAttribute.cs`) has a server-side action filter that inspects Cloudflare-forwarded headers (`cf-bot-score`, `x-is-bot`, verified-bot flag, User-Agent) on every request and redirects suspicious traffic to `/security-delta-5.html`. The user supplied the filter's source and the block log:

```
[2026-08-20 10:36:39.828] Blocked: cf-bot-score 1 is below threshold 20 | clientIp=240e:3b1:a430:6810:94c1:cef7:75f1:8337 | edgeIp=172.69.150.169 | ray=a2de02fc2c094d44-FRA | ua=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15 | url=/products/detail/texas-instruments/lm358bidr.html
[2026-08-20 10:36:43.849] Blocked: cf-bot-score 1 is below threshold 20 | clientIp=240e:3b1:a430:6810:94c1:cef7:75f1:8337 | edgeIp=172.69.40.197 | ray=a2de03155bbc9279-SLC | ua=... | url=/register?returnUrl=%2F
```

(A separate, unrelated log line for a spoofed Facebook/Twitter-bot User-Agent, reason `x-is-bot header is true`, was real bot traffic correctly blocked — not part of this investigation.)

## 3. Root-Cause Analysis: Why the IP Whitelist Didn't Work

The user reported that adding their "current IP" to the whitelist had no effect even with `CommonSettings.EnableBlockBotFilter` enabled. Analysis of `CloudflareBotFilterAttribute.cs` plus the block log pinpointed the cause precisely.

### 3.1 The real client IP is IPv6, and IPv6 has its own, separate whitelist

```csharp
if (IsIPv6(currentIpAddress))
{
    if (IsIPv6WhiteListed(currentIpAddress, whitelistedIpv6Str.Split(';')))
        return;
}
else if (IsIPv4WhiteListed(currentIpAddress, whitelistedIpStr.Split(';')))
{
    return;
}
```

The block log's `clientIp` is `240e:3b1:a430:6810:94c1:cef7:75f1:8337` — an **IPv6** address (the `240e::/20` prefix is allocated to China Telecom). Because the address is IPv6, the code checks it exclusively against `Win-Source.Block.IPv6WhiteList` (default `::1`), **never** against `Win-Source.Block.IPWhiteList` (the IPv4 setting the user had edited). Whatever IPv4 address was added there is simply never consulted for this traffic — so the whitelist entry was never wrong, it was just checked against the wrong request.

### 3.2 Recommended fix

Add the tester's IPv6 address to `Win-Source.Block.IPv6WhiteList` instead. Because residential/mobile ISPs commonly use IPv6 privacy extensions (RFC 4941) — the interface-identifier (last 64 bits) rotates periodically while the delegated prefix stays stable — whitelisting the full `/128` address is fragile. Whitelisting the `/64` prefix is more robust:

```
::1;240e:3b1:a430:6810::/64
```

`MatchesIPv6WhiteListEntry` already supports CIDR notation (`entry.Contains("/")` → `IsIpInCidr`), so this format works without further code changes.

### 3.3 Secondary code observation (not the cause here, but worth fixing)

`IsIPv4WhiteListed` has **no CIDR support at all** — it only matches a full exact IP string, or a hand-rolled "first three octets + trailing dot" prefix (e.g. `"203.0.113."`). This is inconsistent with the IPv6 path, which supports CIDR via `IsIpInCidr`. If anyone ever adds an IPv4 entry in CIDR form (e.g. `203.0.113.5/32`), it will silently fail to match. Recommendation: reuse `IsIpInCidr` for IPv4 whitelist entries containing `/`, mirroring the IPv6 code path, for consistency and to avoid this class of silent misconfiguration in the future.

### 3.4 Contributing factor

Playwright's bundled WebKit reports a User-Agent with `Version/26.5` — a Safari version number that does not correspond to any real shipped Safari release. This kind of UA/version mismatch is a common signal Cloudflare's bot-scoring model penalizes heavily, which is consistent with the observed `cf-bot-score` of 1 (out of presumably 100, well under the configured threshold of 20/30). This reinforces that **IP allowlisting is the sustainable way to keep automated tests passing** — User-Agent spoofing is not a durable workaround against Cloudflare's bot management.

## 4. Files Changed in This Session

| File | Change |
|---|---|
| `scripts/generate-auth.js` (new) | Logs in with `.env` credentials (with the automation header applied to its browser context) and saves session state to `playwright/.auth/user.json` |
| `package.json` | Added `"generate-auth": "node scripts/generate-auth.js"` script |
| `tests/product-search.spec.ts` | Added `test.use({ storageState })`; replaced results-list click with a direct wait for `/products/detail/` navigation |
| `tests/pageimage.spec.ts` | Added `test.use({ storageState })` |

`playwright/.auth/` was already present in `.gitignore`, so no changes were needed there — the repo author had already anticipated this pattern.

## 5. Outstanding / Recommended Next Steps

- Add the tester's IPv6 `/64` prefix to `Win-Source.Block.IPv6WhiteList` (server-side change, not part of this repo) and re-run `register.spec.ts` on webkit to confirm the fix.
- Consider adding CIDR support to `IsIPv4WhiteListed` for consistency with the IPv6 path.
- Because the IPv6 address can still shift outside the whitelisted `/64` if the ISP re-delegates a different prefix, keep an eye on the block log if failures resurface after a network change.
- Re-run `npm test` (all projects) to confirm the full suite is green end-to-end.

---

# 第二部分 — 中文

## 1. 项目概述

`win-source-playwright` 是一个基于 Playwright 的端到端（E2E）测试项目，测试对象是线上生产环境的 **win-source.net**（一个电子元器件/停产料号分销网站）。仓库里没有真正的业务代码——`src/index.html` 只是一个空壳占位文件。真正的内容都在 `tests/` 目录下，覆盖 5 条用户路径：

| 测试文件 | 验证内容 |
|---|---|
| `home-logo.spec.ts` | 首页 logo 图片能正常加载（`naturalWidth` 大于 0） |
| `login.spec.ts` | 登录表单可见；如果配置了 `WIN_SOURCE_EMAIL` / `WIN_SOURCE_PASSWORD`，还会执行一次真实登录 |
| `pageimage.spec.ts` | 某个具体产品详情页的实拍图能正常加载 |
| `product-search.spec.ts` | 搜索一个料号能正确跳转到对应产品详情页 |
| `register.spec.ts` | 注册入口、表单字段、以及一次真实的表单提交 |

配置文件 `playwright.config.ts` 会在 chromium/firefox/webkit 三个浏览器上运行，并且已经给每个请求都带上了一个自定义 header：

```ts
extraHTTPHeaders: {
  "x-ws-automation-key": "$4b5YSE^TgK<iJNU#uF75x",
},
```

这说明目标网站本身就有反自动化机制，自动化流量需要用这个 header 来"自证身份"。

CI（`.github/workflows/playwright.yml`）会在每次 push/PR 到 `main`/`master` 时跑全套测试，并把 HTML 报告作为 artifact 上传。

## 2. 发现的问题与已完成的修复

### 2.1 `product-search.spec.ts` —— 匿名搜索被弹回登录页

**现象：** `expect(locator).toBeVisible()` 等待搜索结果链接（`a[href*="/products/detail/"]` 且包含料号文本）20 秒后超时。

**根因：** 失败时抓取的页面快照显示，页面其实已经被重定向到了 `/login?returnUrl=...&q=LM358BIDR`——也就是说**匿名搜索现在需要登录才能用**。测试一直在等一个永远不会出现的元素，因为浏览器根本没停留在搜索结果页上。

**修复：**
1. 新增 `scripts/generate-auth.js`——一个独立的 Node 脚本（不会被 `playwright test` 自动执行），用 `.env` 里的真实账号密码（`WIN_SOURCE_EMAIL` / `WIN_SOURCE_PASSWORD`）登录一次，把登录后的会话通过 Playwright 的 `context.storageState()` 保存到 `playwright/.auth/user.json`。在 `package.json` 里加了 `npm run generate-auth` 命令。
2. **一个关键细节：** 这个脚本必须在带有和 `playwright.config.ts` 里同样的 `x-ws-automation-key` header 的浏览器 context 里打开页面——直接用 `chromium.launch()` + `browser.newPage()` 会完全绕过测试运行器的 `use.extraHTTPHeaders`，导致登录页因为不被识别为"合法自动化流量"而在脚本的超时时间内渲染失败。
3. 在 `product-search.spec.ts` 里加了（写在 `test.describe` 内部、`test(...)` 调用之前）：
   ```ts
   test.use({ storageState: 'playwright/.auth/user.json' });
   ```

### 2.2 `product-search.spec.ts` —— 修好登录问题后暴露出的第二个问题：精确匹配的搜索不再经过结果列表

**现象（登录问题修复后）：** 测试不再被弹回登录页了，但依然在等同一个结果列表链接时超时——这次是真的等不到，因为失败快照显示浏览器其实已经**落在产品详情页本身**了（标题 "LM358BIDR"、"Part No"、"Manufacturer: Texas Instruments" 等信息都在）。

**根因：** 网站的搜索功能现在只要搜索词精确匹配唯一一个料号，就会**直接跳转到该产品详情页**，不会再经过中间的结果列表页面。原测试假设的流程（"搜索 → 出结果列表 → 点击匹配链接 → 进入详情页"）已经和当前网站在"精确匹配"这种场景下的实际行为不一致了。

**修复：** 去掉了"等待并点击结果列表链接"这一步，改成直接等待跳转到详情页：

```ts
await Promise.all([
  page.waitForURL(/\/products\/detail\//, { timeout: 20_000 }),
  searchBox.press('Enter'),
]);
```

后面原有的断言（标题、"Part No"、"Manufacturer"、"Description"、"Texas Instruments"）都原样保留——它们本来就是在验证最终落地状态是否正确。

### 2.3 `pageimage.spec.ts` —— 同样的登录墙，这次出现在产品详情页上

**现象：** 等待产品标题的 `expect(locator).toBeVisible()` 超时（默认 5 秒）。

**根因：** 失败快照里同样出现了 `Welcome, Please Sign In!` 和指回产品详情页 URL 的 `returnUrl`——说明**匿名直接访问产品详情页现在也需要登录**了，不只是搜索功能。

**修复：** 跟 2.1 的处理方式一样，在 `pageimage.spec.ts` 的 `test.describe` 里加上 `test.use({ storageState: 'playwright/.auth/user.json' });`。

**验证：** 这几处修复之后跑了一次全量测试：共 27 个测试，24 个通过，当时只剩 `pageimage.spec.ts` 在 chromium/firefox/webkit 三个浏览器上共 3 个失败——用 2.3 的修复解决了。

### 2.4 `register.spec.ts`（webkit）—— 被服务端的 Cloudflare bot 过滤器拦截

**现象：** `expect(page).toHaveURL(...)` 失败——期望是 `.../register?returnUrl=%2F`，实际收到的是 `https://www.win-source.net/security-delta-5.html`。

**根因：** 该网站（根据用户提供的 `CloudflareBotFilterAttribute.cs`，是基于 ASP.NET MVC / nopCommerce 的应用）有一个服务端的 action filter，会在每个请求上检查 Cloudflare 转发过来的头信息（`cf-bot-score`、`x-is-bot`、认证 bot 标记、User-Agent），把可疑流量重定向到 `/security-delta-5.html`。用户提供的拦截日志：

```
[2026-08-20 10:36:39.828] Blocked: cf-bot-score 1 is below threshold 20 | clientIp=240e:3b1:a430:6810:94c1:cef7:75f1:8337 | edgeIp=172.69.150.169 | ray=a2de02fc2c094d44-FRA | ua=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15 | url=/products/detail/texas-instruments/lm358bidr.html
[2026-08-20 10:36:43.849] Blocked: cf-bot-score 1 is below threshold 20 | clientIp=240e:3b1:a430:6810:94c1:cef7:75f1:8337 | edgeIp=172.69.40.197 | ray=a2de03155bbc9279-SLC | ua=... | url=/register?returnUrl=%2F
```

（日志里还有一条无关的记录，是伪造成 Facebook/Twitter 抓取工具 User-Agent 的流量，原因是 `x-is-bot header is true`——这是被正确拦下的真实爬虫流量，跟本次排查无关。）

## 3. 根因分析：为什么 IP 白名单没有生效

用户反馈：在 `CommonSettings.EnableBlockBotFilter` 开启的情况下，把"当前 IP"加进白名单也没用。结合 `CloudflareBotFilterAttribute.cs` 的代码逻辑和拦截日志，可以精确定位原因。

### 3.1 真实客户端 IP 是 IPv6，而 IPv6 走的是完全独立的白名单

```csharp
if (IsIPv6(currentIpAddress))
{
    if (IsIPv6WhiteListed(currentIpAddress, whitelistedIpv6Str.Split(';')))
        return;
}
else if (IsIPv4WhiteListed(currentIpAddress, whitelistedIpStr.Split(';')))
{
    return;
}
```

拦截日志里的 `clientIp` 是 `240e:3b1:a430:6810:94c1:cef7:75f1:8337`——这是一个 **IPv6** 地址（`240e::/20` 这个前缀分配给中国电信）。因为这个地址是 IPv6，代码只会去比对 `Win-Source.Block.IPv6WhiteList`（默认值只有 `::1`），**完全不会**去查 `Win-Source.Block.IPWhiteList`（用户之前改的那个 IPv4 设置）。也就是说，用户加进 IPv4 白名单里的那个 IP 从头到尾都没被这次请求查询过——不是白名单条目本身填错了，而是这次流量根本没有走到会用上它的那个判断分支。

### 3.2 建议修复方式

把测试者的 IPv6 地址加到 `Win-Source.Block.IPv6WhiteList` 里。考虑到家用/移动宽带的 ISP 普遍使用 IPv6 隐私扩展（RFC 4941）——接口标识部分（地址的后 64 位）会定期轮换，但分配到的网段前缀通常保持稳定——直接白名单一个完整的 `/128` 地址比较脆弱，建议用 `/64` 网段：

```
::1;240e:3b1:a430:6810::/64
```

`MatchesIPv6WhiteListEntry` 已经支持 CIDR 写法（判断到 `/` 就走 `IsIpInCidr`），所以这个格式不需要改代码就能直接生效。

### 3.3 顺带发现的一个代码问题（跟这次问题无关，但值得修一下）

`IsIPv4WhiteListed` **完全不支持 CIDR 写法**——它只认完整精确匹配的 IP 字符串，或者一个手写的"前三段 + 结尾点"前缀（比如 `"203.0.113."`）。这跟 IPv6 那边（通过 `IsIpInCidr` 支持 CIDR）不一致。如果以后有人往 IPv4 白名单里加了类似 `203.0.113.5/32` 这种 CIDR 格式的条目，会静默匹配失败。建议：对包含 `/` 的 IPv4 白名单条目也复用 `IsIpInCidr`，跟 IPv6 那条路径保持一致，避免未来再踩到这种"配置看起来是对的、但实际没生效"的坑。

### 3.4 一个加剧因素

Playwright 自带的 WebKit 浏览器报出的 User-Agent 里带着 `Version/26.5`——这是一个现实中从未真正发布过的 Safari 版本号。这种"UA 和版本号对不上任何真实发行版"的特征，正是 Cloudflare bot 评分模型会重点扣分的信号之一，这也跟观察到的 `cf-bot-score` 只有 1 分（远低于配置的 20/30 阈值）相吻合。这进一步说明：**IP 白名单才是让自动化测试稳定跑下去的可持续方案**，指望靠伪造 User-Agent 骗过 Cloudflare 的 bot 管理机制并不靠谱。

## 4. 本次会话中改动的文件

| 文件 | 改动内容 |
|---|---|
| `scripts/generate-auth.js`（新增） | 用 `.env` 里的账号密码登录（浏览器 context 带上自动化 header），把登录态保存到 `playwright/.auth/user.json` |
| `package.json` | 新增 `"generate-auth": "node scripts/generate-auth.js"` 命令 |
| `tests/product-search.spec.ts` | 加上 `test.use({ storageState })`；把"点击结果列表链接"改成直接等待跳转到 `/products/detail/` |
| `tests/pageimage.spec.ts` | 加上 `test.use({ storageState })` |

`playwright/.auth/` 这个路径本来就已经在 `.gitignore` 里了，所以不需要改 `.gitignore`——说明仓库作者当初就已经预留了这个登录态存放位置。

## 5. 待办 / 后续建议

- 把测试者的 IPv6 `/64` 网段加进 `Win-Source.Block.IPv6WhiteList`（这是服务端改动，不在这个测试仓库范围内），然后重新跑一次 webkit 上的 `register.spec.ts` 确认修复生效。
- 建议给 `IsIPv4WhiteListed` 补上 CIDR 支持，跟 IPv6 那条路径保持一致。
- 因为 ISP 重新分配网段前缀时，IPv6 地址仍有可能跳出已加白名单的那个 `/64` 范围，如果换网络环境后测试又开始失败，记得回去看一下拦截日志确认原因。
- 重新跑一次 `npm test`（全部浏览器项目），确认整套测试全部通过。
