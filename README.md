简体中文 / [English](./README_en.md)
# 我Vercel又复活啦!!!!!! 已支持流式响应!!!!!! 
# 并发这次也确实提高了, 之前确实测得不准，这次真够用了
#### 测试接口: [https://testgpt.iqaq.me/](https://testgpt.iqaq.me/)
### ChatGPT Next Web 测试: 
#### 在线体验: [https://chat.iqaq.me/](https://chat.iqaq.me/)
当然这么长的回复10s肯定发不完
![Stream](./img/Stream.gif)
#### 依然存在的问题
- 超过10s之后会断流。(因为Vercel免费版持续时间最大值10秒，因此使用沉浸式翻译记得降低`最大文本长度`到600左右，并发30)。
- 向OpenAI请求的token的刷新依靠的是定时任务，免费用户一天只给用一次...
#### 解决办法:
Vercel Pro 计划 超时上限为300s，并且自带cron计划任务[跳转Pro部署介绍](#3-vercel-pro-计划的尊贵用户移除请求最大持续时间10s上限)
否则定时任务可通过[cron-job](https://console.cron-job.org/)或`Uptime Kuma`等定期(每2-4分钟)调用`https://你的域名/api/cron`

---------------------
## Vercel部署按钮 
**不推荐，无法同步更新**, ~~并且新版需要数据库了，点了也还需要配置数据库步骤~~ **该按钮目前已经包含了`Vercel KV`数据库**，免费计划仅需配一下[cron-job](https://console.cron-job.org/)，看下面部署 方式一: 第八条

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcliouo%2FFreeGPT35-Vercel&skippable-integrations=1&stores=[{"type":"kv"}])



--------------------

## 部署项目
#### 以下均建议绑定自定义域名解决Vercel域名被阻断问题
### 方式一: 结合 [Vercel](https://vercel.com/) 的`KV`数据库部署 (kv数据库每天只有3k次、每月30k次访问，仅够个人低频率使用)
1. fork 本仓库，fork时，取消勾选 `Copy the main branch only`
2. 进入Vercel，导入您fork的仓库
3. 点击`Deploy`，等待部署完成
4. 进入`Storage`选项卡，创建一个`KV`数据库，`Database Name`随便起，`Primary Region`区域推荐选`San Francisco`，点击`Create`
5. 务必确认`kv`数据库的`Projects`选项卡连接了你的项目
6. (可选) 在`Settings`的`Domains`下绑定你自己的域名。
7. 转到顶部`Deployments`选项卡，`Redeploy`重新部署你的项目

8. (免费计划用户)到[cron-job](https://console.cron-job.org/)创建一个定时访问刷新token的任务，填上`https://你的域名/api/cron`，选个每两分钟，`Create`就好了，有其他类似Uptime Kuma也一样。
![Cron](./img/cron.png)
9. 完成! 鼓掌，第一次部署完建议手动访问一下`https://你的域名/api/cron`刷新token

--------------------

### 方式二: 结合 [Upstash](https://upstash.com/) 的`Redis`数据库部署 (每天10k次访问) 推荐!
[官方文档](https://upstash.com/docs/redis/overall/getstarted)
1. 跳转到`Upstash`创建并登录您的账户，创建一个`Redis`数据库
2. `Region` 推荐选 `California, USA`，`Eviction`勾选，然后创建
![Create Database](./img/2db.png)
3. 注意`UPSTASH_REDIS_REST_URL`和`UPSTASH_REDIS_REST_TOKEN`，等下要复制这两对数据名和数据的值，这两对数据等下要在`Vercel`的`Environment Variables`里填入
![Upstash API](./img/3upstashapi.png)
4. fork 本仓库，fork时，取消勾选 `Copy the main branch only`
5. 在vercel中导入您fork的仓库
6. 在 `Environment Variables` 输入框中填入 第3步 的两对数据
![Environment Variables](./img/environment.png)
7. 点击`Deploy`
8. (可选) 在`Settings`的`Domains`下绑定你自己的域名。
9. 转到顶部`Deployments`选项卡，`Redeploy`重新部署你的项目
10. (同上 8. 免费计划用户需要设置cron-job.org定时任务)
11. 完成! 鼓掌，第一次部署完建议手动访问一下`https://你的域名/api/cron`刷新token

--------------------

### 方式三: `Vercel Pro` 计划的尊贵用户，移除请求最大持续时间10s上限，自带cron定时任务
1. 前几步部署和上述两种计划相同，按需选择，并且不需要设置cron计划任务了
2. 只需在最后`Redeploy`重新部署前，到`Settings`下的`Git`页面，在`Production Branch`填入`vercel-pro`点击`Save`
![guide](./img/guide.png)
3. 然后转到顶部`Deployments`选项卡，注意不要在下面已经部署的记录里选!!!，点击如图右上角的三个点 `Create Deployment`选择`vercel-pro`然后`Create Deployment`
![deploy](./img/6deploy.png)
4. 完成! 鼓掌，第一次部署完建议手动访问一下`https://你的域名/api/cron`刷新token

--------------------

## 请求示例

**如果你没有设置`AUTH_TOKEN`，你可以不传递`Authorization`，也可以随意传递任何字符串。**

```bash
curl https://[Your Vercel Domain]/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any_string_you_like" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ],
    "stream": true
    }'
```
## 高级设置
### 环境变量 (如果你不知道是干嘛的，请不要随意设置)

| Key                       | Value                         | 解释                                          | 要求  |
|---------------------------|-------------------------------|-----------------------------------------------|-------|
| `AUTH_TOKEN`              | You_set_the_apikey_yourself.  | 你为自己接口设置的apikey。                      | 可选  |
| `UPSTASH_REDIS_REST_URL`  | Your_Upstash_URL              | 你的Upstash Redis数据库的URL                   | 可选   |
| `UPSTASH_REDIS_REST_TOKEN`| Your_Upstash_Token            | 你的Upstash Redis数据库的Token                 | 可选   |
### 并发调整
默认定时4分钟更新16个token，token决定并发，一般绝对够用了，如需上调要考虑能在10s请求时间上限内刷新完token (Pro用户可自行规划)
## 兼容性

您可以在任何客户端中使用它，如 `OpenCat`、`Next-Chat`、`Lobe-Chat`、`Bob` 等。在**API Key**中随意填写任何字符串或者你设置了`AUTH_TOKEN`，就填写它。

### Bob
![Bob](./img/bob.png)

## Credits
- Forked From: [https://github.com/missuo/FreeGPT35](https://github.com/missuo/FreeGPT35)
- Higher Upstream: [https://github.com/skzhengkai/free-chatgpt-api](https://github.com/skzhengkai/free-chatgpt-api)
- Original Author: [https://github.com/PawanOsman/ChatGPT](https://github.com/PawanOsman/ChatGPT)
## Similar Project

- [aurora](https://github.com/aurora-develop/aurora): Golang development, support for multiple deployment methods
## License
AGPL 3.0 License
