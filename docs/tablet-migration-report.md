# 平板端迁移报告：从 localhost 到实验室 Android 平板

更新：2026-11-14 · 基于 `integration` 分支（`fd7348a`）· 截止日期 12/10

## 1. 结论

- **整体结构不需要改。** 平板端本来就是 PWA，`app/manifest.ts` 已配置全屏竖屏启动 `/tablet`。迁移的主要工作是**部署、设备准备和真机验证**，代码只需要做少量修改。
- **迁移的前提是 HTTPS。** 安装 PWA、全屏、防息屏、录音录像都要求 HTTPS（localhost 例外）。所以顺序必须是：云端数据库 → 部署到 Railway → 平板安装。
- **上真机后，风险最大的是三件事：**
  1. 计时准确度：触摸屏有延迟，而且不同设备之间差异很大；
  2. 视频全部预加载造成的内存压力；
  3. 参与者离开 App 的情况现在没有记录。
- **研究者登录已经完成**（见第 2 节），所以把数据放到云端时满足"只有授权研究者能看"的要求。

## 2. 本次已完成：研究者登录与访问控制

| 改动                                                                                                                                  | 文件                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 研究者白名单表 `researchers` + `is_researcher()`；所有"研究者"权限从"任何登录用户"收紧为"白名单内的用户"；`delete_study` 增加身份检查 | `supabase/migrations/20261114000100_researcher_access.sql` |
| 关闭自助注册，密码最少 8 位                                                                                                           | `supabase/config.toml`                                     |
| 本地 seed 去掉 demo anon 权限，改为创建一个本地测试研究者账号（账号信息见文件注释）                                                   | `supabase/seed.sql`                                        |
| 研究者端和平板端使用不同的客户端：研究者端用 cookie 保存会话；平板端始终是匿名身份，不保存会话                                        | `app/utils/supabase/client.ts`、`study-repository.ts`      |
| 中间件：未登录访问 `/researcher/*` 时跳转到登录页；`/tablet` 不受影响                                                                 | `middleware.ts`、`app/researcher/_components/auth.ts`      |
| 登录页：登录后检查是否在白名单内，不在就自动退出并提示                                                                                | `app/researcher/login/page.tsx`、`LoginForm.tsx`           |
| 顶栏显示当前登录的邮箱，并提供 Sign out 按钮                                                                                          | `AccountMenu.tsx`、`ResearcherShell.tsx`                   |
| 测试：`safeNextPath` 单测，登录页 e2e                                                                                                 | `auth.test.ts`、`tests/researcher/researcher.e2e.ts`       |

**已验证：**

- `npm run researcher:ci` 全部通过：lint、29 个单测、5 个 e2e、build。
- 全部 106 个 Jest 测试通过，平板相关测试不受影响。
- `next build --no-lint` 编译通过，包括中间件。
- 在浏览器里确认了：未登录时会跳转到登录页；`/tablet` 仍可直接访问；服务器连不上时有友好的提示。

**本地 Supabase 实测（11/14，`supabase db reset` 后所有 migration 和 seed 执行成功）：**

- 权限脚本 28 项全部通过，覆盖三种身份：
  - **平板（anon）**：能读取 study、block，能拿到媒体的签名链接，能用 `submit_run` 提交数据、上传录像；不能建或改 study，看不到 runs，下载不了录像，也删不了 study。
  - **不在白名单里的账号**：同样不能建或改 study，看不到参与者数据，删不了 study。
  - **研究者**：建 study、上传媒体、读取数据、下载录像、删除 study 全部正常。
  - **自助注册**：被拒绝。
- 浏览器里的登录流程全部正常：
  - 未登录时跳转到登录页，登录后回到原来要访问的页面；
  - 已登录时访问登录页，会直接跳到研究列表；
  - 退出后再访问受保护页面，会被拦截；
  - 不在白名单里的账号登录后会被自动退出，并显示 "This account is not on the researcher list"。

本地复现方法：

```bash
npx supabase start
npx supabase db reset
```

**配置上的一个坑：**`config.toml` 里的 `[auth.email] enable_signup = false` 会把**整个邮箱登录**关掉，不只是关注册。只能关 `[auth] enable_signup`。改了 `config.toml` 之后，要执行 `supabase stop` 再 `start` 才会生效，`db reset` 不会重新加载配置。

**上云端时管理员要做的事：**

