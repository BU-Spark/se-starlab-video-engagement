# Engineer 3 接口交接说明

对应页面：`/researcher/studies/new`  
前端负责人：Engineer 1 / Louis  
后端负责人：Engineer 3  
日期：2026-10-16

## 1. 当前实现和接入位置

创建页已实现三种 block、设置、排序、删除确认、本地文件预览、校验及模拟保存。**目前不发送业务 HTTP 请求，不上传文件，不持久化实验。** 刷新会清空数据。

相关文件：

- [StudyBuilder.tsx](../app/researcher/_components/StudyBuilder.tsx)：页面与保存操作。
- [study-model.ts](../app/researcher/_components/study-model.ts)：前端模型、验证、`StudyPayload` 及 `buildStudyPayload`。
- [demo-service.ts](../app/researcher/_components/demo-service.ts)：模拟保存，需要在正式联调时由真实请求服务替换。
- [researcher.md](researcher.md)：功能范围和演示步骤。

下面是需要双方确认的 API 契约提案，并非已实现后端。先完成“上传资源 → 创建实验 → 读取确认”闭环；列表、历史运行、导出不属于本次页面接入。

## 2. 路由清单

统一前缀建议为 `/api/v1`，JSON 字段使用 snake_case。

| 优先级 | 方法和路径 | Engineer 3 需要完成的行为 | 成功响应 |
| --- | --- | --- | --- |
| 本轮接入 | POST /api/v1/assets/upload-url | 校验研究者权限、文件用途、类型和大小，创建资源记录并返回受限上传凭证 | 201，见上传约定 |
| 本轮接入 | POST /api/v1/assets/{asset_id}/complete | 检查上传对象真实存在、类型/大小符合规则，将资源标记可引用；重复调用不创建重复资源 | 200，资源详情 |
| 本轮接入 | POST /api/v1/studies | 校验完整实验和资源归属，一次性保存设置及所有 block | 201，StudyRead |
| 保存验收 | GET /api/v1/studies/{study_id} | 校验权限并返回完整、按原始顺序排列的实验 | 200，StudyRead |
| 后续编辑 | PUT /api/v1/studies/{study_id} | 校验 base_revision，原子替换实验配置并递增 revision | 200，StudyRead |

当前前端只有创建页，没有实验列表/已有实验编辑页；GET/PUT 的 UI 回填和更新调用仍需后续接入。不要把后端返回值直接塞进含 File 对象的本地表单模型。

所有 Study 和 Asset 路由均需研究者认证和资源级权限检查。认证提供商沿用团队最终方案，不能因为接口在本地可调用，就省略正式部署的权限保护。

## 3. 创建实验请求

`POST /api/v1/studies` 使用以下 JSON。示例 UUID 为演示值，video 的 asset_id 必须来自真实上传完成响应。

```json
{
  "name": "Short-form video attention",
  "settings": {
    "randomization": { "mode": "videos_only" },
    "show_video_progress": true,
    "allow_back_navigation": false,
    "allow_pause": false,
    "response_buttons": {
      "enabled": true,
      "left": {
        "label": "",
        "default_icon": "thumbs_down",
        "icon_asset_id": null
      },
      "right": {
        "label": "",
        "default_icon": "thumbs_up",
        "icon_asset_id": null
      }
    }
  },
  "blocks": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "type": "instruction",
      "text": "Please watch each video at your own pace."
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "type": "video",
      "asset_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    },
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "type": "survey",
      "question": "How engaging was the video?",
      "options": [
        { "id": "44444444-4444-4444-8444-444444444444", "label": "Not engaging" },
        { "id": "55555555-5555-4555-8555-555555555555", "label": "Neutral" },
        { "id": "66666666-6666-4666-8666-666666666666", "label": "Very engaging" }
      ]
    }
  ]
}
```

StudyRead 返回上面全部字段，并增加：

| 字段 | 类型 | 约定 |
| --- | --- | --- |
| id | UUID 字符串 | 后端生成的 Study ID |
| revision | 正整数 | 创建为 1，每次成功修改递增 |
| created_at | ISO 8601 字符串 | UTC，含时区 |
| updated_at | ISO 8601 字符串 | UTC，含时区 |

更新使用同样配置，加上 `base_revision`；id 放在 URL 中，不允许由请求覆盖所有者。版本不匹配返回 409，不得采用静默覆盖。

### 字段和行为规则

- name、instruction.text、survey.question 和每项 label 去除首尾空格后非空。
- 至少一个 block。Survey 原型至少两个选项；实际数量上限由团队确认。
- block.type 是 instruction / video / survey 的判别字段，建议 Pydantic 判别联合模型，不用无结构 dict。
- block 和 option 的 ID 由前端生成 UUID，排序不改变 ID；后端验证重复 ID。
- blocks 和 options 的数组顺序有意义，不再独立维护另一个可能冲突的 order 字段。
- randomization.mode：none / all / videos_only。本页面只配置，不计算随机结果。建议 videos_only 固定非视频位置，仅交换视频；正式执行语义需三人最终确认。
- 自定义图标优先于 default_icon；null 表示使用默认。左右按钮默认左侧点踩、右侧点赞。
- 关闭 response_buttons 时仍保留其文字/图标配置，执行端不显示。若保留了自定义图标，保存时仍验证引用有效。
- 允许返回上一块时，执行端为重复观看生成新的记录；不修改原始 block ID。视频响应不可改选、Survey 可改选的执行逻辑由 Engineer 2/3 配合实现。
- 实际实验运行应绑定保存时的配置版本或快照，后续编辑不能改变历史实验含义。

## 4. 文件上传约定

### 申请上传

请求示例：

```json
{
  "kind": "video",
  "filename": "attention-stimulus.webm",
  "mime_type": "video/webm",
  "size_bytes": 2400000
}
```

