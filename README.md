# 启蒙星球

启蒙星球是面向 3-7 岁儿童的幼小衔接 PWA 学习应用。新版结构去掉了每个板块下固定的“四层结构”，改为按学科特点组织任务：语文启蒙、拼音学习、数学基础、逻辑思维、英语启蒙、表达与阅读。

核心文案为“每天30分钟，轻松准备入学”。页面保留毛绒风格板块图标、家长视图、Edge / Microsoft 真人语音选择与语音开关。

## 本次重构内容

- 语文启蒙：识字、词语搭配、看图说话、简单句表达
- 拼音学习：声母、韵母、整体认读音节、拼读练习、发音跟读
- 数学基础：数字认知、数量比较、加减法入门、图形认知、规律排序
- 逻辑思维：找规律、分类、空间想象、图形推理、迷宫路径
- 英语启蒙：字母认知、常见单词、简单句型、自然拼读、听力磨耳朵
- 表达与阅读：绘本故事、看图讲述、情景问答、简单复述

## 答题交互

每个学习板块是一组连续题目。孩子选择答案后：

- 答对：选项和题卡显示绿色反馈，朗读鼓励语，等待 3 秒后自动进入下一题
- 答错：选项和题卡显示红色反馈，朗读提示语，孩子可以继续选择
- 每题可点击朗读按钮重听题目
- 顶部可选择系统中的 Edge / Microsoft 语音，也可以关闭语音

## 家长视图

家长视图展示学习过程中的基础数据：

- 星星数量
- 答对次数
- 需再练次数
- 学习时长
- 当前表现摘要

## 项目结构

```text
perschool/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── sw.js
├── data/
│   └── content.json
├── assets/
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-chinese.jpg
│   ├── icon-pinyin.jpg
│   ├── icon-math.jpg
│   ├── icon-logic.jpg
│   ├── icon-english.jpg
│   └── icon-science.jpg
└── README.md
```

## 本地运行

```bash
cd E:\learn-git\perschool
python -m http.server 5173
```

浏览器打开：

```text
http://localhost:5173/
```

如果浏览器仍显示旧版页面，请清理站点缓存或使用带版本参数的地址：

```text
http://localhost:5173/?v=subject-v3
```

## 内容编辑

课程内容集中在 `data/content.json`。每个板块使用以下结构：

```json
{
  "id": "chinese",
  "name": "语文启蒙",
  "icon": "icon-chinese.jpg",
  "description": "板块说明",
  "topics": ["识字", "词语搭配"],
  "questions": [
    {
      "topic": "识字",
      "title": "题目标题",
      "visualEmoji": "☀️",
      "visualText": "图片提示",
      "prompt": "题目文案",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "tts": "朗读文案",
      "success": "答对提示",
      "hint": "答错提示"
    }
  ]
}
```

英语题目可以增加 `"lang": "en-US"`，朗读时会优先选择英文语音。

## 部署

项目是纯前端 PWA，无需构建步骤。推送到 GitHub 后可使用 GitHub Pages 部署。每次更新核心文件后，建议同步更新 `sw.js` 中的 `CACHE_NAME`，避免用户端继续读取旧缓存。