1. 在 Supabase 控制台的 Authentication → Sign In / Providers 关闭 "Allow new users to sign up"。**不要关掉 Email provider 本身。**
2. 在 Authentication → Users 邀请研究者。
3. 用 migration 文件开头注释里的 SQL，把研究者加入白名单。

**已知的本地环境问题（不是这次改动造成的）：**仓库没有 `.gitattributes`，Windows 上 `core.autocrlf=true` 会把部分文件检出为 CRLF，导致 `next build` 的 lint 步骤报 `Delete ␍`。建议加一个 `.gitattributes`（`* text=auto eol=lf`）统一换行符。

## 3. 迁移步骤

### 3.1 云端（Vincent 牵头，Louis 配合）

1. 创建 Supabase 云端项目，执行 `npx supabase link` 和 `npx supabase db push`。注意 `db push` 不会执行 `seed.sql`，这是有意的。
2. 在控制台关闭注册，创建研究者账号并加入白名单。
3. 确认两个私有存储桶 `study-media` 和 `run-recordings` 已经创建。
4. 在 Authentication → URL Configuration 里：
   - **Site URL** 改成 Railway 的正式域名。邀请邮件的链接会打开这个地址，首页会把链接转到 `/researcher/reset-password`，让研究者设置密码；
   - **Redirect URLs** 加上 `https://<Railway 域名>/researcher/reset-password`，"忘记密码"邮件的链接才会直接打开设置密码页。
5. 云端 Supabase 自带的邮件服务每小时只能发几封，只够测试用。正式使用前，在 Authentication → SMTP Settings 配置学校或实验室的邮箱；或者先在控制台用 "Add user → Create new user" 直接给研究者设好密码，不发邮件。

### 3.2 部署（Louis / Andy）

