# GetLink - 网页链接识别助手

一个 Tampermonkey / 油猴脚本，用于识别网页上的 magnet/http 链接，并进行后续操作。

## 主要功能

- 自动轻量识别网页中的 magnet 链接
- 右键菜单增强：选中文字、右键链接、右键附近区域自动查找链接
- 添加 magnet/http 链接到 115 云下载
- 任务状态记忆：已添加、已存在、失败等状态会保留
- 深色模式 / 跟随系统
- 上下文名称识别与资源标签识别
- Base32 / Hex BTIH 去重
- 克制启动，不常驻 MutationObserver，尽量不影响普通网页

## 安装

安装地址：

```txt
https://raw.githubusercontent.com/ZERONE2077/GetLink/main/115.user.js
```

在 Tampermonkey 中通过 URL 安装，或打开上述 raw 地址后按提示安装。

## 注意

- 脚本默认排除 115、抖音、TikTok。
- 脚本只在顶层页面运行，避免 iframe 重复注入。
- 添加到 115 需要当前浏览器已登录 115。

## License

MIT