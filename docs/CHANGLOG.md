
#### 2024-08-25

记录下最新官方安卓 app 的重大变更,`emby-android-google-arm64-v8a-release-3.4.20.apk`开始貌似修改`index.html`方式失效了,区别在于之前的版本客户端是不会请求`Emby 服务端`的任何代码上的静态资源,如`html` `js` , 除服务端的自定义 Css 以外的任何`css`文件,官方为了分担服务端压力,之前除`Web`端以外的任何客户端都是安装包中内置了前端代码,而目前客户端版本,服务端竟然发现也有来自安卓客户端的`index.html`请求,我的 emby 加了 nginx 反代,access.log 如下

```js
192.168.31.1 - - [25/Aug/2024:02:35:10 +0800] "GET /emby/system/info/public?format=json HTTP/2.0" 200 127 "-" "okhttp/4.11.0" "-"
192.168.31.1 - - [25/Aug/2024:02:35:10 +0800] "GET /emby/Sync/Items/Ready?TargetId=71c169d19a95c29b HTTP/2.0" 200 2 "-" "okhttp/4.11.0" "-"
192.168.31.1 - - [25/Aug/2024:02:35:10 +0800] "POST /emby/Sync/data HTTP/2.0" 200 22 "-" "okhttp/4.11.0" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/system/info/public HTTP/2.0" 200 127 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/web/manifest.json HTTP/2.0" 200 341 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/web/strings/en-US.json HTTP/2.0" 200 15989 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/web/index.html HTTP/2.0" 200 3542 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/System/Info?api_key=xxx HTTP/2.0" 200 787 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
192.168.31.1 - - [25/Aug/2024:02:35:11 +0800] "GET /emby/DisplayPreferences/usersettings?userId=ac0d220d548f43bbb73cf9b44b2ddf0e&client=emby&X-Emby-Client=Emby+for+Android&X-Emby-Device-Name=2311DRK48C&X-Emby-Device-Id=71c169d19a95c29b&X-Emby-Client-Version=3.4.20&X-Emby-Token=xxx&X-Emby-Language=zh-cn HTTP/2.0" 200 1126 "-" "Mozilla/5.0 (Linux; Android 14; 2311DRK48C Build/UP1A.230905.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36" "-"
```

根据此日志,可能会认为需要修改服务端`index.html`,但是实测结果为,同时修改了安卓客户端和服务端的`index.html`均无用,
这里猜测可能是`index.html`中原本的`<script src="apploader.js" defer></script>`行为发生了变化,在之前的版本中如果我没记错的话,这一行是动态渲染内容,加载时会替换为一大堆的`html`标签,从而覆盖掉了自定义添加的代码,时间有些久远了,不确实是覆盖之前还是之后的来着,反正目前通过实测结果,前后都没用,

```js
...
    <script src="apploader.js" defer></script>
    <script src="https://cdn.jsdelivr.net/gh/chen3861229/dd-danmaku@new-ui/ede.js" defer></script>
</body>
```
```js
...
    <script src="https://cdn.jsdelivr.net/gh/chen3861229/dd-danmaku@new-ui/ede.js" defer></script>
    <script src="apploader.js" defer></script>
</body>
```