1. 在 Railway 部署 Next.js，配置以下环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_RESEARCHER_PIN`（**必须改掉默认的 `0000`**）
2. **service_role key 永远不要放进前端代码或仓库。**
3. 部署完成后，在桌面浏览器上把完整流程跑一遍：登录 → 建 study → `/tablet` 跑一次 → 查看数据。

### 3.3 平板一次性准备（每台设备做一次）

| 项目     | 做法                                                                                                                        | 原因                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 确认型号 | 在平板上打开 `/tablet/check`（研究列表底部的 "Device check"），点 Copy report 发给组里；型号读不到时在 设置 → 关于平板 查看 | 计时和内存表现都取决于设备；这个页面同时检查 Android/Chrome 版本、内存、存储、PWA 安装、持久存储和系统时钟 |
| 安装 PWA | Chrome 打开 `/tablet` → ⋮ → Install app                                                                                     | 全屏竖屏启动；已安装的 PWA 允许自动播放带声音的视频                                                        |
| 锁定     | 设置里打开 App pinning，并勾选"取消固定需要 PIN"                                                                            | 参与者没有 PIN 就离不开 App                                                                                |
| 勿扰模式 | 打开勿扰模式，关闭所有通知                                                                                                  | 避免弹窗打断实验                                                                                           |
| 屏幕     | 关闭自动亮度，把屏幕超时设为最长                                                                                            | 保证不同参与者看到的亮度一致；代码里的防息屏是双保险                                                       |
| 电池     | 对 Chrome 关闭"省电优化"，实验时保持充电                                                                                    | 省电模式会降低性能，甚至阻止自动播放                                                                       |
| 时间     | 打开"自动设置时间"（网络校时）                                                                                              | 视频开始/结束的绝对时间戳依赖系统时钟                                                                      |
| 更新     | 实验期间关闭 Chrome 和系统的自动更新                                                                                        | 浏览器版本变化可能改变计时表现，同一个研究里应该保持一致                                                   |
| 存储     | 保留足够的空闲空间（建议大于 study 视频总量的 3 倍）                                                                        | 预加载和录像都需要空间                                                                                     |
| 音量     | 固定一个音量，并贴标签标明                                                                                                  | 保证不同参与者之间的刺激一致                                                                               |

### 3.4 每次实验前的检查清单（写进用户手册）

1. 平板已充电、已连 Wi-Fi，勿扰模式已打开。
2. 打开已安装的 App，选择 study，等预加载完成。
3. 固定屏幕（App pinning）。
4. 交给参与者输入 ID。
5. 实验结束后，研究者用 PIN 出口退出，确认"待上传"数量为 0。

## 4. 迁移后可能出现的问题

| #   | 问题                              | 原因与证据                                                                                                                                                                                                                      | 现状                                                        | 建议                                                                                                                                                                   |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **触摸计时有系统性延迟**          | 研究表明，网页应用在触摸屏上刺激呈现计时很准，但反应时测量只能做到中等精度[^pronk]；Android 设备的反应时普遍偏慢[^tmb]；有研究不建议用 Samsung Galaxy 平板测简单反应时[^tablet2023]。在线平台实测的延迟大约 80–100 ms[^gorilla] | 已用 `event.timeStamp` 计时，这是浏览器能做到的最好方式     | ① 所有参与者用**同一型号**的平板；② 用 240fps 慢动作拍摄，测出这台设备的平均延迟和波动，写进报告；③ 在文档里说明，比较组间差异是可靠的，但绝对时间值包含固定的设备延迟 |
| 2   | **视频开始时间不够精确**          | `requestVideoFrameCallback` 能拿到"帧提交给合成器"的时间，但浏览器不保证严格准确[^rvfc]                                                                                                                                         | 用的是第一次 `playing` 事件的时间                           | 在支持的设备上改用 `requestVideoFrameCallback`，没有时退回到 `playing`；用光敏二极管或慢动作视频验证，报告误差                                                         |
| 3   | **视频太多导致内存不足**          | Chromium 在 Android 上给内存中 blob 的上限大约是物理内存的 1%，超出部分转存到磁盘[^blob]。低内存设备在大 study 上可能变慢或失败                                                                                                 | 全部视频先下载成 blob；结束时会调用 `releaseMedia` 释放     | ① 研究者上传视频时统一压缩成 720p H.264；② 研究者端显示 study 视频总大小，超过阈值时提醒；③ 在目标平板上测试最大可承受的 study 大小                                    |
| 4   | **自动播放带声音被拦截**          | Chrome 要求用户先有点击，或者网站已安装为 PWA[^autoplay]                                                                                                                                                                        | 在 Start 按钮的点击里进入全屏并开始播放 ✓                   | 保持现状；在真机上测一次，确认有声音                                                                                                                                   |
| 5   | **锁定被绕过**                    | 屏幕固定是给用户用的功能，重启设备就会自动解除，本身并不防篡改[^pinning]                                                                                                                                                        | README 里写了屏幕固定的步骤                                 | 有人看着做实验时，屏幕固定就够了；如果平板要无人值守，改用 Fully Kiosk Browser、开源的 FreeKiosk，或者 Android Enterprise 的 lock task 模式[^locktask]                 |
| 6   | **参与者离开 App 的时间没有记录** | 切出 App 或被弹窗打断的时间，会被算进当前 block 的观看时长                                                                                                                                                                      | 只在切回来时重新申请防息屏，不记录                          | 记录 `visibilitychange`，新增 `away_count` 和 `away_ms` 两列（平板端改动，需要 Andy 配合，并同步修改 `submit_run`）                                                    |
| 7   | **离线数据被系统清理**            | 浏览器存储在空间不足时可能被清除；`navigator.storage.persist()` 可以申请持久存储[^quota]                                                                                                                                        | 实验结果存在 localStorage，录像存在 IndexedDB，联网后重传 ✓ | 启动时调用 `navigator.storage.persist()`；用户手册写明"不要清除 Chrome 的网站数据"                                                                                     |
| 8   | **和 iMotions 的时间对不上**      | 业内标准做法是 Lab Streaming Layer (LSL)，iMotions 也支持；LSL 在局域网内能做到亚毫秒级同步，但测不到输入设备本身的延迟[^lsl]                                                                                                   | 只有平板的系统时钟时间戳                                    | 短期：两台机器都开网络校时，实验开始时屏幕闪一下白光作为同步点；长期（future work）：在实验室电脑上写一个小程序，接收平板通过 WebSocket 发来的事件，再转成 LSL 标记    |
| 9   | **参与者能看到所有 study**        | 平板以匿名身份可以读取全部 study，包括还没完成的草稿                                                                                                                                                                            | 和设计稿的"列出实验"一致                                    | 可选：给 `studies` 加一个 `published` 字段，平板只显示已发布的 study                                                                                                   |
| 10  | **研究者 PIN 太弱**               | 带 `NEXT_PUBLIC_` 前缀的变量会被打包进前端代码，默认值是 `0000`                                                                                                                                                                 | —                                                           | 部署时一定要改；文档里说明它只用来防止参与者误操作                                                                                                                     |

## 5. 研究者端与平板端的风格统一

**现状：**

- **平板端**：黑底白字，强调色 `#cc0000`，字体 Outfit，像 Reels 一样的沉浸式界面。
- **研究者端**：浅灰和白色的工作界面，BU 红色有 `#b5142c` 和 `#c41230` 两个值，各页面自己定义颜色变量。

