# 留下来的碳

[English](README.md) · [Italiano](README.it.md) · [Español](README.es.md) ·
[Français](README.fr.md) · **中文**

一个关于全球碳平衡的单页网站：我们排放了多少二氧化碳，海洋和植被吸收了多少，
以及为什么莫纳罗亚曲线上只看得到其中一半。

**→ [co2-info.duckdns.org](https://co2-info.duckdns.org/)** —— 根地址是英文，另有
[意大利文](https://co2-info.duckdns.org/it/)、
[西班牙文](https://co2-info.duckdns.org/es/)、
[法文](https://co2-info.duckdns.org/fr/)和
[中文](https://co2-info.duckdns.org/zh/)版本

它最初是为了核查一份已有的演示稿，最后取而代之。每一个数字都附有来源和不确定度。

## 它有什么不一样

- **它自己去取数据。** 二氧化碳曲线、增长率、温度序列和海洋积累的热量，每次加载
  都从 NOAA 读取。
  如果网络不通，页面会显示写在 HTML 里的备用数值，并用一个彩色圆点如实说明，
  而不是假装无事发生。
- **每张图都标明它展示的是哪一类数字**：`实测`、`实测与估算`、`估算`、
  `初步估算`。测量值和模型结果不是一回事，本页不会把它们混为一谈。
- **它在公开场合自我纠正。** 页面底部的修订记录列出了改了什么、为什么改，
  包括本页自己出错的那些次。
- **无需编译即可托管，没有 Cookie，除字体和访问统计外没有第三方请求。**
  十六屏、十五节、九张以内联 SVG 绘制的图表。

## 参与贡献

这才是有用的部分。如果你发现：

- **某个数字有误** —— 这是最有价值的反馈：那份修订记录正是这样积累起来的；
- **更好的资料来源**，或者已用来源的更新版本；
- **某句话说得超出了数据所能支撑的范围** —— 本页力图避免，但并非每次都做到；
- 某处译文在你的语言里读起来别扭；

请[提一个 issue](https://github.com/postadelmaga/carbonio/issues)；如果你不想注册
GitHub 账号，也可以在[留言板](https://co2-info.duckdns.org/feedback.html)上写。
每一节下面还有两个问题——「有用吗？」和「清楚吗？」——这是告诉我哪里出问题最省力的
办法。当然也欢迎直接提交修改。两条规矩：绝不从文章里转抄数字，要回到原始来源；如果你改动了意大利文
正文，请重新生成译文（`./build.py --extract`、翻译、`./build.py`）。

## 它是怎么做的

手写的 HTML、CSS 和 JavaScript。没有框架，没有依赖，托管它不需要任何编译步骤。

```
.
├── index.html          页面本体，意大利文：唯一手写的版本
├── it/ en/ es/ fr/ zh/     生成的页面：请勿手动修改。
│                        en/ 发布在根地址，而不是 /en/
├── i18n/               每种语言一个词典 + 抽取出来的键
├── build.py            从意大利文原文生成译文页面
├── publish.sh          已填好目标路径和公开网址的 deploy.sh
├── deploy.sh           通过 rsync/ssh 发布
├── 404.html  robots.txt
└── assets/
    ├── style.css       明暗主题变量、版式、打印样式
    ├── charts.js       九张 SVG 图表 + 内嵌的备用数据
    ├── slides.js       幻灯片式导航：屏上箭头、键盘、触摸
    ├── live.js         从 NOAA 实时读取，并带后备方案
    └── favicon.svg
```

```bash
python3 -m http.server 8100     # 然后打开 http://localhost:8100
./build.py                      # 重新生成 it/、en/、es/、fr/、zh/
./publish.sh --apply            # 发布
```

更多细节——每个数字从哪里来、翻译流程如何运作、服务器如何选择语言、测试过又被
放弃的方案——都在 **[MAINTENANCE.md](MAINTENANCE.md)**（英文）。

## 资料来源

- **全球碳预算 2025**（全球碳计划，COP30，2025 年 11 月 13 日）—— 源与汇，2015–2024 年平均
- **NOAA 全球监测实验室** —— 1958 年以来的莫纳罗亚序列与全球平均，实时读取
- **NOAA 古气候学** —— Bereiter 等 2015，南极冰芯 80 万年的二氧化碳
- **IPCC AR6** —— 古气候参照时期；温室气体的工业化前水平
- **Our World in Data** —— 各国、人均与累计排放
- **联合国环境规划署《排放差距报告 2025》** —— 全球温室气体总量
- 关于军队与战争：SGR 与 CEOBS；Initiative on GHG Accounting of War；
  Neimark 等发表于 One Earth；Climate and Community Institute

全页统一使用的换算：`1 ppm = 2.124 GtC = 7.78 GtCO₂`，`1 GtC = 3.664 GtCO₂`。

## 许可协议

- **代码** —— [MIT](LICENSE)：`assets/*.js`、`style.css`、`build.py`、发布脚本
  以及 HTML 结构。
- **文字、图表与译文** —— [CC BY 4.0][cc]：可以再使用、改编，也可以用于商业用途，
  只有一个条件：说明它们的出处，以及你是否做过改动。
- **数据不属于我们。** 它们属于 NOAA、全球碳计划、Our World in Data、IPCC、
  联合国环境规划署，以及页面中引用的各研究团队。请引用原始来源，而不是这个仓库。

细节见 [LICENSE-CONTENT.md](LICENSE-CONTENT.md)。

[cc]: https://creativecommons.org/licenses/by/4.0/deed.zh