因首先测试过了,[CustomCssJS](https://github.com/Shurelol/Emby.CustomCssJS) 加载的方式是没问题的,偷个小懒,暂时不研究原始的这种方式引入了,因为感觉引入此用户脚本加载器更加优雅和易用

这里分享下修改版的文件,

1.官方原版,`3.4.20`
https://github.com/MediaBrowser/Emby.Releases/raw/master/android/emby-android-google-arm64-v8a-release.apk

2.[OneDrive](https://1drv.ms/f/s!Av7h6c_xLEsg0ogfmU2UsZUZa59uvQ?e=l9UP7R),基于官方原版的[CustomCssJS](https://github.com/Shurelol/Emby.CustomCssJS) 集成,解包修改自签名:`emby-android-google-arm64-v8a-release-3.4.20-CustomCssJSv23.6.14-MTself-sign.apk`,解包修改未签名: `emby-android-google-arm64-v8a-release-3.4.20-CustomCssJSv23.6.14-unsigned.apk`

3.基于官方原版的仅添加,如上说明,这个版本无法使用
```js
...
    <script src="apploader.js" defer></script>
    <script src="https://cdn.jsdelivr.net/gh/chen3861229/dd-danmaku@new-ui/ede.js" defer></script>
</body>
```
`emby-android-google-arm64-v8a-release-3.4.20-emby-danmaku-MTself-sign.apk`, `emby-android-google-arm64-v8a-release-3.4.20-emby-danmaku-unsigned.apk`

4.未签名版是无法安装的,仅供`MT管理器`自签名后分享无法安装使用的这种可能,然后自己用未签名版本想办法自签名安装到自己的设备中

这里再记录下解包和打包命令,解包中的`-s`跳过了`DEX`的处理,会快很多,因为本次用不着修改这部分源代码
```
java -jar -Duser.language=zh_cn -Dfile.encoding=UTF-8 apktool_2.9.3.jar d -s c:\Users\XXX\Downloads\Compressed\emby-android-google-arm64-v8a-release-3.4.20.apk
```
```
java -jar -Duser.language=zh_cn -Dfile.encoding=UTF-8 apktool_2.9.3.jar b c:\Users\XXX\Downloads\Compressed\emby-android-google-arm64-v8a-release-3.4.20 -o emby-android-google-arm64-v8a-release-3.4.20-unsigned.apk
```

`3.4.20` 与老版本一些 NewUI 的小差异截图,因为弹窗`dialog`用的 emby 的样式,所以形式具体取决于客户端版本了
![IMG_20240825_040505](https://github.com/user-attachments/assets/132be6b9-e9bc-42f7-bb4a-738d9c44dd27)

![Screenshot_2024-08-25-03-43-51-654_com mb android](https://github.com/user-attachments/assets/f38003b7-0bca-4b7a-adc6-a71d45f84afb)

![Screenshot_2024-08-25-03-44-08-805_com mb android](https://github.com/user-attachments/assets/bd299bb2-6dc8-430d-b30f-f89f66cd5c86)

![Screenshot_2024-08-25-03-44-43-855_com mb android](https://github.com/user-attachments/assets/a578aedf-9f34-47da-9811-ad5cb8c03761)

![Screenshot_2024-08-25-03-45-06-515_com mb android](https://github.com/user-attachments/assets/12d158fb-f283-4f44-affe-efabeff7c5fb)


#### 2024-05-24 以来

1.合并参照了 PR,感谢他们,

https://github.com/9channel/dd-danmaku/pull/53
https://github.com/9channel/dd-danmaku/pull/55
https://github.com/9channel/dd-danmaku/pull/62

2.移除了初始化阶段的~~所有~~部分轮询等待,改用 embyCustomEvent 提升性能,这个是 2017 年很老的 api 了,属于 Emby 还未分家,所以 Jellyfin 也是可以使用的

3.弹幕大小初始化计算的时候改为客户端本身计算后的播放界面媒体 h3 次标题名称大小

4.移除了最外层的特定 emby 版本和品牌判断方法

5.兼容特殊情况的依赖加载,例如其他类型的脚本加载器[CustomCssJS](https://github.com/Shurelol/Emby.CustomCssJS)会使用 eval 执行代码,不会报错但会导致后续 emby 自己的代码加载失败

6.精确化弹幕按钮容器定位的目标并删除了 getElementsByInnerText 函数

~~7.添加了 getEmbyItemInfo from pluginManager null 情况的补偿措施,后发现安卓为 NativePlayer ,故此措施治标不治本但留作 failback 使用~~

7.验证 getEmbyItemInfo from pluginManager null 是预期情况,已还原更改

~~8.添加了对 JellyfinWeb 的支持(只测试了 10.8.3 和 10.9.6),不完美的地方有必须点进一次详情页才能获取到 itemId ,还有是图标为方块,不清楚图标该如何更改,改完才发现历史 issus 中有其他人维护的 fork , 但因为只改了几个元素选择器,变化不大,所以还是提交了~~

8.移除了过时的 Jellyfin 兼容实现,未换用新设置弹框 UI 之前本身存在上述不完美地方,新 UI 中存在部分 emby 特有的由 ../web/modules/alameda/alameda.js 暴露至 window 全局对象中的 require 方法,故已无法兼容 Jellyfin,且有 @Izumiko 维护的更完美分支,
https://github.com/Izumiko/jellyfin-danmaku

~~9.使用篡改猴环境发现弹幕被砍头了,但 CustomCssJS 环境和服务端引入环境是没问题的,这个 bug 在 8 和 3 的修改前貌似就存在了,因后端对 css 不太在行,暂时不知道如何修复~~
![2a0e3fbe03a3e99468b1cab7036b4877](https://github.com/9channel/dd-danmaku/assets/42368856/7d26ab96-e4b5-43cf-b85f-cf418fe0e96f)

9.升级内置依赖的 1.3.6 版本之前的到最新的 2.0.6,解决弹幕行高显示 bug 出现被砍头现象,参考来源,
https://github.com/weizhenye/Danmaku/issues/29
,可关闭 [#61](https://github.com/9channel/dd-danmaku/issues/61)

10.兼容了魔改版客户端的 NativePlayer 播放形式,使用 initH5VideoAdapter 适配器转换至虚拟video标签行为和事件,此行为仅在非 web 客户端的非video标签播放形式下工作,其余与之前相同,
不确定能否关闭,https://github.com/9channel/dd-danmaku/issues/23

https://github.com/9channel/dd-danmaku/pull/60/commits/ab17598591ac228e9a7febd2839f4e9d2e14a6a6
https://github.com/9channel/dd-danmaku/pull/60/commits/8f278e0c0def1807a7f07b1ef67ac748506d0b80

10.1 更改了 5 中默认的相对路径依赖地址改为 jsdelivr 网络 CDN 地址,以实现该特性,假如长时间后该地址访问不佳,可将依赖文件放置在 emby 服务的 /system/dashboard-ui/ 下,变量地址填写前缀为 https://your-emby-domain/web/

10.2 更改了 getEmbyItemInfo 中默认的 pluginManager 为通用性更强的 playbackManager,原因为 pluginManager 众多第三方魔改版不统一,已知有 htmlvideoplayer, exoplayer, mpvvideoplayer... 所有 pluginPlayer 都要统一对接 playbackManager

~~10.3 已知 bug,小概率下记忆进度开始播放的,弹幕时间轴错乱,需要手动暂停再播放,Emby Theater 魔改版内置的 libmpv 没有实现跳转进度的标准事件通知,所以同样需要手动暂停再播放~~

10.4 此处记录下仅测试过的客户端类型,Emby Web 三种加载模式都通过,index.html 服务端引入或浏览器篡改猴拓展或CustomCssJS,Emby Theater 和 Emby for Android 仅测试了第三方客户端内置的 CustomCssJS,没问题,服务端版本为最新稳定版 4.8.8.0

~~10.5 已知 bug, Emby Theater 的 Electron 不支持 prompt 原生的对话框,所以手动搜索功能是废的,有其它合作者在进行修复中,Emby for Android 可以用 prompt 对话框就很离谱~~

10.5 已有合作者通过 embyDialog 修复实现,后续一些设置项可以新增到弹框中比较灵活
https://github.com/9channel/dd-danmaku/pull/60/commits/ea75168afd31ddde986f4b2c1b093fce7fccff9d

~~10.6 NativePlayer 下,存在一个性能问题,因 timeupdate 事件是每秒进行汇报同步,目前夏天导致带壳手机发热相比之前更大,可选优化空间感觉只有增大 video.currentTime 的同步赋值间隔,例如提供一个非 UI 更改的内部设置变量,currentTimeSyncInterval = 5000 来降低负载,但可能会导致弹幕时间轴与实际 NativePlayer 的差异变大,暂未对比测试~~

~~10.6 经过分析,拉长同步 video.currentTime 间隔并不能减少回调次数,反而会多出 if 逻辑判断增大负担,再次可选优化方向为妥协方案,仅在暂停播放后同步一次~~

10.6 为解决虚拟适配器下`播放进度`不够精确的问题,之前为秒级回调,导致了初始处弹幕存在闪现问题,且`播放倍率`无法同步,在 https://github.com/9channel/dd-danmaku/pull/60/commits/ce8bf6260a30af570e3007a199a5e24cceb185cd,
中通过本地定时器模拟补全秒级中空缺间隔的百毫秒级精度同步,经过分析,仅同步变量值不会带来明显性能增加,设备发热大端在客户端本身的视频解码上,故不用再纠结发热问题

11.交换了弹幕开关图标的顺序以更符合直觉

12.重命名原始功能过滤等级的描述以更贴合实际含义

13.新增弹幕基准速度调整,时间轴偏移秒数调整

14.重构抽取部分重复性代码,可关闭 https://github.com/9channel/dd-danmaku/issues/22
,这个在之前别人的 PR 中已经有,不过位于 develop 分支中,https://github.com/9channel/dd-danmaku/pull/47

15.在搜索图标点击后弹框中添加了当前弹幕信息展示以应对安卓环境的兼容

16.在弹框中添加了过滤弹幕类型选项['底部弹幕', '顶部弹幕', '从左至右', '彩色弹幕'],
可以关闭,https://github.com/9channel/dd-danmaku/issues/58

17.在弹框中添加了切换弹幕引擎设置['canvas', 'dom']

18.修复返回再播放的弹幕按钮消失 bug,
https://github.com/9channel/dd-danmaku/pull/60#issuecomment-2255005780

19.恢复 initUI 的延时处理,改为 setTimeout 一次性行为,~~移除了 initListener 方法,以解决 viewshow 监听会导致弹幕下载接口请求两次的 bug~~,
恢复 initListener 方法以修复新引发的播放界面切换集数没重载弹幕的 bug,注释初始化阶段的 loadDanmaku(LOAD_TYPE.INIT); ,全部由 initListener 进行触发,
目前减少为一次,添加 beforeDestroy 进行一些简单的事后清理工作

20.添加一个 embyToast 简单封装,为避免过度打扰用户,暂时只加了几处消息提醒,经测试,Emby Theater 和 Emby for Android 在  NativePlayer 播放器环境下不会显示此提醒,疑似被播放画面遮挡或魔改客户端禁用了 Toast 层,服务端的设备控制中的通知消息也是无法在 NativePlayer 播放页面中显示

21.添加一个剧集自动匹配失败转为使用原标题搜索弹幕的处理,并修复自动匹配失败报错导致的 VM 停止问题,出处:
https://github.com/Izumiko/jellyfin-danmaku/blob/jellyfin/ede.js#L886

22.添加弹幕高度比例调整,参考自 @Izumiko ,感谢

23.添加弹幕来源显示和过滤,添加两处作品图片信息

24.由合作者 @ykchenc 实现 feat: 添加屏蔽关键词过滤弹幕,https://github.com/9channel/dd-danmaku/pull/60/commits/ff357e3d98ed3ec1c430fe91c828fb804c850083
,目前为文本域输入可填关键词和正则,~~只支持过滤弹幕正文内容,~~
已支持过滤`弹幕正文`,`来源cid`,`来源平台`,`来源平台用户id`,
根据 https://github.com/9channel/dd-danmaku/issues/13 ,可选优化方向为 HTTP 方式的文本内容下载和上传,不太建议文件方式导入屏蔽列表,可能存在 Emby Theater 或 TV 客户端弹不出文件选取框的问题,故优先考虑 HTTP 方式存取来实现比较合适

24.1 测试发现弹弹Play平台或源弹幕平台存在一个云端过滤的行为,但是存在一定时间的延迟,例如 B站 刚更新的有 6K+ 弹幕,但是其中 2K+ 甚至更多为开始和结尾的打卡重复弹幕,此时会遮盖所有显示画面,需手动结合屏蔽设置,第二天就只剩下 1700 多条了,可酌情手动关闭部分屏蔽设置

24.2 屏蔽关键词添加一个特定单行注释的兼容,必须以`双斜杠和一个空格开头`,例如: `// 以下按用户id过滤`

25.添加简单弹幕列表展示,添加简版设置手动备份(复制/粘贴 JSON 文本)

26.New UI 添加 AppLogAspect 展示控制台日志,包含 emby 自身打印的日志 + 脚本打印的日志 + 未捕获处理的 error,
起始切点位于播放页面开始,离开播放页销毁切面,即清空了日志,因日志文本太长,故不做持久化处理,仅供调试信息使用,调用 window.ede.appLogAspect.on 日志变更监听回调的,禁止在回调中使用原始的 `console.log` 和 `console.error` 再次打印日志,因切面重写了这两个方法,回调中使用会`死循环`,回调中会检测这种并抛出异常,正确打印方式为调用 `window.ede.appLogAspect.originalLog` 和 `window.ede.appLogAspect.originalError`

27.关于 tab 中添加几个简单的调试选项,这类选项不重要,所以不做持久化增添复杂度了,调整完弹幕容器大小,切换 tab 后发现显示`按钮容器边界`重回未勾选状态属于正常行为,重新开关即可

New UI Web 端示意图:
![image](https://github.com/user-attachments/assets/b9d875b1-9d37-4188-8939-319c1336848a)
![image](https://github.com/user-attachments/assets/64fd5108-ba88-4611-bdea-3de0de83627c)
![image](https://github.com/user-attachments/assets/4c133f68-4fd5-4fa0-9153-9cb8f60b7c9f)
![image](https://github.com/user-attachments/assets/d0a8a516-7cbc-4ffe-b03d-bfca788e1730)