kind 为 video 或 button_icon。类型与体积上限由 Engineer 3 根据存储和目标平板能力确认；浏览器文件类型提示不属于安全验证。

建议响应：

```json
{
  "asset_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "upload_url": "https://storage.example/signed-upload",
  "method": "PUT",
  "headers": { "Content-Type": "video/webm" },
  "expires_at": "2026-10-16T16:30:00Z"
}
```

upload_url 为后端动态签发的地址，示例不可直接使用。method 和 headers 以存储服务实际要求返回，可约定 PUT 或 POST；前端不拼接存储地址，也不将业务 Bearer token 自动转发给存储域名。

上传请求体为文件二进制，按返回的 method/headers 发送。成功后调用 complete，body 可为空。建议完成响应：

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "kind": "video",
  "status": "ready",
  "filename": "attention-stimulus.webm",
  "mime_type": "video/webm",
  "size_bytes": 2400000
}
```

complete 必须由服务端验证对象，不能相信前端声称上传完成。未完成或未就绪的资源不可被 Study 引用。需耗时处理时可以返回 202，但须同时补充状态查询接口并与 Engineer 1 确认，不能悄悄改变为异步流程。

### 前端切换流程

1. 为每个 LocalMedia 申请上传凭证。
2. 上传文件并调用 complete。
3. 记录 `LocalMedia.id → asset_id` 映射。
4. 调用现有 `buildStudyPayload(draft, uploadedAssets)`。
5. 将得到的 StudyPayload 发给创建接口。
6. 只有创建响应成功，才显示云端保存成功；失败保留编辑内容。
7. 移除/关闭 demo 失败开关和模拟成功文案，区分上传中、保存中与错误。

适配函数遇到未上传资源会抛错，不会把 File、blob URL 或本地文件名伪装成资源 ID。现有本地预览 ready 状态仅代表浏览器可读取，不等于后端上传完成。

## 5. 失败响应与权限

建议统一业务错误结构：

```json
{
  "detail": {
    "code": "REVISION_CONFLICT",
    "message": "This study has changed. Reload before saving.",
    "current_revision": 4
  }
}
```

| 状态码 | 情况 | 前端行为 |
| --- | --- | --- |
| 401 | 未认证/凭证过期 | 提示重新认证，保留当前编辑 |
| 403 | 无操作权限 | 提示权限不足，不自动重试 |
| 404 | Study 或 Asset 不存在 | 显示资源不可用 |
| 409 | 版本冲突或资源未就绪 | 保留编辑，提示处理冲突或完成上传 |
| 413 | 文件过大 | 提示大小限制并重新选择 |
| 422 | 字段验证失败 | 显示字段错误 |
| 5xx / 网络失败 | 后端或网络错误 | 保留编辑并允许重试 |

422 可以保留 FastAPI 默认 detail 数组（loc / msg / type）。前端请求层统一转换：例如 loc 中的 blocks 索引映射到提交快照中的 block.id。不要假设所有错误的 detail 都是同一种形状。

后端需要验证资源所有者、研究者权限、资源用途和状态；数据库 secret key 只存在后端。配置本地前端 origin 的 CORS；不要以开放 CORS 代替认证。Storage 建议私有桶，通过受限凭证上传及读取。

创建请求建议支持 Idempotency-Key：同一次保存的网络重试沿用同一 key，避免“后端保存成功但响应丢失”产生重复实验；同 key 不同请求体应拒绝。对应前端重试行为需在接入时实现。

## 6. FastAPI Router 组织方式

建议增加以下文件，不修改现有点击测试接口：

```text
backend/app/routers/studies.py
backend/app/routers/assets.py
backend/app/schemas/study.py
backend/app/schemas/asset.py
backend/app/services/studies.py
backend/app/services/assets.py
```

以下仅为结构示例，引用的模型、认证依赖及 service 需要 Engineer 3 实现：

```python
from uuid import UUID
from fastapi import APIRouter, Depends
from app.auth import require_researcher
from app.schemas.study import StudyCreate, StudyUpdate, StudyRead
from app.services import studies

router = APIRouter(prefix="/api/v1/studies", tags=["studies"])

@router.post("", response_model=StudyRead, status_code=201)
def create_study(payload: StudyCreate, user=Depends(require_researcher)):
    return studies.create(payload, user)

@router.get("/{study_id}", response_model=StudyRead)
def read_study(study_id: UUID, user=Depends(require_researcher)):
    return studies.get(study_id, user)

@router.put("/{study_id}", response_model=StudyRead)
def update_study(
    study_id: UUID,
    payload: StudyUpdate,
    user=Depends(require_researcher),
):
    return studies.update(study_id, payload, user)
```

在 main.py 用 app.include_router 注册 studies 和 assets 的 router。StudyCreate 与前端 StudyPayload 对齐；StudyUpdate 增加 base_revision；StudyRead 增加第 3 节响应元数据。上例未展开 Idempotency-Key 和错误处理，正式实现需要补齐约定。

## 7. 最小联调验收

- 创建一个 Instructions 实验，GET 返回内容和顺序一致。
- 增加一个已完成上传的视频，保存后资源引用可由平板解析。
- Survey 选项和固定 ID 在保存、读取、排序后保持一致。
- 空名称、空 block 内容、重复 ID、未就绪或越权资源被拒绝。
- 保存失败时前端内容保留；同一次创建重试不产生重复实验。
- PUT 使用正确版本成功；旧版本返回 409。
- 未认证和无权限请求不能读写 Study/Asset。
- 提供 OpenAPI、脱敏请求/响应示例、迁移文件、后端测试及环境变量模板；不交付真实密钥。

页面仍处于 Mock 模式，以上真实接口及联调结果不得标记为已完成。