**建议：统一品牌元素，保留界面差异。**

- **不要把两边做成一样的配色。**参与者端深色沉浸是为了还原 Reels，这直接关系到生态效度；研究者端浅色更适合长时间填表和看数据。
- **统一的部分**：在 `app/styles/tokens.css` 定义一套共享变量，两边都引用。包括：
  - 只保留**一个** BU 红色；
  - 字体都用 Outfit；
  - 统一圆角和焦点框样式；
  - 统一 BU 标志和 "STAR LAB" 字样的样式。
- **加分项**：研究者端编辑 study 时，加一个 "Preview on tablet" 按钮，在手机框里预览某个 block 在平板上的效果，复用平板的组件。这样研究者设置按钮和文字时所见即所得，也能自然地把两边的风格联系起来。
- 这对应看板上的 "Aligning the theme for the website"，建议放在 Polish 周（11/26–12/3），优先级排在登录和迁移之后。

## 6. 实施计划（到 12/10）

| 时间           | 任务                                                                           | 负责                              |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| 11/14–11/17    | 合并研究者登录 PR；本地用 Docker 验证权限；确认平板型号                        | Louis（Vincent review migration） |
| 11/17–11/20    | 云端 Supabase + Railway 部署；平板完成一次性准备                               | Vincent + Louis + Andy            |
| 11/18 客户会议 | 在真机上做 mock session；同时问第 7 节的问题                                   | 全组                              |
| 11/19–11/25    | 真机计时测试（慢动作）；记录离开 App 的时间；申请持久存储；测试最大 study 大小 | Andy（Louis 协助测试）            |
| 11/26–12/3     | 统一风格（共享变量）；用户手册（设备准备 + 实验前检查清单）；根据反馈修改      | Louis 负责风格和手册              |
| 12/4–12/10     | 最终报告（计时误差图等）、汇报、交付                                           | 全组                              |

## 7. 需要向客户确认的问题

1. **平板的具体型号**、Android 版本，以及有几台。这决定计时测试和内存上限测试用哪台设备。
2. **平板是否有人看着使用。**有人看着的话，屏幕固定就够了；无人值守就需要 kiosk 软件或设备管理（MDM）。
3. **iMotions 是否在同一台实验室电脑上运行，是否使用 LSL。**这决定时间对齐采用短期方案还是长期方案。
4. **大概有几位研究者要使用平台**，是否需要区分谁能看哪个 study。如果不需要，现在的白名单方案就足够了。

## 参考资料

[^pronk]: Pronk et al., _Mental chronometry in the pocket? Timing accuracy of web applications on touchscreen and keyboard devices_, Behavior Research Methods. <https://ouci.dntb.gov.ua/works/4EoAyxN9>

[^tmb]: _Cognitive test scores vary with choice of personal digital device_ (TestMyBrain). <https://pubmed.ncbi.nlm.nih.gov/33954913/>

[^tablet2023]: _Updated validation of the accuracy of reaction time assessment on computer-based tablet devices_, Archives of Clinical Neuropsychology. <https://www.ebsco.com/articles/economics/c826ce2d-a9f9-517c-8855-8c67d79823f0/a-55-updated-validation-of-the-accuracy-of-reaction-time-assessment-on-computer-based-tablet-devices>

[^gorilla]: Gorilla, _Timing Performance of Online Experiments_. <https://gorilla.sc/timing-performance-of-online-experiments>

[^rvfc]: MDN, `HTMLVideoElement.requestVideoFrameCallback()`. <https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback>

[^blob]: Chromium, Blob storage README. <https://chromium.googlesource.com/chromium/src/+show/HEAD/storage/browser/blob/README.md>

[^autoplay]: Chrome for Developers, _Autoplay policy in Chrome_. <https://developer.chrome.com/blog/autoplay>

[^pinning]: Esper, _What is Android screen pinning_. <https://www.esper.io/blog/what-is-android-screen-pinning-what-can-it-be-used-for>

[^locktask]: Android Developers, _Lock task mode_. <https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode>

[^quota]: MDN, _Storage quotas and eviction criteria_. <https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>

[^lsl]: _The Lab Streaming Layer for Synchronized Multimodal Recording_. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10888901>
