# 👑 数王荣耀 - 小学数学课堂实时反馈系统

## 项目简介

**数王荣耀**是一款专为小学数学课堂设计的实时反馈系统，支持教师发布题目、学生即时提交答案、理解程度统计以及 AI 辅助分析。适用于 Windows 局域网环境，无需公网连接。

### 适用场景

- 小学数学课堂随堂练习
- 实时掌握全班理解程度
- AI 辅助分析常见错误
- 备课-上课一体化流程

## 下载地址

免安装版（Windows exe）下载：

👉 [https://github.com/shuyonga/class/releases/latest](https://github.com/shuyonga/class/releases/latest)

下载 `数王荣耀.exe`（文件名为 `shuyonga-class.exe`）后双击即可运行，无需单独安装 Python。

## 支持的 AI 模型

系统支持在「模型配置」页面同时配置最多 5 个模型，任选其一启用：

| 模型 | Base URL 示例 | 说明 |
|------|--------------|------|
| DeepSeek | `https://api.deepseek.com` | 推理能力强，响应较快 |
| MiniMax | `https://api.minimaxi.com/v1` | 国内访问稳定 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | GLM-4 系列 |
| 豆包（字节） | `https://ark.cn-beijing.volces.com/api/v3` | 火山方舟接入 |
| Kimi（月之暗面） | `https://api.moonshot.cn/v1` | 长上下文 |

> 本项目仅接入国内 AI 模型，不使用任何境外模型。

## 克隆仓库后配置步骤（开发者）

```bash
git clone https://github.com/shuyonga/class.git
cd class
copy config.example.json config.json
```

然后编辑 `config.json`，在对应模型的 `api_key` 字段填入自己申请的 Key，并把该模型的 `enabled` 设为 `true`。

> `config.json` 已在 `.gitignore` 中，不会被提交到仓库，API Key 不会泄露。

## 安装依赖（源码运行）

```bash
pip install flask requests qrcode[pil]
```

## 启动命令

```bash
python app.py
```

启动后程序会：
1. 自动获取局域网 IP 地址
2. 生成学生端二维码图片
3. 自动打开默认浏览器访问教师端页面
4. 在控制台打印访问地址

## 各页面地址及用途

| 页面 | 地址 | 用途 |
|------|------|------|
| 学生端 | `http://{IP}:5050/student` | 学生平板访问，提交答案与理解程度 |
| 教师大屏端 | `http://{IP}:5050/teacher` | 希沃大屏使用，整合备课与上课功能，通过 Tab 切换 |
| 模型配置 | `http://{IP}:5050/config` | 设置 AI 模型的 API Key 及参数 |

## 首次使用流程

1. **配置模型**：在「模型配置」页面填写至少一个 AI 模型的完整信息（API Key、Base URL、Model Identifier）并勾选启用，然后保存
2. **创建题目包**：在教师端「备课模式」Tab 中，输入题目包名称，点击「新建」，逐题添加题目后保存
3. **上课使用**：切换到「上课模式」Tab，选择已保存的题目包并加载，点击题目旁的「发布」按钮发布当前题目
4. **学生提交**：学生通过平板访问学生端（或扫描二维码），输入答案和选择理解程度后提交
5. **查看统计**：教师端右侧展示区实时显示理解程度统计和学生答案
6. **AI 分析**：选择已配置的模型后点击「AI分析」，获取智能分析结果

## Windows 打包说明

1. 将整个项目文件夹拷贝到 Windows 电脑
2. 双击 `build_windows.bat` 等待自动安装依赖并打包
3. 打包完成后在 `dist` 文件夹中找到 `数王荣耀.exe`
4. 将 `dist/数王荣耀.exe` 复制到项目根目录（或任意位置），双击即可运行
5. 程序会自动创建缺失的 `data/` 和 `questions/` 目录

## 注意事项

- 用户可写数据（配置、题库、存档）均保存在 exe 同级目录
- 迁移 exe 时需一同迁移 `config.json`、`data/` 和 `questions/` 文件夹
- 默认端口为 5050，若被占用会自动尝试 5051-5054
- 学生端适配平板横屏/竖屏，按钮和文字使用大号尺寸
