// ==UserScript==
// @name         Emby danmaku extension
// @description  Emby弹幕插件
// @namespace    https://github.com/RyoLee
// @author       RyoLee
// @version      1.34
// @copyright    2022, RyoLee (https://github.com/RyoLee)
// @license      MIT; https://raw.githubusercontent.com/RyoLee/emby-danmaku/master/LICENSE
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @updateURL    https://cdn.jsdelivr.net/gh/RyoLee/emby-danmaku@gh-pages/ede.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/RyoLee/emby-danmaku@gh-pages/ede.user.js
// @grant        none
// @match        */web/index.html
// @match        */web/
// ==/UserScript==

(async function () {
    'use strict';
    // ------ 用户配置 start ------
    // Danmaku 依赖路径,index.html 引入的和篡改猴环境不用填,依赖已内置,被 CustomCssJS 执行的特殊环境下使用,支持相对绝对网络路径
    // 默认是相对路径等同 https://emby/web/ 和 /system/dashboard-ui/ ,非浏览器客户端必须使用网络路径
    // const requireDanmakuPath = 'https://fastly.jsdelivr.net/gh/weizhenye/danmaku@2.0.6/dist/danmaku.min.js';
    const requireDanmakuPath = 'https://cdn.jsdelivr.net/gh/lanytcc/Danmaku@v1.2.0/dist/danmaku.min.js';
    // 跨域代理 cf_worker
    // const corsProxy = 'https://api.9-ch.com/cors/';
    const corsProxy = 'https://ddplay-api.7o7o.cc/cors/';
    // ------ 用户配置 end ------
    // ------ 程序内部使用,请勿更改 start ------
    const openSouceLicense = {
        self: { version: '1.34', name: 'Emby Danmaku Extension(Based on 1.11)', license: 'MIT License', url: 'https://github.com/chen3861229/dd-danmaku' },
        original: { version: '1.11', name: 'Emby Danmaku Extension', license: 'MIT License', url: 'https://github.com/RyoLee/emby-danmaku' },
        jellyfinFork: { version: '1.45', name: 'Jellyfin Danmaku Extension', license: 'MIT License', url: 'https://github.com/Izumiko/jellyfin-danmaku' },
        danmaku: { version: '2.0.6', name: 'Danmaku', license: 'MIT License', url: 'https://github.com/weizhenye/Danmaku' },
        danmakuFork: { version: 'v1.2.0', name: 'Danmaku(Based on 2.0.6)', license: 'MIT License', url: 'https://github.com/lanytcc/Danmaku' },
        dandanplayApi: { version: 'v2', name: '弹弹play API', license: 'MIT License', url: 'https://github.com/kaedei/dandanplay-libraryindex' },
    };
    const dandanplayApi = {
        prefix: corsProxy + 'https://api.dandanplay.net/api/v2',
        getSearchEpisodes: (anime, episode) => `${dandanplayApi.prefix}/search/episodes?anime=${anime}${episode ? `&episode=${episode}` : ''}`,
        getComment: (episodeId, chConvert) => `${dandanplayApi.prefix}/comment/${episodeId}?withRelated=true&chConvert=${chConvert}`,
        getExtcomment: (url) => `${dandanplayApi.prefix}/extcomment?url=${encodeURI(url)}`,
        getBangumi: (animeId) => `${dandanplayApi.prefix}/bangumi/${animeId}`,
        posterImg: (animeId) => `https://img.dandanplay.net/anime/${animeId}.jpg`,
    };
    const bangumiApi = {
        prefix: 'https://api.bgm.tv/v0',
        accessTokenUrl: 'https://next.bgm.tv/demo/access-token',
        getCharacters: (subjectId) => `${bangumiApi.prefix}/subjects/${subjectId}/characters`,
        // need auth
        getMyself: () => `${bangumiApi.prefix}/me`,
        postUserCollection: (subjectId) => `${bangumiApi.prefix}/users/-/collections/${subjectId}`,
        getUserSubjectEpisodeCollection: (subjectId) => `${bangumiApi.prefix}/users/-/collections/${subjectId}/episodes?offset=0&limit=100`,
        putUserEpisodeCollection: (episodeId ) => `${bangumiApi.prefix}/users/-/collections/-/episodes/${episodeId}`,
    };
    const check_interval = 200;
    const LOAD_TYPE = {
        CHECK: 'check',
        INIT: 'init',
        REFRESH: 'refresh',
        RELOAD: 'reload', // 优先走缓存,其余类型走接口
        SEARCH: 'search',
    };
    let isVersionOld = false;
    // htmlVideoPlayerContainer
    let mediaContainerQueryStr = '.graphicContentContainer';
    const notHide = ':not(.hide)';
    const mediaQueryStr = 'video';

    const eleIds = {
        danmakuSwitchBtn: 'danmakuSwitchBtn',
        danmakuCtr: 'danmakuCtr',
        danmakuWrapper: 'danmakuWrapper',
        h5VideoAdapter: 'h5VideoAdapter',
        dialogContainer: 'dialogContainer',
        danmakuSwitchDiv: 'danmakuSwitchDiv',
        danmakuSwitch: 'danmakuSwitch',
        danmakuSearchNameDiv: 'danmakuSearchNameDiv',
        danmakuSearchName: 'danmakuSearchName',
        danmakuEpisodeFlag: 'danmakuEpisodeFlag',
        danmakuAnimeDiv: 'danmakuAnimeDiv',
        danmakuSwitchEpisode: 'danmakuSwitchEpisode',
        danmakuEpisodeNumDiv: 'danmakuEpisodeNumDiv',
        danmakuEpisodeLoad: 'danmakuEpisodeLoad',
        danmakuRemark: 'danmakuRemark',
        danmakuAnimeSelect: 'danmakuAnimeSelect',
        danmakuEpisodeNumSelect: 'danmakuEpisodeNumSelect',
        searchImgDiv: 'searchImgDiv',
        searchImg: 'searchImg',
        extConmentSearchDiv: 'extConmentSearchDiv',
        extUrlsDiv: 'extUrlsDiv',
        currentMatchedDiv: 'currentMatchedDiv',
        filteringDanmaku: 'filteringDanmaku',
        danmakuTypeFilterDiv: 'danmakuTypeFilterDiv',
        danmakuTypeFilterSelectName: 'danmakuTypeFilterSelectName',
        danmakuSourceFilterDiv: 'danmakuSourceFilterDiv',
        danmakuSourceFilterSelectName: 'danmakuSourceFilterSelectName',
        danmakuShowSourceDiv: 'danmakuShowSourceDiv',
        danmakuShowSourceSelectName: 'danmakuShowSourceSelectName',
        danmakuEngineDiv: 'danmakuEngineDiv',
        danmakuChConverDiv: 'danmakuChConverDiv',
        danmakuFilterLevelDiv: 'danmakuFilterLevelDiv',
        danmakuHeightRateDiv: 'danmakuHeightRateDiv',
        posterImgDiv: 'posterImgDiv',
        danmuListDiv: 'danmuListDiv',
        danmuListText: 'danmakuListText',
        extInfoCtrlDiv: 'extInfoCtrlDiv',
        extInfoDiv: 'extInfoDiv',
        characterImgHeihtDiv: 'characterImgHeihtDiv',
        characterImgHeihtLabel: 'characterImgHeihtLabel',
        charactersDiv: 'charactersDiv',
        filterKeywordsDiv: 'filterKeywordsDiv',
        danmakuSizeDiv: 'danmakuSizeDiv',
        danmakuSizeLabel: 'danmakuSizeLabel',
        danmakuOpacityDiv: 'danmakuOpacityDiv',
        danmakuOpacityLabel: 'danmakuOpacityLabel',
        danmakuSpeedDiv: 'danmakuSpeedDiv',
        danmakuSpeedLabel: 'danmakuSpeedLabel',
        timelineOffsetDiv: 'timelineOffsetDiv',
        timelineOffsetLabel: 'timelineOffsetLabel',
        settingsCtrl: 'settingsCtrl',
        settingsText: 'settingsText',
        settingsImportBtn: 'settingsImportBtn',
        settingReloadBtn: 'settingReloadBtn',
        filterKeywordsEnableId: 'filterKeywordsEnableId',
        filterKeywordsId: 'filterKeywordsId',
        timeoutCallbackDiv: 'timeoutCallbackDiv',
        timeoutCallbackLabel: 'timeoutCallbackLabel',
        timeoutCallbackTypeDiv: 'timeoutCallbackTypeDiv',
        timeoutCallbackUnitDiv: 'timeoutCallbackUnitDiv',
        bangumiEnableLabel: 'bangumiEnableLabel',
        bangumiSettingsDiv: 'bangumiSettingsDiv',
        bangumiTokenInput: 'bangumiTokenInput',
        bangumiTokenInputDiv: 'bangumiTokenInputDiv',
        bangumiTokenLabel: 'bangumiTokenInputLabel',
        bangumiTokenLinkDiv: 'bangumiTokenLinkDiv',
        bangumiPostPercentDiv: 'bangumiPostPercentDiv',
        bangumiPostPercentLabel: 'bangumiPostPercentLabel',
        consoleLogCtrl: 'consoleLogCtrl',
        consoleLogText: 'consoleLogText',
        consoleLogTextInput: 'consoleLogTextInput',
        consoleLogCountLabel: 'consoleLogCountLabel',
        debugCheckbox: 'debugCheckbox',
        debugButton: 'debugButton',
        tabIframe: 'tabIframe',
        tabIframeHeightDiv: 'tabIframeHeightDiv',
        tabIframeHeightLabel: 'tabIframeHeightLabel',
        tabIframeCtrlDiv: 'tabIframeCtrlDiv',
        tabIframeSrcInputDiv: 'tabIframeSrcInputDiv',
        openSouceLicenseDiv: 'openSouceLicenseDiv',
        videoOsdDanmakuTitle: 'videoOsdDanmakuTitle',
        osdTitleEnableDiv: 'osdTitleEnableDiv',
    };
    const embyOffsetBtnStyle = 'margin: 0;padding: 0;';
    // https://fonts.google.com/icons
    const iconKeys = {
        replay_30: 'replay_30',
        replay_10: 'replay_10',
        replay_5: 'replay_5',
        replay: 'replay',
        reset: 'repeat',
        forward_media: 'forward_media', // electron中图标不正确,使用replay反转
        forward_5: 'forward_5',
        forward_10: 'forward_10',
        forward_30: 'forward_30',
        comment: 'comment',
        comments_disabled: 'comments_disabled',
        switch_on: 'toggle_on',
        switch_off: 'toggle_off',
        setting: 'tune',
        search: 'search',
        done: 'done_all',
        done_disabled: 'remove_done',
        more: 'more_horiz',
        close: 'close',
        refresh: 'refresh',
        block: 'block',
        text_format: 'translate',
        person: 'person',
        sentiment_very_satisfied: 'sentiment_very_satisfied',
        check: 'check',
    };

    // 播放界面下方按钮
    const mediaBtnOpts = [
        { id: eleIds.danmakuSwitchBtn, label: '弹幕开关', iconKey: iconKeys.comment, onClick: doDanmakuSwitch },
        { label: '弹幕设置', iconKey: iconKeys.setting, onClick: createDialog },
    ];
    // 此 id 等同于 danmakuTabOpts 内的弹幕信息的 id
    const currentDanmakuInfoContainerId = 'danmakuTab2';
    const tabIframeId = 'danmakuTab6';
    // 菜单 tabs, 为兼容控制器移动, 应避免使用左右布局
    const danmakuTabOpts = [
        { id: 'danmakuTab0', name: '弹幕设置', buildMethod: buildDanmakuSetting },
        { id: 'danmakuTab1', name: '手动匹配', buildMethod: buildSearchEpisode },
        { id: currentDanmakuInfoContainerId, name: '弹幕信息', buildMethod: buildCurrentDanmakuInfo },
        { id: 'danmakuTab3', name: '弹幕屏蔽', buildMethod: buildDanmakuFilter },
        { id: 'danmakuTab4', name: '额外设置', buildMethod: buildExtSetting },
        { id: 'danmakuTab5', name: '关于', buildMethod: buildAbout },
        { id: tabIframeId, name: '内嵌网页', hidden: true, buildMethod: buildIframe },
    ];
    // 弹幕类型过滤
    const danmakuTypeFilterOpts = {
        bottom: { id: 'bottom', name: '底部弹幕' },
        top: { id: 'top', name: '顶部弹幕' },
        ltr: { id: 'ltr', name: '从左至右' },
        rtl: { id: 'rtl', name: '从右至左', hidden: true },
        onlyWhite: { id: 'onlyWhite', name: '彩色弹幕' },
    };
    const danmakuSource = {
        AcFun: { id: 'AcFun', name: 'A站(AcFun)' },
        BiliBili: { id: 'BiliBili', name: 'B站(BiliBili)' },
        Gamer: { id: 'Gamer', name: '巴哈(Gamer)' },
        DanDanPlay: { id: 'DanDanPlay', name: '弹弹(DanDanPlay)' }, // 无弹幕来源的默认值
        '5dm': { id: '5dm', name: 'D站(5dm)' },
        '异世界动漫': { id: '异世界动漫', name: '异世界动漫' },
    };
    const showSource = {
        source: { id: 'source', name: '来源平台' },
        originalUserId: { id: 'originalUserId', name: '来源用户id' },
        cid: { id: 'cid', name: '来源cid' }, // 非弹幕id,唯一性用cuid
    };
    const danmakuEngineOpts = [
        { id: 'canvas', name: 'canvas' },
        { id: 'dom', name: 'dom' },
    ];
    const danmakuChConverOpts = [
        { id: '0', name: '未启用' },
        { id: '1', name: '转换为简体' },
        { id: '2', name: '转换为繁体' },
    ];
    const danmakuFilterLevelOpts = [
        { id: '0', name: '0' },
        { id: '1', name: '1' },
        { id: '2', name: '2' },
        { id: '3', name: '3' },
    ];
    const danmakuHeightRateOpts = [
        { id: '1', name: '100%' },
        { id: '0.75', name: '75%' },
        { id: '0.5', name: '50%' },
        { id: '0.25', name: '25%' },
    ];
    const timeOffsetBtns = [
        { label: '-30', valueOffset: '-30', iconKey: iconKeys.replay_30,  style: embyOffsetBtnStyle },
        { label: '-10', valueOffset: '-10', iconKey: iconKeys.replay_10,  style: embyOffsetBtnStyle },
        { label: '-5',  valueOffset: '-5',  iconKey: iconKeys.replay_5,   style: embyOffsetBtnStyle },
        { label: '-1',  valueOffset: '-1',  iconKey: iconKeys.replay,     style: embyOffsetBtnStyle },
        { label: '0',   valueOffset: '0',   iconKey: iconKeys.reset,      style: embyOffsetBtnStyle },
        { label: '+1',  valueOffset: '1',   iconKey: iconKeys.replay,     style: embyOffsetBtnStyle + ' transform: rotateY(180deg);' },
        { label: '+5',  valueOffset: '5',   iconKey: iconKeys.forward_5,  style: embyOffsetBtnStyle },
        { label: '+10', valueOffset: '10',  iconKey: iconKeys.forward_10, style: embyOffsetBtnStyle },
        { label: '+30', valueOffset: '30',  iconKey: iconKeys.forward_30, style: embyOffsetBtnStyle },
    ];
    const toastPrefixes = {
        system: '[系统通知] : ',
    };
    const hasToastPrefixes = (comment, prefixes) => Object.values(prefixes).some(prefix => comment.text.startsWith(prefix));
    const getDanmakuComments = (ede) => ede.danmaku?.comments.filter(c => !hasToastPrefixes(c, toastPrefixes)) ?? [];
    const danmuListOpts = [
        { id: '0', name: '不启用' , onChange: () => [] },
        { id: '1', name: '屏中', onChange: (ede) => ede.danmaku._.runningList },
        { id: '2', name: '所有', onChange: (ede) => ede.commentsParsed },
        { id: '3', name: '已加载', onChange: getDanmakuComments },
        { id: '4', name: '被过滤', onChange: (ede) => { // 取差集慢,减轻负担,默认不启用
            return ede.commentsParsed.filter(s => !getDanmakuComments(ede).some(t => s.cuid === t.cuid))
        } },
        { id: '5', name: '通知', onChange: (ede) => ede.danmaku.comments.filter(c => hasToastPrefixes(c, toastPrefixes)) },
    ];
    const timeoutCallbackUnitOpts = [
        { id: '0', name: '秒', msRate: 1000 },
        { id: '1', name: '分', msRate: 1000 * 60 },
        { id: '2', name: '时', msRate: 1000 * 60 * 60 },
    ];
    let timeoutCallbackId;
    const timeoutCallbackClear = () => timeoutCallbackId && clearTimeout(timeoutCallbackId);
    const timeoutCallbackTypeOpts = [
        { id: '0', name: '不启用' , onChange: () => timeoutCallbackClear() },
        { id: '1', name: '返回上级', onChange: (ms) => {
            timeoutCallbackClear(), timeoutCallbackId = setTimeout(() => { closeEmbyDialog(), Emby.InputManager.trigger('back') }, ms);
        } },
        { id: '2', name: '返回主页', onChange: (ms) => { // Native 播放器不支持.trigger('home'),虽底层一样,但原因未知
            timeoutCallbackClear(), timeoutCallbackId = setTimeout(() => { closeEmbyDialog(), Emby.Page.goHome() }, ms);
        } },
    ];
    const lsKeys = {
        chConvert: { id: 'danmakuChConvert', defaultValue: 1, name: '简繁转换' },
        switch: { id: 'danmakuSwitch', defaultValue: true, name: '弹幕开关' },
        filterLevel: { id: 'danmakuFilterLevel', defaultValue: 0, name: '密度等级' },
        heightRate: { id: 'danmakuHeightRate', defaultValue: 1, name: '高度比例' },
        fontSizeRate: { id: 'danmakuFontSizeRate', defaultValue: 1, name: '大小' },
        fontOpacity: { id: 'danmakuFontOpacity', defaultValue: 1, name: '透明度' },
        speed: { id: 'danmakuBaseSpeed', defaultValue: 1, name: '速度' },
        timelineOffset: { id: 'danmakuTimelineOffset', defaultValue: 0, name: '轴偏秒' },
        danmuList: { id: 'danmakuDanmuList', defaultValue: 0, name: '弹幕列表' },
        typeFilter: { id: 'danmakuTypeFilter', defaultValue: [], name: '屏蔽类型' },
        sourceFilter: { id: 'danmakuSourceFilter', defaultValue: [], name: '屏蔽来源平台' },
        showSource: { id: 'danmakuShowSource', defaultValue: [], name: '显示每条来源' },
        engine: { id: 'danmakuEngine', defaultValue: 'canvas', name: '弹幕引擎' },
        filterKeywords: { id: 'danmakuFilterKeywords', defaultValue: '', name: '屏蔽关键词' },
        filterKeywordsEnable: { id: 'danmakuFilterKeywordsEnable', defaultValue: true, name: '屏蔽关键词启用' },
        timeoutCallbackUnit: { id: 'timeoutCallbackUnit', defaultValue: 1, name: '定时单位' },
        timeoutCallbackValue: { id: 'timeoutCallbackValue', defaultValue: 0, name: '定时值' },
        bangumiEnable: { id: 'bangumiEnable', defaultValue: false, name: '启用并填写个人令牌' },
        bangumiToken: { id: 'bangumiToken', defaultValue: '', name: '个人令牌' },
        bangumiPostPercent: { id: 'bangumiPostPercent', defaultValue: 95, name: '时长比' },
        consoleLogEnable: { id: 'danmakuConsoleLogEnable', defaultValue: false, name: '控制台日志' },
        osdTitleEnable: { id: 'danmakuOsdTitleEnable', defaultValue: false, name: '控制界面右下角显示弹幕信息' },
    };
    // emby ui class
    const embyLabelClass = 'inputLabel';
    const embyInputClass = 'emby-input emby-input-smaller';
    const embySelectWrapperClass = 'emby-select-wrapper emby-select-wrapper-smaller';
    const embyCheckboxListClass = 'featureList'; // 'checkboxList'
    const embyFieldDescClass = 'fieldDescription';
    const embyTabsMenuClass = 'headerMiddle headerSection sectionTabs headerMiddle-withSectionTabs';
    const embyTabsDivClass1 = 'tabs-viewmenubar tabs-viewmenubar-backgroundcontainer focusable scrollX hiddenScrollX smoothScrollX scrollFrameX emby-tabs';
    const embyTabsDivClass2 = 'tabs-viewmenubar-slider emby-tabs-slider padded-left padded-right nohoverfocus scrollSliderX';
    const embyTabsButtonClass = 'emby-button secondaryText emby-tab-button main-tab-button';
    const embyCheckboxListStyle = 'display: flex;flex-wrap: wrap;';
    const embySliderListStyle = 'display: flex;flex-direction: column;justify-content: center;align-items: center;'; // 容器内元素垂直排列,水平居中 
    const embySliderStyle = 'display: flex; align-items: center; gap: 1em; margin-bottom: 0.3em;'; // 容器内元素横向并排,垂直居中
    const embyButtonClasses = {
        basic: 'raised emby-button',
        submit: 'button-submit',
        help: 'button-help',
        iconButton: 'flex-shrink-zero paper-icon-button-light',
    };
    const colors = {
        info: 0xffffff,  // 白色
        success: 0x00ff00,  // 绿色
        warn: 0xffff00,  // 黄色
        error: 0xff0000,  // 红色
    };

    // ------ 程序内部使用,请勿更改 end ------

    // ------ require start ------
    let skipInnerModule = false;
    try {
        throw new Error();
    } catch(e) {
        skipInnerModule = e.stack && e.stack.includes('CustomCssJS');
        // console.log('ignore this not error, callee:', e);
    }
    if (!skipInnerModule) {
        // 这里内置依赖是工作在浏览器油猴和服务端 index.html 环境下, requireDanmakuPath 是特殊环境 CustomCssJS 下网络加载使用
        /* https://cdn.jsdelivr.net/gh/lanytcc/Danmaku@v1.2.0/dist/danmaku.min.js */
        /* eslint-disable */
        // prettier-ignore
        !function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).Danmaku=e()}(this,(function(){"use strict";var t=function(){if("undefined"==typeof document)return"transform";for(var t=["oTransform","msTransform","mozTransform","webkitTransform","transform"],e=document.createElement("div").style,i=0;i<t.length;i++)if(t[i]in e)return t[i];return"transform"}();function e(t){var e=document.createElement("div");if(e.style.cssText="position:absolute;","function"==typeof t.render){var i=t.render();if(i instanceof HTMLElement)return e.appendChild(i),e}if(e.textContent=t.text,t.style)for(var n in t.style)e.style[n]=t.style[n];return e}var i={name:"dom",init:function(){var t=document.createElement("div");return t.style.cssText="overflow:hidden;white-space:nowrap;transform:translateZ(0);",t},clear:function(t){for(var e=t.lastChild;e;)t.removeChild(e),e=t.lastChild},resize:function(t,e,i){t.style.width=e+"px",t.style.height=i+"px"},framing:function(){},setup:function(t,i){var n=document.createDocumentFragment(),s=0,r=null;for(s=0;s<i.length;s++)(r=i[s]).node=r.node||e(r),n.appendChild(r.node);for(i.length&&t.appendChild(n),s=0;s<i.length;s++)(r=i[s]).width=r.width||r.node.offsetWidth,r.height=r.height||r.node.offsetHeight},render:function(e,i){i.node.style[t]="translate("+i.x+"px,"+i.y+"px)"},remove:function(t,e){t.removeChild(e.node),this.media||(e.node=null)}},n="undefined"!=typeof window&&window.devicePixelRatio||1,s=Object.create(null);function r(t,e){if("function"==typeof t.render){var i=t.render();if(i instanceof HTMLCanvasElement)return t.width=i.width,t.height=i.height,i}var r=document.createElement("canvas"),o=r.getContext("2d"),h=t.style||{};h.font=h.font||"10px sans-serif",h.textBaseline=h.textBaseline||"bottom";var a=1*h.lineWidth;for(var d in a=a>0&&a!==1/0?Math.ceil(a):1*!!h.strokeStyle,o.font=h.font,t.width=t.width||Math.max(1,Math.ceil(o.measureText(t.text).width)+2*a),t.height=t.height||Math.ceil(function(t,e){if(s[t])return s[t];var i=12,n=t.match(/(\d+(?:\.\d+)?)(px|%|em|rem)(?:\s*\/\s*(\d+(?:\.\d+)?)(px|%|em|rem)?)?/);if(n){var r=1*n[1]||10,o=n[2],h=1*n[3]||1.2,a=n[4];"%"===o&&(r*=e.container/100),"em"===o&&(r*=e.container),"rem"===o&&(r*=e.root),"px"===a&&(i=h),"%"===a&&(i=r*h/100),"em"===a&&(i=r*h),"rem"===a&&(i=e.root*h),void 0===a&&(i=r*h)}return s[t]=i,i}(h.font,e))+2*a,r.width=t.width*n,r.height=t.height*n,o.scale(n,n),h)o[d]=h[d];var l=0;switch(h.textBaseline){case"top":case"hanging":l=a;break;case"middle":l=t.height>>1;break;default:l=t.height-a}return h.strokeStyle&&o.strokeText(t.text,a,l),o.fillText(t.text,a,l),r}function o(t){return 1*window.getComputedStyle(t,null).getPropertyValue("font-size").match(/(.+)px/)[1]}var h={name:"canvas",init:function(t){var e=document.createElement("canvas");return e.context=e.getContext("2d"),e._fontSize={root:o(document.getElementsByTagName("html")[0]),container:o(t)},e},clear:function(t,e){t.context.clearRect(0,0,t.width,t.height);for(var i=0;i<e.length;i++)e[i].canvas=null},resize:function(t,e,i){t.width=e*n,t.height=i*n,t.style.width=e+"px",t.style.height=i+"px"},framing:function(t){t.context.clearRect(0,0,t.width,t.height)},setup:function(t,e){for(var i=0;i<e.length;i++){var n=e[i];n.canvas=r(n,t._fontSize)}},render:function(t,e){t.context.drawImage(e.canvas,e.x*n,e.y*n)},remove:function(t,e){e.canvas=null}};function a(t){const e=this,i=e.media?e.media.currentTime:Date.now()/1e3,n=e.media?e.media.playbackRate:1,s=t.mode,r=t.height,o=e._.height,h=Math.floor(o/r);e._.space[s]&&e._.space[s].length===h||(e._.space[s]=new Array(h).fill(null).map(()=>({endTime:0})));const a=e._.space[s];let d=-1;function l(t,e,i,n,s,r){if(!t||!t.endTime)return!0;if(i>=t.endTime)return!0;if("ltr"===s||"rtl"===s){const o=i-t.startTime,h=i-e.time,a=r._.duration/n,d=r._.width,l=o/a*d,u=h/a*d;let c=0,m=0,f=0,p=0;if("rtl"===s?(c=r._.width-l,m=c+t.width,f=r._.width-u,p=f+e.width):(m=-t.width+l,c=m-t.width,p=-e.width+u,f=p-e.width),f<m&&p>c||p>c&&f<m)return!1}if("top"===s||"bottom"===s){const e=r._.duration/n;return i-t.startTime>=e}return!0}for(let r=0;r<h;r++){if(l(a[r],t,i,n,s,e)){d=r;break}}if(-1===d)return-1;const u=e.media?t.time:t._utc,c=u+e._.duration/n;a[d]={startTime:u,endTime:c,width:t.width,height:t.height};return"bottom"===s?o-(d+1)*r:d*r}var d="undefined"!=typeof window&&(window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame)||function(t){return setTimeout(t,50/3)},l="undefined"!=typeof window&&(window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.webkitCancelAnimationFrame)||clearTimeout;function u(t,e,i){for(var n=0,s=0,r=t.length;s<r-1;)i>=t[n=s+r>>1][e]?s=n:r=n;return t[s]&&i<t[s][e]?s:r}function c(t){return/^(ltr|top|bottom)$/i.test(t)?t.toLowerCase():"rtl"}function m(t){t.ltr=[],t.rtl=[],t.top=[],t.bottom=[]}function f(){if(!this._.visible||!this._.paused)return this;if(this._.paused=!1,this.media)for(var t=0;t<this._.runningList.length;t++){var e=this._.runningList[t];e._utc=Date.now()/1e3-(this.media.currentTime-e.time)}var i=this,n=function(t,e,i,n){return function(s){let r=s;void 0===r&&(r=Date.now()),t(this._.stage);const o=r/1e3,h=this.media?this.media.currentTime:o,d=this.media?this.media.playbackRate:1;let l=null,u=0,c=0;for(c=this._.runningList.length-1;c>=0;c--){l=this._.runningList[c],u=this.media?l.time:l._utc;const t=(o-l._utc)*d;let e=!1;"top"===l.mode||"bottom"===l.mode?t>this._.duration&&(e=!0):"ltr"===l.mode?l.x>this._.width&&(e=!0):"rtl"===l.mode&&l.x+l.width<0&&(e=!0),e&&(n(this._.stage,l),this._.runningList.splice(c,1))}const m=[];for(;this._.position<this.comments.length&&(l=this.comments[this._.position],u=this.media?l.time:l._utc,!(u>=h));)h-u>this._.duration||(this.media&&(l._utc=o-(this.media.currentTime-l.time)),m.push(l)),++this._.position;for(e(this._.stage,m),c=0;c<m.length;c++)l=m[c],l.y=a.call(this,l),this._.runningList.push(l);for(c=0;c<this._.runningList.length;c++){if(l=this._.runningList[c],-1===l.y)continue;const t=(o-l._utc)*d/this._.duration,e=this._.width*t;"ltr"===l.mode?l.x=-l.width+e:"rtl"===l.mode?l.x=this._.width-e:"top"!==l.mode&&"bottom"!==l.mode||(l.x=(this._.width-l.width)/2),l.element&&l.element.style&&(l.element.style.transform=`translate(${l.x}px, ${l.y}px)`),i(this._.stage,l)}}}(this._.engine.framing.bind(this),this._.engine.setup.bind(this),this._.engine.render.bind(this),this._.engine.remove.bind(this));return this._.requestID=d((function t(){n.call(i),i._.requestID=d(t)})),this}function p(){return!this._.visible||this._.paused||(this._.paused=!0,l(this._.requestID),this._.requestID=0),this}function _(){if(!this.media)return this;this.clear(),m(this._.space);var t=u(this.comments,"time",this.media.currentTime);return this._.position=Math.max(0,t-1),this}function g(t){t.play=f.bind(this),t.pause=p.bind(this),t.seeking=_.bind(this),this.media.addEventListener("play",t.play),this.media.addEventListener("pause",t.pause),this.media.addEventListener("playing",t.play),this.media.addEventListener("waiting",t.pause),this.media.addEventListener("seeking",t.seeking)}function v(t){this.media.removeEventListener("play",t.play),this.media.removeEventListener("pause",t.pause),this.media.removeEventListener("playing",t.play),this.media.removeEventListener("waiting",t.pause),this.media.removeEventListener("seeking",t.seeking),t.play=null,t.pause=null,t.seeking=null}function w(t){this._={},this.container=t.container||document.createElement("div"),this.media=t.media,this._.visible=!0,this.engine=(t.engine||"DOM").toLowerCase(),this._.engine="canvas"===this.engine?h:i,this._.requestID=0,this._.speed=Math.max(0,t.speed)||144,this._.duration=4,this.comments=t.comments||[],this.comments.sort((function(t,e){return t.time-e.time}));for(var e=0;e<this.comments.length;e++)this.comments[e].mode=c(this.comments[e].mode);return this._.runningList=[],this._.position=0,this._.paused=!0,this.media&&(this._.listener={},g.call(this,this._.listener)),this._.stage=this._.engine.init(this.container),this._.stage.style.cssText+="position:relative;pointer-events:none;",this.resize(),this.container.appendChild(this._.stage),this._.space={},m(this._.space),this.media&&this.media.paused||(_.call(this),f.call(this)),this}function y(){if(!this.container)return this;for(var t in p.call(this),this.clear(),this.container.removeChild(this._.stage),this.media&&v.call(this,this._.listener),this)Object.prototype.hasOwnProperty.call(this,t)&&(this[t]=null);return this}var x=["mode","time","text","render","style"];function b(t){if(!t||"[object Object]"!==Object.prototype.toString.call(t))return this;for(var e={},i=0;i<x.length;i++)void 0!==t[x[i]]&&(e[x[i]]=t[x[i]]);if(e.text=(e.text||"").toString(),e.mode=c(e.mode),e._utc=Date.now()/1e3,this.media){var n=0;void 0===e.time?(e.time=this.media.currentTime,n=this._.position):(n=u(this.comments,"time",e.time))<this._.position&&(this._.position+=1),this.comments.splice(n,0,e)}else this.comments.push(e);return this}function T(){return this._.visible?this:(this._.visible=!0,this.media&&this.media.paused||(_.call(this),f.call(this)),this)}function L(){return this._.visible?(p.call(this),this.clear(),this._.visible=!1,this):this}function E(){return this._.engine.clear(this._.stage,this._.runningList),this._.runningList=[],this}function k(){return this._.width=this.container.offsetWidth,this._.height=this.container.offsetHeight,this._.engine.resize(this._.stage,this._.width,this._.height),this._.duration=this._.width/this._.speed,this}var C={get:function(){return this._.speed},set:function(t){return"number"!=typeof t||isNaN(t)||!isFinite(t)||t<=0?this._.speed:(this._.speed=t,this._.width&&(this._.duration=this._.width/t),t)}};function D(t){t&&w.call(this,t)}return D.prototype.destroy=function(){return y.call(this)},D.prototype.emit=function(t){return b.call(this,t)},D.prototype.show=function(){return T.call(this)},D.prototype.hide=function(){return L.call(this)},D.prototype.clear=function(){return E.call(this)},D.prototype.resize=function(){return k.call(this)},Object.defineProperty(D.prototype,"speed",C),D}));
        /* eslint-enable */
    } else {
        window.Danmaku || Emby.importModule(requireDanmakuPath).then(f => {
            console.log(f);
            window.Danmaku = f;
        }).catch(error => {
            console.error(`fail Emby.importModule error:`, error);
        });
    }
    // ------ require end ------

    class EDE {
        constructor() {
            this.chConvert = lsGetItem(lsKeys.chConvert.id);
            this.danmaku = null;
            this.episode_info = null;
            this.ob = null;
            this.loading = false;
            this.danmuCache = {}; // 只包含 conment 未解析
            this.commentsParsed = []; // 包含 conment 和 extConment 解析后全量
            this.extConmentCache = {}; // 只包含 extConment 未解析
            this.destroyIntervalIds = [];
            this.searchDanmakuOpts = {}; // 手动搜索变量
            this.appLogAspect = null; // 应用日志切面
            this.debug = {};
            this.bangumiInfo = {};
        }
    }

    class AppLogAspect {
        constructor() {
            this.initialized = false;
            this.originalError = console.error;
            this.originalWarn = console.warn;
            this.originalLog = console.log;
            this.originalOnerror = null;
            this.value = '';
            this.listeners = [];
            this.ERROR = { text: 'ERROR', emoji: '❗️' };
            this.WARN = { text: 'WARN', emoji: '⚠️' };
            this.INFO = { text: 'INFO', emoji: '❕' };
        }
        init() {
            if (this.initialized) { return this; }
            console.error = (...args) => {
                this.originalError.apply(console, args);
                this.value += this.format(this.ERROR, args);
                this.notifyListeners();
            };
            console.warn = (...args) => {
                this.originalWarn.apply(console, args);
                this.value += this.format(this.WARN, args);
                this.notifyListeners();
            };
            console.log = (...args) => {
                this.originalLog.apply(console, args);
                this.value += this.format(this.INFO, args);
                this.notifyListeners();
            };
            this.originalOnerror = window.onerror;
            window.onerror = (...args) => {
                console.error(args);
                if (typeof this.originalOnerror === 'function') {
                    this.originalOnerror(...args);
                }
            };
            this.initialized = true;
            return this;
        }
        destroy(clearValue = true) {
            if (this.initialized) {
                console.error = this.originalError;
                console.warn = this.originalWarn;
                console.log = this.originalLog;
                window.onerror = this.originalOnerror;
                clearValue && (this.value = '');
                this.listeners = [];
                this.initialized = false;
            }
            return this;
        }
        format(level, args) {
            const emoji = level.emoji ? `[${level.emoji}] ` : '';
            return `[${new Date(Date.now()).toLocaleString()}] [${level.text}] ${emoji}: `
                + args.map(arg => arg instanceof Error ? arg.message : (typeof arg === 'string' ? arg : JSON.stringify(arg)))
                .join(' ') + '\n';
        }
        on(valueChangedCallback) {
            if (valueChangedCallback.toString().includes('console.log') 
                || valueChangedCallback.toString().includes('console.error')) {
                throw new Error('The callback function must not contain console.log or console.error to avoid infinite loops.');
            }
            this.listeners.push(() => valueChangedCallback(this.value));
        }
        notifyListeners() { this.listeners.forEach(listener => listener()); }
        clearValue() { this.value = ''; this.notifyListeners(); }
    }

    function initListener() {
        const _media = document.querySelector(mediaQueryStr);
        // 页面未加载
        if (!_media) {
            window.ede.episode_info && (window.ede.episode_info = null);
            return;
        }
        if (_media.getAttribute('ede_listening')) { return; }
        console.log('正在初始化Listener');
        _media.setAttribute('ede_listening', true);
        _media.addEventListener('play', (e) => { loadDanmaku(LOAD_TYPE.INIT); });
        playbackEventsOn({ 'playbackstop': onPlaybackStopped });
        console.log('Listener初始化完成');
    }

    function initUI() {
        // 已初始化
        if (getById(eleIds.danmakuCtr)) { return; }
        console.log('正在初始化UI');

        // ApiClient.isMinServerVersion("4.8.0.00"); 可以精确对比客户端指定版本小于当前版本,但此处暂时不需要
        if (parseFloat(ApiClient.serverVersion()) < 4.8) {
            mediaContainerQueryStr = 'div[data-type="video-osd"]';
            isVersionOld = true;
        }
        if (!mediaContainerQueryStr.includes(notHide)) {
            mediaContainerQueryStr += notHide;
        }
    
        // 弹幕按钮父容器 div,延时判断,精确 dom query 时播放器 UI 小概率暂未渲染
        const mediaQueryStr = `${mediaContainerQueryStr} .videoOsdBottom-maincontrols .videoOsdBottom-buttons`;
        waitForElement(mediaQueryStr, (parent) => {
            // 在老客户端上存在右侧按钮,在右侧按钮前添加
            const rightButtons = parent.querySelector('.videoOsdBottom-buttons-right');
            const menubar = document.createElement('div');
            menubar.id = eleIds.danmakuCtr;
            if (!window.ede.episode_info) {
                menubar.style.opacity = 0.5;
            }
            if (rightButtons) {
                parent.insertBefore(menubar, rightButtons);
            } else {
                parent.append(menubar);
            }
            mediaBtnOpts.forEach(opt => {
                menubar.appendChild(embyButton(opt, opt.onClick));
            });
            console.log('UI初始化完成');
        }, 0);
    }

    async function getEmbyItemInfo() {
        return window.require(['playbackManager']).then((items) => items?.[0].currentItem());
    }

    async function fatchEmbyItemInfo(id) {
        return await ApiClient.getItem(ApiClient.getCurrentUserId(), id);
    }

    async function fetchSearchEpisodes(anime, episode) {
        if (!anime) { throw new Error('anime is required'); }
        const url = dandanplayApi.getSearchEpisodes(anime, episode);
        const animaInfo = await fetchJson(url)
            .catch((error) => {
                console.log('查询失败:', error);
                return null;
            });
        console.log('查询成功', animaInfo);
        return animaInfo;
    }

    async function fetchComment(episodeId) {
        const url = dandanplayApi.getComment(episodeId, window.ede.chConvert);
        return fetchJson(url)
            .then((data) => {
                console.log('弹幕获取成功: ' + data.comments.length);
                return data.comments;
            })
            .catch((error) => {
                console.log('弹幕获取失败:', error);
                return null;
            });
    }

    async function fetchExtcommentActual(extUrl) {
        let extcomments = await fetchJson(dandanplayApi.getExtcomment(extUrl));
        if (extcomments.length === 0) { // 只重试一遍进行弹弹 play 服务器缓存覆盖加载触发
            extcomments = await fetchJson(dandanplayApi.getExtcomment(extUrl));
        }
        return extcomments;
    }

    function onPlaybackStopped(e, state) {
        const positionTicks = state.PlayState.PositionTicks;
        const runtimeTicks = state.NowPlayingItem.RunTimeTicks;
        if (!runtimeTicks) { return; }
        const pct = positionTicks / runtimeTicks * 100;
        console.log(`结束播放百分比: ${pct}%`);
        const bangumiPostPercent = lsGetItem(lsKeys.bangumiPostPercent.id);
        const bangumiToken = lsGetItem(lsKeys.bangumiToken.id);
        if (lsGetItem(lsKeys.bangumiEnable.id) && bangumiToken && pct > bangumiPostPercent && !!window.ede.episode_info?.episodeId) {
            console.log(`大于需提交的设定百分比: ${bangumiPostPercent}%`);
            putBangumiEpStatus(bangumiToken).then(res => {
                embyToast({ text: `结束播放百分比: ${pct}%, 大于需提交的设定百分比: ${bangumiPostPercent}%, 提交成功` });
                console.log('putBangumiEpStatus 成功');
            }).catch(error => {
                console.error('putBangumiEpStatus 失败', error);
            });
        }
    }

    async function getEpisodeBangumiRel() {
        const episode_info = window.ede.episode_info;
        const _bangumi_key = `_bangumi_episode_id_rel_${episode_info.episodeId}`;
        let bangumiInfoLs = localStorage.getItem(_bangumi_key);
        if (bangumiInfoLs) {
            bangumiInfoLs = JSON.parse(bangumiInfoLs);
        }
        let bangumiEpsRes = bangumiInfoLs?.bangumiEpsRes;
        let subjectId = bangumiInfoLs?.subjectId;
        let bangumiUrl = bangumiInfoLs?.bangumiUrl;
        const animeId = episode_info.animeId;
        if (!subjectId) {
            if (!animeId) { throw new Error('未获取到 animeId'); }
            bangumiUrl = (await fetchJson(dandanplayApi.getBangumi(animeId))).bangumi.bangumiUrl;
            if (!bangumiUrl) { throw new Error('未请求到 bangumiUrl'); }
            subjectId = parseInt(bangumiUrl.match(/\/(\d+)$/)[1]);
        }
        const episodeIndex = episode_info?.episodeIndex;
        const bangumiInfo = { animeId, bangumiUrl, subjectId, episodeIndex, bangumiEpsRes, _bangumi_key };
        window.ede.bangumiInfo = bangumiInfo;
        localStorage.setItem(bangumiInfo._bangumi_key, JSON.stringify(bangumiInfo));
        return bangumiInfo;
    }

    async function putBangumiEpStatus(token) {
        const bangumiInfo = await getEpisodeBangumiRel();
        const { subjectId, episodeIndex, } = bangumiInfo;
        // 修改条目收藏状态, 如果不存在则创建, 如果存在则修改
        let body = { type: 3 }; // 在看状态
        await fetchJson(bangumiApi.postUserCollection(subjectId), { token, body });
        if (!bangumiInfo.bangumiEpsRes) {
            const fetchUrl = bangumiApi.getUserSubjectEpisodeCollection(subjectId);
            const bangumiEpsRes = await fetchJson(fetchUrl, { token });
            bangumiInfo.bangumiEpsRes = bangumiEpsRes;
            const bangumiEpColl = bangumiEpsRes.data[episodeIndex];
            if (!bangumiEpColl) { throw new Error('未匹配到 bangumiEpColl'); }
            bangumiInfo.episodeIndex = episodeIndex;
        }
        const bangumiEpColl = bangumiInfo.bangumiEpsRes.data[bangumiInfo.episodeIndex];
        const bangumiEp = bangumiEpColl.episode;
        if (bangumiEpColl.type === 2) {
            console.log('Bangumi 已是看过状态,跳过更新', bangumiEp);
            throw new Error('Bangumi 已是看过状态,跳过更新');
        }
        body.type = 2; // 看过状态
        await fetchJson(bangumiApi.putUserEpisodeCollection(bangumiEp.id), { token, body, method: 'PUT' });
        bangumiEp.type = body.type;
        console.log(`成功更新 Bangumi 收藏状态, 在看 => 看过`, bangumiEp);
        window.ede.bangumiInfo = bangumiInfo;
        localStorage.setItem(bangumiInfo._bangumi_key, JSON.stringify(bangumiInfo));
        return bangumiInfo;
    }

    async function fetchJson(url, opts = {}) {
        const { token, headers, body } = opts;
        let { method = 'GET' } = opts;
        if (method === 'GET' && body) {
            method = 'POST';
        }
        const requestHeaders = {
            'Accept-Encoding': 'gzip',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': navigator.userAgent,
        };
        if (token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }
        if (headers) {
            Object.assign(requestHeaders, headers);
        }
        const requestBody = body ? JSON.stringify(body) : null;
        try {
            const response = await fetch(url, {
                method: method,
                headers: requestHeaders,
                body: requestBody,
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const responseText = await response.text();
            if (responseText.length > 0) {
                try {
                    return JSON.parse(responseText);
                } catch (parseError) {
                    console.warn('responseText not is JSON:', parseError);
                }
            }
            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    async function getMapByEmbyItemInfo() {
        const item = await getEmbyItemInfo();
        if (!item) { return null; } // getEmbyItemInfo from playbackManager null, will next called
        let _id;
        let animeName;
        let animeId = -1;
        let episode;
        if (item.Type == 'Episode') {
            _id = item.SeasonId;
            animeName = item.SeriesName;
            episode = item.IndexNumber;
            let session = item.ParentIndexNumber;
            if (session != 1) {
                animeName += ' ' + session;
            }
        } else {
            _id = item.Id;
            animeName = item.Name;
            episode = 'movie';
        }
        let _id_key = '_anime_id_rel_' + _id;
        let _name_key = '_anime_name_rel_' + _id;
        let _episode_key = '_episode_id_rel_' + _id + '_' + episode;
        if (window.localStorage.getItem(_id_key)) {
            animeId = window.localStorage.getItem(_id_key);
        }
        if (window.localStorage.getItem(_name_key)) {
            animeName = window.localStorage.getItem(_name_key);
        }
        return {
            _id: _id,
            _id_key: _id_key,
            _name_key: _name_key,
            _episode_key: _episode_key,
            animeId: animeId,
            episode: episode, // this is episode index, not a program index
            animeName: animeName,
            seriesOrMovieId: item.SeriesId || item.Id,
        };
    }

    async function autoFailback(animeName, episodeIndex, seriesOrMovieId) {
        console.log(`标题名: ${animeName}` + (episodeIndex ? `,章节过滤: ${episodeIndex}` : ''));
        console.log(`自动匹配未查询到结果,可能为非番剧,将移除章节过滤,重试一次`);
        let animaInfo = await fetchSearchEpisodes(animeName);
        if (animaInfo.animes.length > 0) {
            console.log(`移除章节过滤,自动匹配成功,转换为目标章节索引 0`);
            const episodeInfo = animaInfo.animes[0].episodes[episodeIndex - 1 ?? 0];
            animaInfo.animes[0].episodes = [episodeInfo];
            return { animeName, animaInfo, };
        }
        // from: https://github.com/Izumiko/jellyfin-danmaku/blob/jellyfin/ede.js#L886
        const seriesOrMovieInfo = await ApiClient.getItem(ApiClient.getCurrentUserId(), seriesOrMovieId);
        if (!seriesOrMovieInfo.OriginalTitle) { return null; }
        console.log(`标题名: ${animeName},自动匹配未查询到结果,将使用原标题名,重试一次`);
        const animeOriginalTitle = seriesOrMovieInfo.OriginalTitle;
        animaInfo = await fetchSearchEpisodes(animeOriginalTitle, episodeIndex);
        if (animaInfo.animes.length < 1) { return null; }
        console.log(`使用原标题名: ${animeOriginalTitle},自动匹配成功`);
        return { animeName, animeOriginalTitle, animaInfo, };
    }

    async function getEpisodeInfo(is_auto = true) {
        const itemInfoMap = await getMapByEmbyItemInfo();
        if (!itemInfoMap) { return null; }
        const { _episode_key, animeId } = itemInfoMap;
        let { animeName, episode } = itemInfoMap;
        if (is_auto && window.localStorage.getItem(_episode_key)) {
            return JSON.parse(window.localStorage.getItem(_episode_key));
        }

        let animeOriginalTitle = '';
        let animaInfo = await fetchSearchEpisodes(animeName, is_auto ? episode : null);
        if (is_auto && animaInfo.animes.length === 0) {
            const res = await autoFailback(animeName, is_auto ? episode : null, itemInfoMap.seriesOrMovieId);
            if (res) {
                ({ animaInfo, animeOriginalTitle } = res);
            }
        }
        if (animaInfo.animes.length === 0) {
            console.log(`弹弹 Play 章节匹配失败`);
            toastByDanmaku('弹弹 Play 章节匹配失败', 'error');
            return null;
        }

        let selectAnime_id = 1;
        if (animeId != -1) {
            for (let index = 0; index < animaInfo.animes.length; index++) {
                if (animaInfo.animes[index].animeId == animeId) {
                    selectAnime_id = index + 1;
                }
            }
        }
        selectAnime_id = parseInt(selectAnime_id) - 1;
        const episodeInfo = {
            episodeId: animaInfo.animes[selectAnime_id].episodes[0].episodeId,
            episodeTitle: animaInfo.animes[selectAnime_id].episodes[0].episodeTitle,
            episodeIndex: isNaN(episode) ? 0 : episode - 1,
            animeId: animaInfo.animes[selectAnime_id].animeId,
            animeTitle: animaInfo.animes[selectAnime_id].animeTitle,
            animeOriginalTitle,
        };
        localStorage.setItem(_episode_key, JSON.stringify(episodeInfo));
        return episodeInfo;
    }

    async function createDanmaku(comments) {
        if (!comments) { return; }
        if (window.ede.danmaku != null) {
            window.ede.danmaku.destroy();
            window.ede.danmaku = null;
        }
        const commentsParsed = danmakuParser(comments);
        window.ede.commentsParsed = commentsParsed;
        let _comments = danmakuFilter(commentsParsed);
        console.log('弹幕加载成功: ' + _comments.length);

        const _container = document.querySelector(mediaContainerQueryStr);
        const _media = document.querySelector(mediaQueryStr);
        if (!_media) { throw new Error('用户已退出视频播放'); }
        if (!isVersionOld) { _media.style.position = 'absolute'; }
        // from https://github.com/Izumiko/jellyfin-danmaku/blob/jellyfin/ede.js#L1104
        const wrapperTop = 0; // 播放器 UI 顶部阴影
        let wrapper = getById(eleIds.danmakuWrapper);
        wrapper && wrapper.remove();
        wrapper = document.createElement('div');
        wrapper.id = eleIds.danmakuWrapper;
        wrapper.style.position = 'fixed';
        wrapper.style.width = '100%';
        wrapper.style.height = `calc(${lsGetItem(lsKeys.heightRate.id) * 100}% - ${wrapperTop}px)`;
        // wrapper.style.opacity = lsGetItem(lsKeys.fontOpacity.id); // 弹幕整体透明度
        wrapper.style.top = wrapperTop + 'px';
        wrapper.style.pointerEvents = 'none';
        _container.prepend(wrapper);
        let _speed = 144 * lsGetItem(lsKeys.speed.id);
        window.ede.danmaku = new Danmaku({
            container: wrapper,
            media: _media,
            comments: _comments,
            engine: lsGetItem(lsKeys.engine.id),
            speed: _speed,
        });
        lsGetItem(lsKeys.switch.id) ? window.ede.danmaku.show() : window.ede.danmaku.hide();
        if (window.ede.ob) {
            window.ede.ob.disconnect();
        }
        window.ede.ob = new ResizeObserver(() => {
            if (window.ede.danmaku) {
                console.log('Resizing');
                window.ede.danmaku.resize();
            }
        });
        window.ede.ob.observe(_container);
        // 自定义的 initH5VideoAdapter 下,解决暂停时暂停的弹幕再次加载会自动恢复问题
        if (!_media.src) {
            require(['playbackManager'], (playbackManager) => {
                if (playbackManager.getPlayerState().PlayState.IsPaused) {
                    _media.dispatchEvent(new Event('pause'));
                }
            });
        }
        // 设置弹窗内的弹幕信息
        buildCurrentDanmakuInfo(currentDanmakuInfoContainerId);
        appendvideoOsdDanmakuInfo(_comments.length);
    }

    function loadDanmaku(loadType = LOAD_TYPE.CHECK) {
        if (window.ede.loading) {
            console.log('正在重新加载');
            return;
        }
        window.ede.loading = true;
        getEpisodeInfo(loadType !== LOAD_TYPE.SEARCH)
            .then((info) => {
                return new Promise((resolve, reject) => {
                    if (!info) {
                        if (loadType !== LOAD_TYPE.INIT) {
                            reject('播放器未完成加载');
                        } else {
                            reject(null);
                        }
                    }
                    if (
                        loadType !== LOAD_TYPE.SEARCH &&
                        loadType !== LOAD_TYPE.REFRESH &&
                        loadType !== LOAD_TYPE.RELOAD &&
                        loadType !== LOAD_TYPE.INIT &&
                        window.ede.danmaku &&
                        window.ede.episode_info &&
                        window.ede.episode_info.episodeId == info.episodeId
                    ) {
                        reject('当前播放视频未变动');
                    } else {
                        window.ede.episode_info = info;
                        resolve(info.episodeId);
                    }
                });
            })
            .then(
                (episodeId) => {
                    if (episodeId) {
                        if (loadType === LOAD_TYPE.RELOAD && window.ede.danmuCache[episodeId]) {
                            createDanmaku(window.ede.danmuCache[episodeId])
                                .then(() => {
                                    console.log('弹幕就位');
                                })
                                .catch((err) => {
                                    console.log(err);
                                });
                        } else {
                            fetchComment(episodeId).then((comments) => {
                                window.ede.danmuCache[episodeId] = comments;
                                createDanmaku(comments)
                                    .then(() => {
                                        console.log('弹幕就位');
                                        // embyToast({ text: `弹幕就位,已获取 ${comments.length} 条弹幕` });
                                    })
                                    .catch((err) => {
                                        console.log(err);
                                    });
                            });
                        }
                    }
                },
                (msg) => {
                    if (msg) {
                        console.log(msg);
                    }
                },
            )
            .then(() => {
                window.ede.loading = false;
                const danmakuCtrEle = getById(eleIds.danmakuCtr);
                if (danmakuCtrEle && danmakuCtrEle.style.opacity !== '1') {
                    danmakuCtrEle.style.opacity = '1';
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    function danmakuFilter(comments) {
        let _comments = [...comments];
        _comments = danmakuTypeFilter(_comments);
        _comments = danmakuSourceFilter(_comments);
        _comments = danmakuDensityLevelFilter(_comments);
        _comments = danmakuKeywordsFilter(_comments);
        return _comments;
    }

    /** 过滤弹幕类型 */
    function danmakuTypeFilter(comments) {
        let idArray = lsGetItem(lsKeys.typeFilter.id);
        // 彩色过滤,只留下默认的白色
        if (idArray.includes(danmakuTypeFilterOpts.onlyWhite.id)) {
            comments = comments.filter(c => '#ffffff' === c.style.color.toLowerCase().slice(0, 7));
            idArray.splice(idArray.indexOf(danmakuTypeFilterOpts.onlyWhite.id), 1);
        }
        // 过滤特定模式的弹幕
        if (idArray.length > 0) {
            comments = comments.filter(c => !idArray.includes(c.mode));
        }
        return comments;
    }

    /** 过滤弹幕来源平台 */
    function danmakuSourceFilter(comments) {
        return comments.filter(c => !(lsGetItem(lsKeys.sourceFilter.id).includes(c.source)));
    }

    /** 过滤弹幕密度等级,水平和垂直 */
    function danmakuDensityLevelFilter(comments) {
        let level = lsGetItem(lsKeys.filterLevel.id);
        if (level == 0) {
            return comments;
        }
        let limit = 9 - level * 2;
        let vertical_limit = 6;
        let arr_comments = [];
        let vertical_comments = [];
        for (let index = 0; index < comments.length; index++) {
            let element = comments[index];
            let i = Math.ceil(element.time);
            let i_v = Math.ceil(element.time / 3);
            if (!arr_comments[i]) {
                arr_comments[i] = [];
            }
            if (!vertical_comments[i_v]) {
                vertical_comments[i_v] = [];
            }
            // TODO: 屏蔽过滤
            if (vertical_comments[i_v].length < vertical_limit) {
                vertical_comments[i_v].push(element);
            } else {
                element.mode = 'rtl';
            }
            if (arr_comments[i].length < limit) {
                arr_comments[i].push(element);
            }
        }
        return arr_comments.flat();
    }

    /** 通过屏蔽关键词过滤弹幕 */
    function danmakuKeywordsFilter(comments) {
        if (!lsGetItem(lsKeys.filterKeywordsEnable.id)) { return comments; }
        const keywords = lsGetItem(lsKeys.filterKeywords.id)
            ?.split(/\r?\n/).map(k => k.trim()).filter(k => k.length > 0 && !k.startsWith('// '));
        if (keywords.length === 0) { return comments; }
        const cKeys = [ 'text', ...Object.keys(showSource) ];
        return comments.filter(comment =>
            !keywords.some(keyword => {
                try {
                    return cKeys.some(key => new RegExp(keyword).test(comment[key]));
                } catch (error) {
                    return cKeys.some(key => comment[key].includes(keyword));
                }
            })
        );
    }

    function danmakuParser($obj) {
        //const fontSize = Number(values[2]) || 25
        // 弹幕大小
        const fontSizeRate = lsGetItem(lsKeys.fontSizeRate.id);
        let fontSize = 25;
        const h3Ele = document.querySelector('.videoOsdTitle');
        if (h3Ele) {
            fontSize = parseFloat(getComputedStyle(h3Ele).fontSize.replace('px', '')) * fontSizeRate;
        } else {
            fontSize = Math.round(
                (window.screen.height > window.screen.width 
                    ? window.screen.width 
                    : window.screen.height / 1080) * 18 * fontSizeRate
            );
        }
        // 弹幕透明度
        const fontOpacity = Math.round(lsGetItem(lsKeys.fontOpacity.id) * 255).toString(16);
        // 时间轴偏移秒数
        const timelineOffset = lsGetItem(lsKeys.timelineOffset.id);
        const sourceUidReg = /\[(.*)\](.*)/;
        const showSourceIds = lsGetItem(lsKeys.showSource.id);
        //const $xml = new DOMParser().parseFromString(string, 'text/xml')
        return $obj
            .map(($comment) => {
                const p = $comment.p;
                //if (p === null || $comment.childNodes[0] === undefined) return null;
                const values = p.split(',');
                const mode = { 6: 'ltr', 1: 'rtl', 5: 'top', 4: 'bottom' }[values[1]];
                if (!mode) return null;
                // 弹幕颜色+透明度
                const color = `000000${Number(values[2]).toString(16)}${fontOpacity}`.slice(-8);
                const cmt = {
                    text: $comment.m,
                    mode,
                    time: values[0] * 1 + timelineOffset,
                    style: {
                        fontSize: `${fontSize}px`,
                        color: `#${color}`,
                        textShadow:
                            color === '00000' ? '-1px -1px #fff, -1px 1px #fff, 1px -1px #fff, 1px 1px #fff' : '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000',

                        font: `${fontSize}px sans-serif`,
                        fillStyle: `#${color}`,
                        strokeStyle: color === '000000' ? `#ffffff${fontOpacity}` : `#000000${fontOpacity}`,
                        lineWidth: 2.0,
                    }, // 以下为自定义属性
                    [showSource.cid.id]: $comment.cid,
                    [showSource.source.id]: values[3].match(sourceUidReg)?.[1] || danmakuSource.DanDanPlay.id,
                    [showSource.originalUserId.id]: values[3].match(sourceUidReg)?.[2] || values[3],
                };
                if (showSourceIds.length > 0) {
                    cmt.originalText = cmt.text;
                    cmt.text += showSourceIds.map(id => id === showSource.source.id ? `,[${cmt[id]}]` : ',' + cmt[id]).join('');
                }
                cmt.cuid = cmt[showSource.cid.id] + ',' + cmt[showSource.originalUserId.id];
                return cmt;
            })
            .filter((x) => x)
            .sort((a, b) => a.time - b.time);
    }

    function toastByDanmaku(text, type) {
        text = toastPrefixes.system + text;
        const fontSize = parseFloat(getComputedStyle(document.querySelector('.videoOsdTitle'))
            .fontSize.replace('px', '')) * 1.5;
        const color = colors[type];
        const dandanplayMode = 5;
        const time = document.querySelector(mediaQueryStr).currentTime;
        const fontOpacity = 'ff';
        const colorStr = `000000${color.toString(16)}${fontOpacity}`.slice(-8);
        const mode = { 6: 'ltr', 1: 'rtl', 5: 'top', 4: 'bottom' }[dandanplayMode];
        const comment = {
            text,
            mode,
            time,
            style: {
                fontSize: `${fontSize}px`,
                color: `#${colorStr}`,
                textShadow:
                    colorStr === '00000' ? '-1px -1px #fff, -1px 1px #fff, 1px -1px #fff, 1px 1px #fff' : '-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000',

                font: `${fontSize}px sans-serif`,
                fillStyle: `#${colorStr}`,
                strokeStyle: colorStr === '000000' ? `#ffffff${fontOpacity}` : `#000000${fontOpacity}`,
                lineWidth: 2.0,
            }, // emit 无法添加自定义属性
        };
        window.ede.danmaku.emit(comment);
    }

    function createDialog() {
        const html = `<div id="${eleIds.dialogContainer}"></div>`;
        embyDialog({ html, buttons: [{ name: '关闭' }] });
        waitForElement('#' + eleIds.dialogContainer, afterEmbyDialogCreated);
    }

    async function afterEmbyDialogCreated(dialogContainer) {
        require([
            'css!modules/emby-elements/emby-textarea/emby-textarea.css',
            'css!modules/emby-elements/emby-select/emby-select.css',
            'css!modules/emby-elements/emby-checkbox/emby-checkbox.css',
        ]);
        const itemInfoMap = await getMapByEmbyItemInfo();
        if (itemInfoMap) {
            window.ede.searchDanmakuOpts = {
                _id_key: itemInfoMap._id_key,
                _name_key: itemInfoMap._name_key,
                _episode_key: itemInfoMap._episode_key,
                animeId: itemInfoMap.animeId,
                animeName: itemInfoMap.animeName,
                seriesOrMovieId: itemInfoMap.seriesOrMovieId,
                episode: (parseInt(itemInfoMap.episode) || 1) - 1, // convert to index
                animes: [],
            }
        }
        let formDialogHeader = document.querySelector('.formDialogHeader');
        const formDialogFooter = document.querySelector('.formDialogFooter');
        formDialogHeader = formDialogHeader || dialogContainer;
        const tabsMenuContainer = document.createElement('div');
        tabsMenuContainer.className = embyTabsMenuClass;
        tabsMenuContainer.append(embyTabs(danmakuTabOpts, danmakuTabOpts[0].id, 'id', 'name', (value) => {
            danmakuTabOpts.forEach(obj => {
                const elem = getById(obj.id);
                if (elem) { elem.hidden = obj.id !== value.id; }
            });
        }));
        formDialogHeader.append(tabsMenuContainer);
        formDialogHeader.style = 'width: 100%; padding: 0; height: auto;';

        danmakuTabOpts.forEach((tab, index) => {
            const tabContainer = document.createElement('div');
            tabContainer.id = tab.id;
            tabContainer.style.textAlign = 'left';
            tabContainer.hidden = index != 0;
            dialogContainer.append(tabContainer);
            try {
                tab.buildMethod(tab.id);
            } catch (error) {
                console.error(error);
            }
        });
        if (formDialogFooter) {
            formDialogFooter.style.padding = '0.3em';
        }
    }

    function buildDanmakuSetting(containerId) {
        const container = getById(containerId);
        let template =  `
            <div style="display: flex; justify-content: center;">
                <div>
                    <div id="${eleIds.danmakuSwitchDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">${lsKeys.switch.name} </label>
                    </div>
                    <div id="${eleIds.danmakuChConverDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">${lsKeys.chConvert.name}: </label>
                    </div>
                    <div id="${eleIds.danmakuEngineDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">${lsKeys.engine.name}: </label>
                    </div>
                    <label class="${embyLabelClass}">弹幕样式: </label>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">${lsKeys.fontSizeRate.name}: </label>
                        <div id="${eleIds.danmakuSizeDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuSizeLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">${lsKeys.fontOpacity.name}: </label>
                        <div id="${eleIds.danmakuOpacityDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuOpacityLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">${lsKeys.speed.name}: </label>
                        <div id="${eleIds.danmakuSpeedDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuSpeedLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">${lsKeys.timelineOffset.name}: </label>
                        <div id="${eleIds.timelineOffsetDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.timelineOffsetLabel}" style="width:4em;"></label>
                    </div>
                    <div id="${eleIds.settingsCtrl}" style="margin: 0.6em 0;"></div>
                    <textarea id="${eleIds.settingsText}" style="display: none;resize: vertical;width: 100%" rows="20" 
                        is="emby-textarea" class="txtOverview emby-textarea"></textarea>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();

        getById(eleIds.danmakuSwitchDiv, container).prepend(
            embyButton({ id: eleIds.danmakuSwitch, label: '弹幕开关'
                , iconKey: lsGetItem(lsKeys.switch.id) ? iconKeys.switch_on : iconKeys.switch_off
                , style: (lsGetItem(lsKeys.switch.id) ? 'color:#52b54b;' : '') + 'font-size:1.5em;padding:0;' }
                // , style: lsGetItem(lsKeys.switch.id) ? 'color:#52b54b;font-size:1.5em;padding:0;': 'font-size:1.5em;padding:0;'}
                , doDanmakuSwitch)
        );
        getById(eleIds.danmakuChConverDiv, container).append(
            embyTabs(danmakuChConverOpts, window.ede.chConvert, 'id', 'name', doDanmakuChConverChange)
        );
        getById(eleIds.danmakuEngineDiv, container).append(
            embyTabs(danmakuEngineOpts, lsGetItem(lsKeys.engine.id), 'id', 'name', doDanmakuEngineSelect)
        );
        // 滑块
        const fontSizeRate = lsGetItem(lsKeys.fontSizeRate.id);
        const fontOpacity = lsGetItem(lsKeys.fontOpacity.id);
        const danmakuSpeed = lsGetItem(lsKeys.speed.id);
        const sizeSlider = embySlider({ labelId: eleIds.danmakuSizeLabel, key: lsKeys.fontSizeRate.id }
            , { value: fontSizeRate }, onSliderChange, onSliderChangeLabel);
        const alphaSlider = embySlider({ labelId: eleIds.danmakuOpacityLabel, key: lsKeys.fontOpacity.id }
            , { max: 1, value: fontOpacity }, onSliderChange, onSliderChangeLabel);
        const speedSlider = embySlider({ labelId: eleIds.danmakuSpeedLabel, key: lsKeys.speed.id }
            , { value: danmakuSpeed }, onSliderChange, onSliderChangeLabel);
        getById(eleIds.danmakuSizeDiv, container).append(sizeSlider);
        getById(eleIds.danmakuOpacityDiv, container).append(alphaSlider);
        getById(eleIds.danmakuSpeedDiv, container).append(speedSlider);
        // 弹幕时间轴偏移秒数
        const btnContainer = getById(eleIds.timelineOffsetDiv, container);
        const timelineOffsetOpts = { labelId: eleIds.timelineOffsetLabel, key: lsKeys.timelineOffset.id };
        onSliderChangeLabel(lsGetItem(lsKeys.timelineOffset.id), timelineOffsetOpts);
        timeOffsetBtns.forEach(btn => {
            btnContainer.append(embyButton(btn, (e) => {
                if (e.target) {
                    let oldValue = lsGetItem(lsKeys.timelineOffset.id);
                    let newValue = oldValue + (parseFloat(e.target.getAttribute('valueOffset')) || 0);
                    // 如果 offset 为 0,则 newValue 应该设置为 0
                    if (newValue === oldValue) { newValue = 0; }
                    onSliderChange(newValue, timelineOffsetOpts);
                }
            }));
        });
        // 配置 JSON 导入,导出
        buildSettingsBackup(container);
    }

    function buildSettingsBackup(container) {
        const settingsCtrlEle = getById(eleIds.settingsCtrl, container);
        settingsCtrlEle.append(
            embyButton({ label: '配置', iconKey: iconKeys.more }, (e) => {
                const xChecked = !e.target.xChecked;
                e.target.xChecked = xChecked;
                e.target.title = xChecked ? '关闭' : '配置';
                e.target.firstChild.innerHTML = xChecked ? iconKeys.close : iconKeys.more;
                const settingsTextEle = getById(eleIds.settingsText);
                settingsTextEle.style.display = xChecked ? '' : 'none';
                if (xChecked) { settingsTextEle.value = getSettingsJson(2); }
                [eleIds.settingReloadBtn, eleIds.settingsImportBtn].forEach(id => {
                    getById(id).style.display = xChecked ? '' : 'none';
                });
            })
        );
        settingsCtrlEle.append(
            embyButton({ id: eleIds.settingReloadBtn, label: '刷新', iconKey: iconKeys.refresh, style: 'display: none;' }
                , () => getById(eleIds.settingsText).value = getSettingsJson(2))
        );
        settingsCtrlEle.append(
            embyButton({ id: eleIds.settingsImportBtn, label: '应用', iconKey: iconKeys.done, style: 'display: none;' }, () => {
                // const settings = JSON.parse(getById(eleIds.settingsText).value);
                // lsBatchSet(Object.fromEntries(Object.entries(settings).map(([key, valueObj]) => [key, valueObj.value])));
                lsBatchSet(JSON.parse(getById(eleIds.settingsText).value));
                loadDanmaku(LOAD_TYPE.INIT);
                closeEmbyDialog();
            })
        );
    }

    function buildSearchEpisode(containerId) {
        const container = getById(containerId);
        const comments = window.ede.danmuCache[window.ede.episode_info?.episodeId] ?? [];
        let template = `
            <div>
                <div>
                    <label class="${embyLabelClass}">标题: </label>
                    <div id="${eleIds.danmakuSearchNameDiv}" style="display: flex;"></div>
                </div>
                <div id="${eleIds.danmakuEpisodeFlag}" hidden>
                    <div style="display: flex;">
                        <div style="width: 80%;">
                            <label class="${embyLabelClass}">媒体名: </label>
                            <div id="${eleIds.danmakuAnimeDiv}" class="${embySelectWrapperClass}"></div>
                            <label class="${embyLabelClass}">分集名: </label>
                            <div style="display: flex;">
                                <div id="${eleIds.danmakuEpisodeNumDiv}" style="max-width: 90%;" class="${embySelectWrapperClass}"></div>
                                <div id="${eleIds.danmakuEpisodeLoad}"></div>
                            </div>
                        </div>
                        <img id="${eleIds.searchImg}" style="width: 20%;height: 100%;margin: 2%;"
                            loading="lazy" decoding="async" draggable="false" class="coveredImage-noScale"></img>
                        </div>
                    </div>
                <div>
                    <label class="${embyLabelClass}" id="${eleIds.danmakuRemark}"></label>
                </div>
                <div>
                    <h4>匹配源</h4>
                    <div>
                        <div id="${eleIds.currentMatchedDiv}">
                            <label class="${embyLabelClass}">弹弹 play 总量: ${comments.length}</label>
                        </div>
                        <label class="${embyLabelClass}">弹弹 play 附加第三方 url: </label>
                    </div>
                    <div id="${eleIds.extUrlsDiv}"></div>
                </div>
                <div>
                    <h4>附加弹幕</h4>
                    <label class="${embyLabelClass}">弹弹 play 支持解析的第三方 url: </label>
                    <div id="${eleIds.extConmentSearchDiv}" style="display: flex;"></div>
                    <div class="${embyFieldDescClass}">
                        原接口文档说明支持(如A/B/C站),自测另外支持[ 爱奇艺视频, 腾讯视频, 优酷视频, ],不支持[ 芒果 TV, ]
                    </div>
                    <div class="${embyFieldDescClass}">
                        仅[ 爱奇艺视频, ]需要注意网址后不能带 ? 的参数,其余网址带不带都可以
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        const searchNameDiv = getById(eleIds.danmakuSearchNameDiv, container);
        searchNameDiv.append(embyInput({ id: eleIds.danmakuSearchName, value: window.ede.searchDanmakuOpts.animeName, type: 'search' }
            , doDanmakuSearchEpisode));
        searchNameDiv.append(embyButton({ label: '搜索', iconKey: iconKeys.search}, doDanmakuSearchEpisode));
        searchNameDiv.append(embyButton({ label: '切换[原]标题', iconKey: iconKeys.text_format }, doSearchTitleSwtich));
        getById(eleIds.danmakuEpisodeLoad, container).append(
            embyButton({ id: eleIds.danmakuSwitchEpisode, label: '加载弹幕', iconKey: iconKeys.done }, doDanmakuSwitchEpisode)
        );
        const currentMatchedDiv = getById(eleIds.currentMatchedDiv, container);
        currentMatchedDiv.append(
            embyButton({ label: '取消匹配/清空弹幕', iconKey: iconKeys.close }, (e) => {
                if (window.ede.episode_info?.episodeId) {
                    window.ede.episode_info.episodeId = null;
                }
                if (window.ede.danmaku) {
                    createDanmaku([]);
                }
                currentMatchedDiv.querySelector('label').textContent = '弹弹 play 总量: 0';
            })
        );
        // buildExtConment
        const extConmentSearchDiv = getById(eleIds.extConmentSearchDiv, container);
        extConmentSearchDiv.append(embyInput({ type: 'search', placeholder: 'http(s)://' }, onEnterExtConment));
        extConmentSearchDiv.append(embyButton({ label: '搜索', iconKey: iconKeys.search}, onEnterExtConment));
    }

    async function onEnterExtConment(e) {
        const extUrl = e.target.value.trim();
        if (!extUrl.startsWith('http')) { return embyToast({ text: '输入的url错误!' }); }
        let extcomments = window.ede.extConmentCache[extUrl];
        if (!extcomments) {
            extcomments = await fetchExtcommentActual(extUrl);
            extcomments.map(c => c.fromUrl = extUrl);
            window.ede.extConmentCache[extUrl] = extcomments;
        }
        const comments = window.ede.danmuCache[window.ede.episode_info?.episodeId] ?? [];
        let allComments = comments.concat(...Object.values(window.ede.extConmentCache));
        createDanmaku(allComments)
        .then(() => {
            const beforeLength = window.ede.commentsParsed.length - extcomments.length;
            embyToast({ text: `此次附加总量: ${extcomments.length}, 附加前总量: ${beforeLength}, 附加后总量: ${allComments.length}` });
            console.log(`附加弹幕就位, 附加前总量: ${beforeLength}`);
            /* const currentMatchedDiv = getById(eleIds.currentMatchedDiv, container);
            if (comments && !currentMatchedDiv.querySelector('button')) {
                currentMatchedDiv.prepend(
                    embyButton({ label: '清空此加载', iconKey: iconKeys.close }, (e) => {
                        const xChecked = !e.target.xChecked;
                        allComments = (xChecked ? [] : comments).concat(...Object.values(window.ede.extConmentCache));
                        if (allComments.length > 0) {
                            e.target.xChecked = xChecked;
                            e.target.title = xChecked ? '还原' : '清空此加载';
                            e.target.firstChild.innerHTML = xChecked ? iconKeys.refresh : iconKeys.close;
                            createDanmaku(allComments);
                        }
                        // 不允许清空所有弹幕,历史遗留将导致多处报错
                    })
                );
            } */
            const extUrlsDiv = getById(eleIds.extUrlsDiv, container);
            extUrlsDiv.innerHTML = '';
            Object.entries(window.ede.extConmentCache).map(([key, val]) => {
                const extUrlDiv = document.createElement('div');
                extUrlDiv.append(embyButton({ label: '清空此加载', iconKey: iconKeys.close }, (e) => {
                    delete window.ede.extConmentCache[key];
                    e.target.parentNode.remove();
                    /* if (Object.keys(window.ede.extConmentCache).length === 0) {
                        const currentMatchedClearBtn = currentMatchedDiv.querySelector('button');
                        if (currentMatchedClearBtn) {
                            currentMatchedClearBtn.remove();
                            if (currentMatchedClearBtn.firstChild.textContent === iconKeys.refresh) {
                                currentMatchedClearBtn.click();
                            }
                        }
                    } */
                    createDanmaku(allComments.filter(c => c.fromUrl !== key));
                }));
                extUrlDiv.append(embyALink(key), document.createTextNode(` 总量: ${val.length}`));
                extUrlsDiv.append(extUrlDiv);
            });
        })
        .catch(err => console.log(err));
    }

    function buildCurrentDanmakuInfo(containerId) {
        const container = getById(containerId);
        if (!container || !window.ede.episode_info) { return; }
        const { episodeTitle, animeId, animeTitle } = window.ede.episode_info;
        const loadSum = getDanmakuComments(window.ede).length;
        const downloadSum = window.ede.commentsParsed.length;
        let template = `
            <div id="${eleIds.osdTitleEnableDiv}"></div>
            <div style="display: flex;">
                <div id="${eleIds.posterImgDiv}"></div>
                <div>
                    <div>
                        <label class="${embyLabelClass}">媒体名: </label>
                        <div class="${embyFieldDescClass}">${animeTitle}</div>
                    </div>
                    ${!episodeTitle ? '' :
                    `<div>
                        <label class="${embyLabelClass}">分集名: </label>
                        <div class="${embyFieldDescClass}">${episodeTitle}</div>
                    </div>`}
                    <div>
                        <label class="${embyLabelClass}">其它信息: </label>
                        <div class="${embyFieldDescClass}">
                            获取总数: ${downloadSum}, 
                            加载总数: ${loadSum}, 
                            被过滤数: ${downloadSum - loadSum}
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 2%;">
                <label class="${embyLabelClass}">${lsKeys.danmuList.name}: </label>
                <div id="${eleIds.danmuListDiv}" style="margin: 1% 0;"></div>
                <textarea id="${eleIds.danmuListText}" readOnly style="display: none;resize: vertical;width: 100%" rows="8" 
                    is="emby-textarea" class="txtOverview emby-textarea"></textarea>
            </div>
            <div id="${eleIds.extInfoCtrlDiv}" style="margin: 0.6em 0;"></div>
            <div id="${eleIds.extInfoDiv}" hidden>
                <label class="${embyLabelClass}">Bangumi 角色介绍: </label>
                <div style="${embySliderStyle + 'margin: 0.8em 0;'}">
                    <label class="${embyLabelClass}" style="width:7em;">角色图片高度: </label>
                    <div id="${eleIds.characterImgHeihtDiv}" style="width: 36.5em; text-align: center;"></div>
                    <label><label id="${eleIds.characterImgHeihtLabel}" style="width:4em;"></label>
                    <label>em</label></label>
                </div>
                <div id="${eleIds.charactersDiv}" style="display: flex; flex-wrap: wrap; gap: .5em;"></div>
            </div>
        `;
        container.innerHTML = template.trim();
        const osdTitleEnableDiv = getById(eleIds.osdTitleEnableDiv, container);
        osdTitleEnableDiv.append(embyCheckbox(
            { label: lsKeys.osdTitleEnable.name }, lsGetItem(lsKeys.osdTitleEnable.id), (checked) => {
                lsSetItem(lsKeys.osdTitleEnable.id, checked);
                const videoOsdContainer = document.querySelector(`${mediaContainerQueryStr} .videoOsdSecondaryText`);
                let videoOsdDanmakuTitle = getById(eleIds.videoOsdDanmakuTitle, videoOsdContainer);
                if (videoOsdDanmakuTitle) {
                    videoOsdDanmakuTitle.style.display = checked ? 'block' : 'none';
                } else if (checked) {
                    appendvideoOsdDanmakuInfo(loadSum);
                }
            }
        ));
        if (animeId) {
            getById(eleIds.posterImgDiv, container).append(
                embyImgButton(embyImg(dandanplayApi.posterImg(animeId)), 'width: calc((var(--videoosd-tabs-height) - 3em) * (2 / 3)); margin-right: 1em;')
            );
        }
        const danmuListExts = Object.values(window.ede.extConmentCache).map((value, index) => {
            return { id: `ext${index + 1}`, name: `附加${index + 1}`, onChange: () => danmakuParser(value) };
        });
        getById(eleIds.danmuListDiv, container).append(
            embyTabs(danmuListOpts.concat(danmuListExts), lsKeys.danmuList.defaultValue, 'id', 'name', doDanmuListOptsChange)
        );
        // 额外信息
        buildExtInfo(container);
    }

    function buildExtInfo(container) {
        getById(eleIds.characterImgHeihtDiv, container).append(embySlider(
            { labelId: eleIds.characterImgHeihtLabel, }, { value: '12', min: 12, max: 100, step: 1 }
            , null, (val, props) => {
                if (val === '12') { val = 'auto'; }
                onSliderChangeLabel(val, props);
                Array.from(getById(eleIds.charactersDiv).children)
                    .map(c => c.style.height = val === 'auto' ? val : val + 'em');
            }
        ));
        const extInfoCtrlDiv = getById(eleIds.extInfoCtrlDiv, container);
        extInfoCtrlDiv.append(
            embyButton({ label: '额外信息', iconKey: iconKeys.more }, (e) => {
                const xChecked = !e.target.xChecked;
                e.target.xChecked = xChecked;
                e.target.title = xChecked ? '关闭' : '额外信息';
                e.target.firstChild.innerHTML = xChecked ? iconKeys.close : iconKeys.more;
                const extInfoDiv = getById(eleIds.extInfoDiv);
                extInfoDiv.hidden = !xChecked;
                const charactersDiv = getById(eleIds.charactersDiv);
                if (charactersDiv.firstChild) { return; }
                if (window.ede.bangumiInfo?.characters && window.ede.bangumiInfo.animeId === window.ede.episode_info.animeId) {
                    return renderBangumiCharacters(charactersDiv, window.ede.bangumiInfo.characters);
                }
                getEpisodeBangumiRel().then(bangumiInfo => {
                    return fetchJson(bangumiApi.getCharacters(bangumiInfo.subjectId));
                }).then(characters => {
                    window.ede.bangumiInfo.characters = characters;
                    renderBangumiCharacters(charactersDiv, characters);
                });
                function renderBangumiCharacters(container, characters) {
                    characters.map(c => {
                        const characterDiv = document.createElement('div');
                        characterDiv.style = 'width: 32%; display: flex; gap: .5em;';
                        let embyImgButtonInner = embyImg(c.images.large, 'object-position: top;');
                        if (!c.images.large) {
                            embyImgButtonInner = embyI(iconKeys.person, 'cardImageIcon');
                        }
                        characterDiv.append(embyImgButton(embyImgButtonInner));
                        const characterRightDiv = document.createElement('div');
                        const characterNameDiv = document.createElement('div');
                        characterNameDiv.textContent = c.relation + ': ' + c.name;
                        characterRightDiv.append(characterNameDiv);
                        const characterCvDiv = document.createElement('div');
                        characterCvDiv.textContent = 'CV: ' + c.actors.map(a => a.name).join();
                        if (c.actors[0]) {
                            characterCvDiv.append(embyImgButton(embyImg(c.actors[0].images.large)));
                        }
                        characterRightDiv.append(characterCvDiv);
                        characterDiv.append(characterRightDiv);
                        container.append(characterDiv);
                    });
                }
            })
        );
    }

    function buildDanmakuFilter(containerId) {
        const container = getById(containerId);
        let template = `
            <div>
                <div id="${eleIds.danmakuTypeFilterDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">${lsKeys.typeFilter.name}: </label>
                </div>
                <div id="${eleIds.danmakuSourceFilterDiv}">
                    <label class="${embyLabelClass}">${lsKeys.sourceFilter.name}: </label>
                </div>
                <div id="${eleIds.danmakuShowSourceDiv}">
                    <label class="${embyLabelClass}">${lsKeys.showSource.name}: </label>
                </div>
                <div id="${eleIds.danmakuFilterLevelDiv}">
                    <label class="${embyLabelClass}">${lsKeys.filterLevel.name}: </label>
                </div>
                <div id="${eleIds.danmakuHeightRateDiv}">
                    <label class="${embyLabelClass}">${lsKeys.heightRate.name}: </label>
                </div>
                <div id="${eleIds.filterKeywordsDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">${lsKeys.filterKeywords.name}: </label>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();

        getById(eleIds.danmakuTypeFilterDiv, container).append(
            embyCheckboxList(null, eleIds.danmakuTypeFilterSelectName
                , lsGetItem(lsKeys.typeFilter.id), Object.values(danmakuTypeFilterOpts).filter(o => !o.hidden)
                , doDanmakuTypeFilterSelect)
        );
        getById(eleIds.danmakuSourceFilterDiv, container).append(
            embyCheckboxList(null, eleIds.danmakuSourceFilterSelectName
                , lsGetItem(lsKeys.sourceFilter.id), Object.values(danmakuSource), doDanmakuSourceFilterSelect)
        );
        getById(eleIds.danmakuShowSourceDiv, container).append(
            embyCheckboxList(null, eleIds.danmakuShowSourceSelectName
                , lsGetItem(lsKeys.showSource.id), Object.values(showSource), doDanmakuShowSourceSelect)
        );
        getById(eleIds.danmakuFilterLevelDiv, container).append(
            embyTabs(danmakuFilterLevelOpts, lsGetItem(lsKeys.filterLevel.id), 'id', 'name', (value) => {
                if (lsCheckSet(lsKeys.filterLevel.id, parseInt(value.id))) { loadDanmaku(LOAD_TYPE.RELOAD); }
            })
        );
        getById(eleIds.danmakuHeightRateDiv, container).append(
            embyTabs(danmakuHeightRateOpts, lsGetItem(lsKeys.heightRate.id) , 'id', 'name', (value) => {
                if (lsCheckSet(lsKeys.heightRate.id, value.id)) { loadDanmaku(LOAD_TYPE.RELOAD); }
            })
        );
        // 屏蔽关键词
        const keywordsContainer = getById(eleIds.filterKeywordsDiv, container);
        const keywordsEnableDiv = keywordsContainer.appendChild(document.createElement('div'));
        const keywordsBtn = embyButton({ label: '加载关键词过滤', iconKey: iconKeys.done_disabled }, doDanmakuFilterKeywordsBtnClick);
        keywordsBtn.disabled = true;
        keywordsEnableDiv.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; width: 100%;');
        keywordsEnableDiv.append(embyCheckbox(
            { id: eleIds.filterKeywordsEnableId, label: lsKeys.filterKeywordsEnable.name.replace(lsKeys.filterKeywords.name, '') }
            , lsGetItem(lsKeys.filterKeywordsEnable.id), (flag) => updateFilterKeywordsBtn(keywordsBtn, flag
                , getById(eleIds.filterKeywordsId).value.trim()))
        );
        keywordsEnableDiv.appendChild(document.createElement('div')).appendChild(keywordsBtn);
        keywordsContainer.appendChild(document.createElement('div')).appendChild(
            embyTextarea({id: eleIds.filterKeywordsId, value: lsGetItem(lsKeys.filterKeywords.id)
                , style: 'width: 100%;margin-top: 0.2em;', rows: 8}, (event) => updateFilterKeywordsBtn(keywordsBtn
                , getById(eleIds.filterKeywordsEnableId).checked, event.target.value.trim()))
        );
        const label = document.createElement('label');
        label.innerText = `关键词/正则匹配过滤,支持过滤[正文,${Object.values(showSource).map(o => o.name).join()}],多个表达式用换行分隔`;
        label.className = embyFieldDescClass;
        keywordsContainer.appendChild(document.createElement('div')).appendChild(label);
    }

    function buildExtSetting(containerId) {
        const container = getById(containerId);
        let template =  `
            <div>
                <h4>播放设置</h4>
                <div>
                    <label class="${embyLabelClass}">单次定时执行: </label>
                    <div id="${eleIds.timeoutCallbackTypeDiv}"></div>
                    <label class="${embyLabelClass}">定时单位: </label>
                    <div id="${eleIds.timeoutCallbackUnitDiv}"></div>
                    <div style="${embySliderStyle + 'margin-top: 0.3em;'}">
                        <label class="${embyLabelClass}" style="width:4em;">${lsKeys.timeoutCallbackValue.name}: </label>
                        <div id="${eleIds.timeoutCallbackDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.timeoutCallbackLabel}" style="width:4em;"></label>
                    </div>
                </div>
                <div>
                    <h4>Bangumi 设置</h4>
                    <div>
                        <label id="${eleIds.bangumiEnableLabel}" class="${embyLabelClass}"></label>
                        <di id="${eleIds.bangumiSettingsDiv}">
                            <div id="${eleIds.bangumiTokenInputDiv}" style="display: flex;" ></div>
                            <div id="${eleIds.bangumiTokenLabel}" class="${embyFieldDescClass}"></div>
                            <div class="${embyFieldDescClass}">
                                你可以在以下链接生成一个 Access Token
                            </div>
                            <div id="${eleIds.bangumiTokenLinkDiv}" style="padding-bottom: 0.5em;"></div>
                            <label class="${embyLabelClass}">自动更新单章节收藏信息: </label>
                            <div style="${embySliderStyle}">
                                <label class="${embyLabelClass}" style="width:4em;">${lsKeys.bangumiPostPercent.name}: </label>
                                <div id="${eleIds.bangumiPostPercentDiv}" style="width: 15.5em; text-align: center;"></div>
                                <label><label id="${eleIds.bangumiPostPercentLabel}" style="width:4em;"></label>
                                <label>%</label></label>
                            </div>
                            <div class="${embyFieldDescClass}">
                                触发时机为正常停止播放,且播放进度超过设定百分比时;<br>
                                同步的媒体信息为自动匹配而来,可在“弹幕信息”中查看;<br>
                                自动匹配有误可“手动匹配”,仍无法匹配可点击按钮X“取消匹配/清除弹幕”<br>则此单章节不会同步。
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        // 播放设置
        buildPlaySetting(container);
        // Bangumi设置
        buildBangumiSetting(container);
    }

    function buildPlaySetting(container) {
        const btnContainer = getById(eleIds.timeoutCallbackDiv, container);
        const timeoutCallbacktOpts = { labelId: eleIds.timeoutCallbackLabel, key: lsKeys.timeoutCallbackValue.id };
        onSliderChangeLabel(lsGetItem(lsKeys.timeoutCallbackValue.id), timeoutCallbacktOpts);
        timeOffsetBtns.forEach(btn => {
            btnContainer.append(embyButton(btn, (e) => {
                if (e.target) {
                    let oldValue = lsGetItem(lsKeys.timeoutCallbackValue.id);
                    let newValue = oldValue + (parseFloat(e.target.getAttribute('valueOffset')) || 0);
                    if (newValue === oldValue || newValue < 0) { newValue = 0; }
                    onSliderChange(newValue, timeoutCallbacktOpts, false);
                }
            }));
        });
        getById(eleIds.timeoutCallbackUnitDiv, container).append(
            embyTabs(timeoutCallbackUnitOpts, lsGetItem(lsKeys.timeoutCallbackUnit.id), 'id', 'name', (value, index) => {
                lsSetItem(lsKeys.timeoutCallbackUnit.id, index);
            })
        );
        getById(eleIds.timeoutCallbackTypeDiv, container).append(
            embyTabs(timeoutCallbackTypeOpts, timeoutCallbackTypeOpts[0].id, 'id', 'name', (value) => {
                const unitObj = timeoutCallbackUnitOpts[lsGetItem(lsKeys.timeoutCallbackUnit.id)];
                value.onChange(lsGetItem(lsKeys.timeoutCallbackValue.id) * unitObj.msRate);
            })
        );
    }

    function buildBangumiSetting(container) {
        const bangumiSettingsDiv = getById(eleIds.bangumiSettingsDiv, container);
        const bangumiEnable = lsGetItem(lsKeys.bangumiEnable.id);
        bangumiSettingsDiv.hidden = !bangumiEnable;
        const bangumiEnableLabel = getById(eleIds.bangumiEnableLabel, container);
        bangumiEnableLabel.append(embyCheckbox(
            { label: lsKeys.bangumiEnable.name }, bangumiEnable, (checked) => {
                lsSetItem(lsKeys.bangumiEnable.id, checked);
                bangumiSettingsDiv.hidden = !checked;
            }
        ));
        const bangumiTokenInputDiv = getById(eleIds.bangumiTokenInputDiv, container);
        bangumiTokenInputDiv.append(embyInput({ id: eleIds.bangumiTokenInput, type: 'password', value: lsGetItem(lsKeys.bangumiToken.id) }, onEnterBangumiToken));
        bangumiTokenInputDiv.append(embyButton({ label: '校验', iconKey: iconKeys.check}, onEnterBangumiToken));
        getById(eleIds.bangumiPostPercentDiv, container).append(embySlider(
            { labelId: eleIds.bangumiPostPercentLabel, key: lsKeys.bangumiPostPercent.id }
            , { value: lsGetItem(lsKeys.bangumiPostPercent.id), min: 1, max: 100, step: 1 }
            , (val, props) => { onSliderChange(val, props, false) }, onSliderChangeLabel
        ));
        const bangumiTokenLinkDiv = getById(eleIds.bangumiTokenLinkDiv, container);
        bangumiTokenLinkDiv.append(embyALink(bangumiApi.accessTokenUrl, bangumiApi.accessTokenUrl));
    }

    function onEnterBangumiToken(e) {
        const bangumiToken = getById(eleIds.bangumiTokenInput).value.trim();
        lsSetItem(lsKeys.bangumiToken.id, bangumiToken);
        const label = getById(eleIds.bangumiTokenLabel);
        fetchJson(bangumiApi.getMyself(), { token: bangumiToken }).then(res => {
            label.innerText = 'Bangumi Token 验证成功';
            label.style.color = 'green';
            console.log('bangumiApi.getMyself()', res);
            // if (res) { embyToast({ text: 'Bangumi Token 验证成功' }); }
        }).catch((error) => {
            label.innerText = 'Bangumi Token 验证失败';
            label.style.color = 'red';
        });
    }

    function buildAbout(containerId) {
        const container = getById(containerId);
        if (!container) { return; }
        const template = `
            <div id="${eleIds.consoleLogCtrl}"></div>
            <textarea id="${eleIds.consoleLogText}" readOnly style="resize: vertical;margin-top: 0.6em;" 
                rows="14" is="emby-textarea" class="txtOverview emby-textarea"></textarea>
            <textarea id="${eleIds.consoleLogTextInput}" hidden style="resize: vertical;" 
                rows="1" is="emby-textarea" class="txtOverview emby-textarea"></textarea>
            <div class="${embyFieldDescClass}">注意开启后原本控制台中调用方信息将被覆盖,不使用请保持关闭状态</div>
            <div id="${eleIds.consoleLogCtrl}"></div>
            <div>
                <h4>开发者选项</h4>
                <label class="${embyLabelClass}">调试开关(不持久化,自行开关): </label>
                <div id="${eleIds.debugCheckbox}"></div>
                <label class="${embyLabelClass}">调试按钮: </label>
                <div id="${eleIds.debugButton}"></div>
            </div>
            <div>
                <h4>开放源代码许可</h4>
                <div style="display: flex; flex-direction: column;" id="${eleIds.openSouceLicenseDiv}"></div>
            </div>
        `;
        // <div class="${embyFieldDescClass}">客户端请勿在播放界面点击超链接,会导致界面错误</div>
        container.innerHTML = template.trim();
        buildConsoleLog(container);
        buildDebugCheckbox(container);
        buildDebugButton(container);
        buildOpenSouceLicense(container);
    }

    function buildConsoleLog(container) {
        const consoleLogEnable = lsGetItem(lsKeys.consoleLogEnable.id);
        const consoleLogTextEle = getById(eleIds.consoleLogText, container);
        consoleLogTextEle.style.display = consoleLogEnable ? '' : 'none';
        if (consoleLogEnable) { doConsoleLogChange(consoleLogEnable); }
        const consoleLogCtrlEle = getById(eleIds.consoleLogCtrl, container);
        consoleLogCtrlEle.append(embyCheckbox({ label: lsKeys.consoleLogEnable.name }, consoleLogEnable, doConsoleLogChange));
        const consoleLogCountLabel = document.createElement('label');
        consoleLogCountLabel.id = eleIds.consoleLogCountLabel;
        consoleLogCtrlEle.append(
            embyButton({ label: '清空', iconKey: iconKeys.block }, () => {
                consoleLogTextEle.value = '';
                getById(eleIds.consoleLogCountLabel).innerHTML = '';
                if (window.ede.appLogAspect) { window.ede.appLogAspect.value = ''; }
            })
            , consoleLogCountLabel
        );
        const consoleLogTextInput = getById(eleIds.consoleLogTextInput, container);
        consoleLogTextInput.style.display = consoleLogEnable && window.ede.debug.on ? '' : 'none';
        consoleLogTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const inputVal = e.target.value.trim();
                console.log('输入内容为: \n', inputVal);
                eval(inputVal);
                e.target.value = '';
            }
        });
    }

    function buildDebugCheckbox(container) {
        const debugWrapper = getById(eleIds.debugCheckbox, container);
        // 尽量接近浏览器控制台选定元素背景色
        const highlightColor  = 'rgba(115, 160, 255, 0.3)';
        debugWrapper.append(embyCheckbox({ label: '弹幕容器边界' }, window.ede.debug.showDanmakuWrapper, (checked) => {
            window.ede.debug.showDanmakuWrapper = checked;
            const wrapper = getById(eleIds.danmakuWrapper);
            wrapper.style.backgroundColor = checked ? highlightColor : '';
            if (!checked) { return; }
            console.log(`弹幕容器(#${eleIds.danmakuWrapper})宽高像素:`, wrapper.offsetWidth, wrapper.offsetHeight);
            const stage = wrapper.firstChild;
            console.log(`实际舞台(${stage.tagName})宽高像素:`, stage.offsetWidth, stage.offsetHeight);
        }));
        debugWrapper.append(embyCheckbox({ label: '按钮容器边界' }, window.ede.debug.showDanmakuCtrWrapper, (checked) => {
            window.ede.debug.showDanmakuCtrWrapper = checked;
            const wrapper = getById(eleIds.danmakuCtr);
            wrapper.style.backgroundColor = checked ? highlightColor : '';
            if (!checked) { return; }
            console.log(`按钮容器(#${eleIds.danmakuCtr})宽高像素:`, wrapper.offsetWidth, wrapper.offsetHeight);
        }));
        debugWrapper.append(embyCheckbox({ label: '屏蔽从右至左' }, window.ede.debug.typeFilterRtl, (checked) => {
            window.ede.debug.typeFilterRtl = checked;
            let comments = [...window.ede.danmuCache[window.ede.episode_info.episodeId]];
            if (checked) {
                comments = comments.filter(c => c.p.split(',')[1] !== '6');
                console.log('已屏蔽从右至左');
            } else {
                console.log('已取消屏蔽从右至左');
            }
            createDanmaku(comments);
        }));
        debugWrapper.append(embyCheckbox({ label: '反转弹幕方向' }, window.ede.debug.reverseDanmu, (checked) => {
            window.ede.debug.reverseDanmu = checked;
            const comments = window.ede.danmuCache[window.ede.episode_info.episodeId];
            comments.map(c => {
                const values = c.p.split(',');
                values[1]= { '6': '1', '1': '6', '5': '4', '4': '5' }[values[1]];
                c.p = values.join();
            });
            console.log('已反转弹幕方向');
            createDanmaku(comments);
        }));
        debugWrapper.append(embyCheckbox({ label: '随机弹幕颜色' }, window.ede.debug.randomDanmuColor, (checked) => {
            window.ede.debug.randomDanmuColor = checked;
            let comments = window.ede.danmuCache[window.ede.episode_info.episodeId];
            if (checked) {
                window.ede.debug.oriComments = structuredClone(comments);
                comments.map(c => {
                    const values = c.p.split(',');
                    values[2] = parseInt(Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'), 16);
                    c.p = values.join();
                });
                console.log('已随机弹幕颜色');
            } else {
                comments = window.ede.debug.oriComments;
                window.ede.danmuCache[window.ede.episode_info.episodeId] = comments;
                console.log('已还原弹幕颜色');
            }
            createDanmaku(comments);
        }));
        if (window.ede.debug.on) { // @deprecated 已废弃,无法登录网站,无太大意义
            debugWrapper.append(embyCheckbox({ label: '打开内嵌网页' }, window.ede.debug.tabIframeEnable, (checked) => {
                window.ede.debug.tabIframeEnable = checked;
                getById(tabIframeId + 'Btn').style.display = checked ? '' : 'none';
            }));
        }
    }

    function buildDebugButton(container) {
        const debugWrapper = getById(eleIds.debugButton, container);
        debugWrapper.append(embyButton({ label: '打印视频加载方' }, () => {
            const _media = document.querySelector(mediaQueryStr);
            if (_media.src) {
                console.log('视频加载方为 Web 端 <video> 标签:', _media.parentNode.outerHTML);
            } else {
                console.log('当前 <video> 标签为虚拟适配器:', _media.outerHTML);
                const _embed = document.querySelector('embed');
                if (_embed) {
                    console.log('视频加载方为 <embed> 标签占位的 Native 播放器:', _embed.parentNode.outerHTML);
                } else {
                    console.log('视频加载方为无占位标签的 Native 播放器,无信息');
                }
            }
        }));
        debugWrapper.append(embyButton({ label: '清空章节引用缓存', class: embyButtonClasses.submit }, () => {
            lsBatchRemove(['_episode_id_rel_', '_bangumi_episode_id_rel_']);
            console.log('已清空章节引用缓存');
            embyToast({ text: '已清空章节引用缓存' });
        }));
        debugWrapper.append(embyButton({ label: '重置设置', class: embyButtonClasses.submit }, () => {
            settingsReset();
            console.log(`已重置设置, 跳过了 ${lsKeys.filterKeywords.name} 重置`);
            embyToast({ text: `已重置设置, 跳过了 ${lsKeys.filterKeywords.name} 重置` });
            loadDanmaku(LOAD_TYPE.INIT);
            closeEmbyDialog();
        }));
    }

    function buildOpenSouceLicense(container) {
        const openSourceWrapper = getById(eleIds.openSouceLicenseDiv, container);
        Object.entries(openSouceLicense).map(([key, val]) => {
            openSourceWrapper.append(embyALink(val.url, [key, val.name, val.version, val.license].join(':')));
        });
    }

    /**
     * @deprecated 已废弃,无法登录网站,无太大意义
     */
    function buildIframe(containerId) {
        const container = getById(containerId);
        const template = `
            <div>
                <div class="${embyFieldDescClass}">注意内嵌网页不支持控制器输入,且被禁止内嵌(CSP)的网页无法显示,且跨域无法登录</div>
                <div style="${embySliderStyle + 'margin: 0.8em 0;'}">
                    <label class="${embyLabelClass}" style="width: 5em;">网页高度: </label>
                    <div id="${eleIds.tabIframeHeightDiv}" style="width: 40.5em; text-align: center;"></div>
                    <label><label id="${eleIds.tabIframeHeightLabel}" style="width:4em;"></label>
                    <label>em</label></label>
                </div>
                <div id="${eleIds.tabIframeCtrlDiv}"></div>
                <div id="${eleIds.tabIframeSrcInputDiv}" style="display: flex; margin-top: 0.6em;"></div>
                <iframe id="${eleIds.tabIframe}" style="border: 0;width: 100%;" src=""></iframe>
            </div>
        `;
        container.innerHTML = template.trim();
        getById(eleIds.tabIframeHeightDiv, container).append(embySlider(
            { labelId: eleIds.tabIframeHeightLabel }, { value: '29', min: 28, max: 100, step: 1 }
            , null, (val, props) => {
                if (val === '28') { val = 'auto'; }
                onSliderChangeLabel(val, props);
                getById(eleIds.tabIframe).style.height = val === 'auto' ? val : val + 'em';
            }
        ));
        getById(eleIds.tabIframeSrcInputDiv, container).append(embyInput(
            { type: 'search', value: window.ede.bangumiInfo?.bangumiUrl ?? '' }
            , (e) => { getById(eleIds.tabIframe).src = e.target.value.trim(); }
        ));
    }

    function appendvideoOsdDanmakuInfo(loadSum) {
        if (!lsGetItem(lsKeys.osdTitleEnable.id)) {
            return;
        }
        const { episodeId, animeTitle, episodeTitle } = window.ede?.episode_info || {};
        const videoOsdContainer = document.querySelector(`${mediaContainerQueryStr} .videoOsdSecondaryText`);
        let videoOsdDanmakuTitle = getById(eleIds.videoOsdDanmakuTitle, videoOsdContainer);
        if (!videoOsdDanmakuTitle) {
            videoOsdDanmakuTitle = document.createElement('h3');
            videoOsdDanmakuTitle.id = eleIds.videoOsdDanmakuTitle;
            videoOsdDanmakuTitle.classList.add('videoOsdTitle');
            videoOsdDanmakuTitle.style = 'margin-left: auto; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; position: absolute; right: 0px; bottom: 0px;';
        }
        let text = '弹幕：';
        if (episodeId) {
            text += `${animeTitle} - ${episodeTitle} - ${loadSum}条`;
        } else {
            text += `未匹配`;
        }
        videoOsdDanmakuTitle.innerText = text;
        if (videoOsdContainer) {
            videoOsdContainer.append(videoOsdDanmakuTitle);
        }
    }

    function toggleSettingBtn2Header() {
        const btnId = 'danmakuSettingBtnDebug';
        const targetBtn = getById(btnId);
        if (targetBtn) {
            targetBtn.remove();
            return false;
        }
        const wrapper = document.querySelector('.headerRight');
        const opt = mediaBtnOpts[1];
        opt.id = btnId;
        wrapper.prepend(embyButton(opt, opt.onClick));
        return true;
    }

    function quickDebug() {
        const flag = toggleSettingBtn2Header();
        embyToast({ text: `快速调试: ${flag}!`, icon: iconKeys.sentiment_very_satisfied });
        if (!window.ede) { window.ede = new EDE(); }
        window.ede.debug.on = flag;
        require(['emby-slider']);
    }
    
    function doDanmakuSwitch() {
        console.log('切换弹幕开关');
        const flag = !lsGetItem(lsKeys.switch.id);
        flag ? window.ede.danmaku?.show() : window.ede.danmaku?.hide();
        const osdDanmakuSwitchBtn = getById(eleIds.danmakuSwitchBtn);
        if (osdDanmakuSwitchBtn) {
            osdDanmakuSwitchBtn.firstChild.innerHTML = flag ? iconKeys.comment : iconKeys.comments_disabled;
        }
        const switchElement = getById(eleIds.danmakuSwitch);
        if (switchElement) {
            switchElement.firstChild.innerHTML = flag ? iconKeys.switch_on : iconKeys.switch_off;
            switchElement.style.color = flag ? '#52b54b' : '';
        }
        lsSetItem(lsKeys.switch.id, flag);
    }

    async function doDanmakuSearchEpisode() {
        let embySearch = getById(eleIds.danmakuSearchName);
        if (!embySearch) { return; }
        let searchName = embySearch.value
        const danmakuRemarkEle = getById(eleIds.danmakuRemark);
        danmakuRemarkEle.innerText = searchName ? '' : '请填写标题';
        const spinnerEle = document.querySelector(".mdl-spinner");
        spinnerEle.classList.remove('hide');
        
        const animaInfo = await fetchSearchEpisodes(searchName);
        spinnerEle.classList.add('hide');
        if (!animaInfo || animaInfo.animes.length < 1) {
            danmakuRemarkEle.innerText = '搜索结果为空';
            getById(eleIds.danmakuSwitchEpisode).disabled = true;
            getById(eleIds.danmakuEpisodeFlag).hidden = true;
            return;
        } else {
            danmakuRemarkEle.innerText = '';
        }
        const danmakuAnimeDiv = getById(eleIds.danmakuAnimeDiv);
        const danmakuEpisodeNumDiv = getById(eleIds.danmakuEpisodeNumDiv);
        danmakuAnimeDiv.innerHTML = '';
        danmakuEpisodeNumDiv.innerHTML = '';
        const animes = animaInfo.animes;
        window.ede.searchDanmakuOpts.animes = animes;

        let selectAnimeIdx = animes.findIndex(anime => anime.animeId == window.ede.searchDanmakuOpts.animeId);
        selectAnimeIdx = selectAnimeIdx !== -1 ? selectAnimeIdx : 0;
        const animeSelect = embySelect({ id: eleIds.danmakuAnimeSelect, label: '剧集: ', style: 'width: auto;max-width: 100%;' }
            , selectAnimeIdx, animes, 'animeId', opt => `${opt.animeTitle} 类型：${opt.typeDescription}`, doDanmakuAnimeSelect);
        danmakuAnimeDiv.append(animeSelect);
        const episodeNumSelect = embySelect({ id: eleIds.danmakuEpisodeNumSelect, label: '集数: ', style: 'width: auto;max-width: 100%;' }
            , window.ede.searchDanmakuOpts.episode, animes[selectAnimeIdx].episodes, 'episodeId', 'episodeTitle');
        danmakuEpisodeNumDiv.append(episodeNumSelect);
        getById(eleIds.danmakuEpisodeFlag).hidden = false;
        getById(eleIds.danmakuSwitchEpisode).disabled = false;
        getById(eleIds.searchImg).src = dandanplayApi.posterImg(animes[selectAnimeIdx].animeId);
    }

    function doSearchTitleSwtich(e) {
        const searchInputEle = getById(eleIds.danmakuSearchName);
        const attrKey = 'isOriginalTitle';
        if ('1' === e.target.getAttribute(attrKey)) {
            e.target.setAttribute(attrKey, '0');
            return searchInputEle.value = window.ede.searchDanmakuOpts.animeName;
        }
        const { _episode_key, seriesOrMovieId } = window.ede.searchDanmakuOpts;
        const episode_info = JSON.parse(localStorage.getItem(_episode_key));
        const { animeOriginalTitle } = episode_info; 
        if (animeOriginalTitle) {
            e.target.setAttribute(attrKey, '1');
            return searchInputEle.value = animeOriginalTitle;
        }
        ApiClient.getItem(ApiClient.getCurrentUserId(), seriesOrMovieId).then(item => {
            if (item.OriginalTitle) {
                e.target.setAttribute(attrKey, '1');
                searchInputEle.value = item.OriginalTitle;
                episode_info.animeOriginalTitle = item.OriginalTitle;
                localStorage.setItem(_episode_key, JSON.stringify(episode_info));
                window.ede.episode_info.animeOriginalTitle = item.OriginalTitle;
            }
        });
    }

    function doDanmakuAnimeSelect(value, index, option) {
        const numDiv = getById(eleIds.danmakuEpisodeNumDiv);
        numDiv.innerHTML = '';
        const anime = window.ede.searchDanmakuOpts.animes[index];
        const episodeNumSelect = embySelect({ id: eleIds.danmakuEpisodeNumSelect, label: '集数: ' }, index
            , anime.episodes, 'episodeId', 'episodeTitle');
        episodeNumSelect.style.maxWidth = '100%';
        numDiv.append(episodeNumSelect);
        getById(eleIds.searchImg).src = dandanplayApi.posterImg(anime.animeId);
    }

    function doDanmakuSwitchEpisode() {
        const animeSelect = getById(eleIds.danmakuAnimeSelect);
        const episodeNumSelect = getById(eleIds.danmakuEpisodeNumSelect);
        const anime = window.ede.searchDanmakuOpts.animes[animeSelect.selectedIndex];

        const episodeInfo = {
            episodeId: episodeNumSelect.value,
            episodeTitle: episodeNumSelect.options[episodeNumSelect.selectedIndex].text,
            episodeIndex: episodeNumSelect.selectedIndex,
            animeId: anime.animeId,
            animeTitle: anime.animeTitle,
        }
        localStorage.setItem(window.ede.searchDanmakuOpts._episode_key, JSON.stringify(episodeInfo));
        console.log(`手动匹配信息:`, episodeInfo);
        loadDanmaku(LOAD_TYPE.RELOAD);
        closeEmbyDialog();
    }

    function doDanmakuEngineSelect(value) {
        let selectedValue = value.id;
        if (lsCheckSet(lsKeys.engine.id, selectedValue)) { 
            console.log(`已更改弹幕引擎为: ${selectedValue}`);
            loadDanmaku(LOAD_TYPE.RELOAD);
        }
    }

    function doDanmakuChConverChange(value) {
        window.ede.chConvert = value.id;
        lsSetItem(lsKeys.chConvert.id, window.ede.chConvert);
        loadDanmaku(LOAD_TYPE.REFRESH);
        console.log(value.name);
    }

    function doDanmuListOptsChange(value, index) {
        const danmuListEle = getById(eleIds.danmuListText);
        danmuListEle.style.display = index == lsKeys.danmuList.defaultValue ? 'none' : '';
        const f = new Intl.DateTimeFormat('default', { minute: '2-digit', second: '2-digit' });
        const hasShowSourceIds = lsGetItem(lsKeys.showSource.id).length > 0;
        danmuListEle.value = value.onChange(window.ede)
            .map((c, i) => `[${i + 1}] [${f.format(new Date(c.time * 1000))}] : `
                + (hasShowSourceIds ? c.originalText : c.text)
                + (c.source ? ` [${c.source}]` : '')
                + (c.originalUserId ? `[${c.originalUserId}]` : '')
                + (c.cid ? `[${c.cid}]` : '')
            ).join('\n');
    }

    function doDanmakuTypeFilterSelect() {
        const checkList = Array.from(document.getElementsByName(eleIds.danmakuTypeFilterSelectName))
            .filter(item => item.checked).map(item => item.value);
        lsSetItem(lsKeys.typeFilter.id, checkList);
        loadDanmaku(LOAD_TYPE.RELOAD);
        const idNameMap = new Map(Object.values(danmakuTypeFilterOpts).map(opt => [opt.id, opt.name]));
        console.log(`当前弹幕类型过滤为: ${JSON.stringify(checkList.map(s => idNameMap.get(s)))}`);
    }

    function doDanmakuSourceFilterSelect() {
        const checkList = Array.from(document.getElementsByName(eleIds.danmakuSourceFilterSelectName))
            .filter(item => item.checked).map(item => item.value);
        lsSetItem(lsKeys.sourceFilter.id, checkList);
        loadDanmaku(LOAD_TYPE.RELOAD);
        console.log(`当前弹幕来源平台过滤为: ${JSON.stringify(checkList)}`);
    }

    function doDanmakuShowSourceSelect() {
        const checkList = Array.from(document.getElementsByName(eleIds.danmakuShowSourceSelectName))
            .filter(item => item.checked).map(item => item.value);
        lsSetItem(lsKeys.showSource.id, checkList);
        loadDanmaku(LOAD_TYPE.RELOAD);
        const idNameMap = new Map(Object.values(showSource).map(opt => [opt.id, opt.name]));
        console.log(`当前弹幕显示来源为: ${JSON.stringify(checkList.map(s => idNameMap.get(s)))}`);
    }

    function onSliderChange(val, props, needReload = true) {
        onSliderChangeLabel(val, props);
        if (props?.key && lsCheckSet(props.key, val)) {
            console.log(`${props.key} changed to ${val}`);
            if (needReload) { loadDanmaku(LOAD_TYPE.RELOAD); }
        }
    }

    function onSliderChangeLabel(val, props) {
        if (props?.labelId) { getById(props.labelId).innerText = val; }
    }
    
    function doDanmakuFilterKeywordsBtnClick(event) {
        const btn = event.currentTarget;
        if (btn) {
            btn.style = '';
            btn.disabled = true;
        }
        let keywords = getById(eleIds.filterKeywordsId).value.trim();
        let enable = getById(eleIds.filterKeywordsEnableId).checked;
        lsCheckSet(lsKeys.filterKeywordsEnable.id, enable);

        if (!lsCheckSet(lsKeys.filterKeywords.id, keywords) && keywords === '') { return; }
        loadDanmaku(LOAD_TYPE.RELOAD);
    }

    function updateFilterKeywordsBtn(btn, flag, keywords) {
        const isSame = lsCheckOld(lsKeys.filterKeywordsEnable.id, flag) && lsCheckOld(lsKeys.filterKeywords.id, keywords);
        btn.firstChild.innerHTML = isSame ? iconKeys.done_disabled : iconKeys.done;
        btn.disabled = isSame;
    }

    function doConsoleLogChange(checked) {
        lsSetItem(lsKeys.consoleLogEnable.id, checked);
        const consoleLogTextEle = getById(eleIds.consoleLogText);
        consoleLogTextEle.style.display = checked ? '' : 'none';
        if (checked) {
            if (!window.ede.appLogAspect) {
                window.ede.appLogAspect = new AppLogAspect().init();
            }
            consoleLogTextEle.value = window.ede.appLogAspect.value;
            window.ede.appLogAspect.on(newValue => {
                if (consoleLogTextEle.value.length !== newValue.length) {
                    consoleLogTextEle.value = newValue;
                    consoleLogTextEle.scrollTop = consoleLogTextEle.scrollHeight;
                    const consoleLogCountLabel = getById(eleIds.consoleLogCountLabel);
                    if (consoleLogCountLabel) {
                        consoleLogCountLabel.innerHTML = `清空 ${newValue.split('\n').length - 1} 行`;
                    }
                }
            });
        } else {
            consoleLogTextEle.value = '';
            window.ede.appLogAspect.destroy();
            window.ede.appLogAspect = null;
        }
    }

    /**
     * @param {string} childId - 子元素的 ID
     * @param {HTMLElement | null} [parentNode] - 父元素，默认为 null
     * @returns {HTMLElement | null} - 返回找到的元素或 null
     */
    function getById(childId, parentNode) {
        if (parentNode) {
            return parentNode.querySelector('#' + childId);
        } else {
            return document.getElementById(childId);
        }
    }

    /** props: {id: 'inputId', value: '', type: '', style: '',...} for setAttribute(key, value)
     * function will not setAttribute
     */
    function embyInput(props, onEnter, onChange) {
        const input = document.createElement('input', { is: 'emby-input' });
        Object.entries(props).forEach(([key, value]) => {
            if (typeof value !== 'function') { input.setAttribute(key, value); }
        });
        input.className = embyInputClass; // searchfields-txtSearch: 半圆角
        if (typeof onEnter === 'function') {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { onEnter(e); } });
        }
        if (typeof onChange === 'function') { input.addEventListener('change', onChange); }
        // 控制器输入左右超出边界时切换元素
        input.addEventListener('keydown', (event) => {
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && 
                    ((input.selectionStart === 0 && event.key === 'ArrowLeft') ||
                        (input.selectionEnd === input.value.length && event.key === 'ArrowRight'))) {
                event.stopPropagation();
                event.preventDefault()
                var options = {sourceElement: event.target, repeat: event.repeat, originalEvent: event };
                require(['inputmanager'], (inputmanager) => {
                    inputmanager.trigger(event.key.replace('Arrow', '').toLowerCase(), options);
                });
            }
        });
        return input;
    }

    function embyI(iconKey, extClassName) {
        const iNode = document.createElement('i');
        iNode.className = 'md-icon' + (extClassName ? ' ' + extClassName : '');
        iNode.style = 'pointer-events: none;';
        iNode.innerHTML = iconKey;
        return iNode;
    }

    /** props: {id: 'btnId', label: 'label text', style: '', iconKey: '',...} for setAttribute(key, value)
     * 'iconKey' will innerHTML <i>iconKey</i>|function will not setAttribute
     */
    function embyButton(props, onClick) {
        const button = document.createElement('button', { is: 'emby-button' });
        button.setAttribute('type', 'button');
        Object.entries(props).forEach(([key, value]) => {
            if (key !== 'iconKey' &&  typeof value !== 'function') { button.setAttribute(key, value); }
        });
        if (props.iconKey) {
            button.setAttribute('title', props.label);
            button.setAttribute('aria-label', props.label);
            button.innerHTML = embyI(props.iconKey).outerHTML;
            button.className = embyButtonClasses.iconButton;
        } else {
            button.classList.add(...embyButtonClasses.basic.split(' '));
            button.textContent = props.label;
        }
        if (typeof onClick === 'function') { button.addEventListener('click', onClick); }
        return button;
    }

    function embyTabs(options, selectedValue, optionValueKey, optionTitleKey, onChange) {
        const tabs = document.createElement('div', { is: 'emby-tabs' });
        tabs.setAttribute('data-index', '0');
        tabs.className = embyTabsDivClass1;
        tabs.style.width = 'fit-content';
        const tabsSlider = document.createElement('div');
        tabsSlider.className = embyTabsDivClass2;
        tabsSlider.style.padding = '0.25em';
        options.forEach((option, index) => {
            const value = getValueOrInvoke(option, optionValueKey);
            const title = getValueOrInvoke(option, optionTitleKey);
            const tabButton = document.createElement('button');
            tabButton.id = option.id + 'Btn';
            tabButton.className = `${embyTabsButtonClass}${value == selectedValue ? ' emby-tab-button-active' : ''}`;
            tabButton.setAttribute('data-index', index);
            tabButton.textContent = title;
            tabButton.style.display = option.hidden ? 'none' : '';
            tabsSlider.append(tabButton);
        });
        tabs.append(tabsSlider);
        if (typeof onChange === 'function') {
            tabs.addEventListener('tabchange', e => onChange(options[e.detail.selectedTabIndex], e.detail.selectedTabIndex));
        }
        return tabs;
    }

    function embySelect(props, selectedIndexOrValue, options, optionValueKey, optionTitleKey, onChange) {
        const defaultProps = { class: 'emby-select' };
        props = { ...defaultProps, ...props };
        if (!Number.isInteger(selectedIndexOrValue)) {
            selectedIndexOrValue = options.indexOf(selectedIndexOrValue);
        }
        const selectElement = document.createElement('select', { is: 'emby-select'});
        Object.entries(props).forEach(([key, value]) => {
            if (typeof value !== 'function') { selectElement.setAttribute(key, value); }
        });
        options.forEach((option, index) => {
            const value = getValueOrInvoke(option, optionValueKey);
            const title = getValueOrInvoke(option, optionTitleKey);
            const optionElement = document.createElement('option');
            optionElement.value = value;
            optionElement.textContent = title;
            if (index === selectedIndexOrValue) {
                optionElement.selected = true;
            }
            selectElement.append(optionElement);
        });
        if (typeof onChange === 'function') {
            selectElement.addEventListener('change', e => {
                onChange(e.target.value, e.target.selectedIndex, options[e.target.selectedIndex]);
            });
        }
        return selectElement;
    }
    
    function embyCheckboxList(id, checkBoxName, selectedStrArray, options, onChange, isVertical = false) {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.setAttribute('class', embyCheckboxListClass);
        checkboxContainer.setAttribute('style', isVertical ? '' : embyCheckboxListStyle);
        checkboxContainer.setAttribute('id', id);
        options.forEach(option => {
            checkboxContainer.append(embyCheckbox({ name: checkBoxName, label: option.name, value: option.id }
                , selectedStrArray?.indexOf(option.id) > -1 , onChange));
        });
        return checkboxContainer;
    }
    
    function embyCheckbox({ id, name, label, value }, checked = false, onChange) {
        const checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add('emby-checkbox-label');
        checkboxLabel.setAttribute('style', 'width: auto;');
        const checkbox = document.createElement('input', { is: 'emby-checkbox' });
        checkbox.setAttribute('is', 'emby-checkbox');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.setAttribute('id', id);
        checkbox.setAttribute('name', name);
        checkbox.setAttribute('value', value);
        checkbox.checked = checked;
        checkbox.classList.add('emby-checkbox', 'chkEnableLiveTvAccess');
        if (typeof onChange === 'function') {
            checkbox.addEventListener('change', e => onChange(e.target.checked));
        }
        const span = document.createElement('span');
        span.setAttribute('class', 'checkboxLabel');
        span.innerHTML = label;
        checkboxLabel.append(checkbox);
        checkboxLabel.append(span);
        return checkboxLabel;
    }

    /** props: {id: 'textareaId',value: '', rows: 10,style: '', styleResize:''|'vertical'|'horizontal'
     *      , style: '', readonly: false} for setAttribute(key, value)
     * function will not setAttribute
     */
    function embyTextarea(props, onBlur) {
        const defaultProps = { rows: 10, styleResize: 'vertical', readonly: false };
        props = { ...defaultProps, ...props };
        const textarea = document.createElement('textarea', { is: 'emby-textarea' });
        Object.entries(props).forEach(([key, value]) => {
            if (typeof value !== 'function' && key !== 'readonly' 
                && key !== 'styleResize' && key !== 'value') { textarea.setAttribute(key, value); }
        });
        textarea.className = 'txtOverview emby-textarea';
        textarea.readOnly = props.readonly;
        textarea.style.resize = props.styleResize;
        textarea.value = props.value;
        if (typeof onBlur === 'function') { textarea.addEventListener('blur', onBlur); }
        return textarea;
    }

    /** props: {id: 'slider id', labelId: 'label id', ...} will return to the callback
    *   orient: 'vertical' | 'horizontal' 垂直/水平 
    */
    function embySlider(props = {}, options = {}, onChange, onSliding) {
        const defaultOpts = {
            min: 0.1, max: 3, step: 0.1, orient: 'horizontal',
            'data-bubble': false, 'data-hoverthumb': true , style: '',
        };
        options = { ...defaultOpts, ...options };
        const slider = document.createElement('input', { is: 'emby-slider' });
        slider.setAttribute('type', 'range');
        if (props.id) { slider.setAttribute('id', props.id); }
        Object.entries(options).forEach(([key, value]) => slider.setAttribute(key, value));
        // other EventListeners : 'beginediting'(every step), 'endediting'(end of tap/swipe)
        if (typeof onChange === 'function') {
            // Trigger after end of tap/swipe
            slider.addEventListener('change', e => onChange(e.target.value, props));
        }
        if (typeof onSliding === 'function') {
            // when clicking/sliding, trigger every step
            slider.addEventListener('input', e => onSliding(e.target.value, props));
        }
        if (options.value) {
            slider.setValue(options.value);
            slider.dispatchEvent(new Event('input'));
        }
        // 以下兼容旧版本emby,控制器操作锁定滑块焦点
        slider.addEventListener('keydown', e => {
            const orient = slider.getAttribute('orient') || 'horizontal';
            if ((orient === 'horizontal' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
                (orient === 'vertical' && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) {
                e.stopPropagation();
            }
        });
        return slider;
    }

    /**
     * see: ../web/modules/dialog/dialog.js
     * opts have type props: unknown
     * dialog have buttons prop: [{ type: 'submit', id: 'cancel', name:'取消', description: '无操作', href: 'index.html',  }]
     */
    async function embyDialog(opts = {}) {
        const defaultOpts = { text: '', title: '', timeout: 0, html: '', buttons: [] };
        opts = { ...defaultOpts, ...opts };
        return require(['dialog']).then(items => items[0]?.(opts))
            .catch(error => { console.log('点击弹出框外部取消: ' + error) });
    }

    function closeEmbyDialog() {
        document.querySelector('.formDialogFooterItem').dispatchEvent(new Event('click'));
    }

    function embyALink(href, text) {
        const aEle = document.createElement('a');
        aEle.href = href;
        aEle.textContent = text ?? href;
        aEle.target = '_blank';
        aEle.className = 'button-link button-link-color-inherit button-link-fontweight-inherit emby-button';
        if (isAndroid() || isIOS()) {
            aEle.addEventListener('click', (event) => {
                event.preventDefault();
                navigator.clipboard.writeText(href).then(() => {
                    console.log('Link copied to clipboard:', href);
                    const label = document.createElement('label');
                    label.textContent = '已复制';
                    label.style.color = 'green';
                    label.style.paddingLeft = '0.5em';
                    aEle.append(label);
                    setTimeout(() => {
                        aEle.removeChild(label);
                    }, 3000);
                }, (err) => {
                    console.error('Failed to copy link:', err);
                });
            });
        }
        return aEle;
    }

    function isAndroid() {
        return /android/i.test(navigator.userAgent);
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function embyImg(src, style, id, draggable = false) {
        const img = document.createElement('img');
        img.id = id;
        img.src = src;
        img.style = style;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = draggable;
        img.className = 'coveredImage-noScale cardImage';
        return img;
    }

    function embyImgButton(childNode, btnStyle) {
        const btn = document.createElement('button');
        btn.style = btnStyle;
        btn.className = 'cardContent-button cardImageContainer cardPadder-portrait defaultCardBackground';
        btn.append(childNode);
        btn.addEventListener('focus', () => {
            btn.style.boxShadow = '0 0 0 5px green';
        });
        btn.addEventListener('blur', () => {
            btn.style.boxShadow = '';
        });
        return btn;
    }

    // see: ../web/modules/common/dialogs/alert.js
    async function embyAlert(opts = {}) {
        const defaultOpts = { text: '', title: '', timeout: 0, html: ''};
        opts = { ...defaultOpts, ...opts };
        return require(['alert']).then(items => items[0]?.(opts))
            .catch(error => { console.log('点击弹出框外部取消: ' + error) });
    }

    // see: ../web/modules/toast/toast.js, 严禁滥用,因遮挡画面影响体验
    async function embyToast(opts = {}) {
        const defaultOpts = { text: '', secondaryText: '', icon: '', iconStrikeThrough: false};
        opts = { ...defaultOpts, ...opts };
        return require(['toast'], toast => toast(opts));
    }

    function getValueOrInvoke(option, keyOrFunc) {
        return typeof keyOrFunc === 'function' ? keyOrFunc(option) : option[keyOrFunc];
    }

    function getSettingsJson(space = 4) {
        return JSON.stringify(Object.fromEntries(Object.entries(lsKeys).map(
            ([key, value]) => [value.id, lsGetItem(value.id)])), null, space);
            // ([key, value]) => [value.id, { value: lsGetItem(value.id), name: value.name }])), null, space);
    }

    function settingsReset() {
        const defaultSettings = Object.fromEntries(
            Object.entries(lsKeys)
            .filter(([key, value]) => lsKeys.filterKeywords.id !== value.id)
            .map(([key, value]) => [value.id, value.defaultValue])
        );
        lsBatchSet(defaultSettings);
    }

    // 缓存相关方法
    function lsGetItem(id) {
        const key = lsGetKeyById(id);
        if (!key) { return null; }
        const defaultValue = lsKeys[key].defaultValue;
        const item = localStorage.getItem(id);
        if (item === null) { return defaultValue; }
        if (Array.isArray(defaultValue)) { return JSON.parse(item); }
        if (Array.isArray(defaultValue) || typeof defaultValue === 'object') { return JSON.parse(item); }
        if (typeof defaultValue === 'boolean') { return item === 'true'; }
        if (typeof defaultValue === 'number') { return parseFloat(item); }
        return item;
    }
    function lsCheckOld(id, value) {
        return JSON.stringify(lsGetItem(id)) === JSON.stringify(value);
    }
    function lsCheckSet(id, value) {
        if (lsCheckOld(id, value)) { return false; }
        lsSetItem(id, value);
        return true;
    }
    /** 批量设置缓存
     * @param {object} keyValues - 键值对对象,如 {key1: value1, key2: value2}
     * @returns {boolean} - 是否有更新
     */
    function lsBatchSet(keyValues, needCheck = true) {
        if (needCheck) {
            return Object.entries(keyValues).reduce((acc, [id, value]) => (acc || lsCheckSet(id, value)), false);
        } else {
            Object.entries(keyValues).forEach(([key, value]) => lsSetItem(key, value));
        }
    }
    function lsSetItem(id, value) {
        if (!lsGetKeyById(id)) { return; }
        let stringValue;
        if (Array.isArray(value)) {
            stringValue = JSON.stringify(value);
        } else if (typeof value === 'object') {
            stringValue = JSON.stringify(value);
        } else {
            stringValue = value;
        }
        localStorage.setItem(id, stringValue);
    }
    function lsGetKeyById(id) {
        return Object.keys(lsKeys).find(key => lsKeys[key].id === id);
    }
    function lsBatchRemove(prefixes) {
        return Object.keys(localStorage)
        .filter(key => prefixes.some(prefix => key.startsWith(prefix)))
            .map(key => localStorage.removeItem(key))
            .length > 0;
    }

    /**
     * @param {number} [timeout=10000] - 超时时间,默认10秒,0则不设置超时
     * @param {number} [interval=check_interval] - 检查间隔,默认200ms
     * */
    function waitForElement(selector, callback, timeout = 10000, interval = check_interval) {
        let intervalId = null;
        let timeoutId = null;
        function checkElement() {
            console.log(`waitForElement: checking element[${selector}]`);
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                callback(element);
            }
        }
        intervalId = setInterval(checkElement, interval);
        window.ede.destroyIntervalIds.push(intervalId);
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                console.log(`waitForElement: unable to find element[${selector}], timeout: ${timeout}`);
            }, timeout);
        }
    }

    function addEasterEggListener() {
        const target = document.querySelector('.headerUserButton');
        if (!target) { return; }
        let longPressTimeout;
        function startLongPress() {
            longPressTimeout = setTimeout(() => {
                console.log('恭喜你发现了隐藏功能, 长按了 2 秒!');
                quickDebug();
            }, 2000);
        }
        function cancelLongPress() {
            clearTimeout(longPressTimeout);
        }
        if (target.getAttribute('focusFlag') !== '1') {
            target.addEventListener('focus', startLongPress);
            target.setAttribute('focusFlag', '1');
        }
        if (target.getAttribute('blurFlag') !== '1') {
            target.addEventListener('blur', cancelLongPress);
            target.setAttribute('blurFlag', '1');
        }
        return () => {
            target.removeEventListener('focus', startLongPress);
            target.removeEventListener('blur', cancelLongPress);
            clearTimeout(longPressTimeout);
        };
    }

    // from emby videoosd.js bindToPlayer events, warning: not dom event
    async function playbackEventsOn(eventsMap) {
        const [playbackManager, events] = await require(['playbackManager', 'events']);
        const player = playbackManager.getCurrentPlayer();
        if (!player) { return; }
        Object.entries(eventsMap).forEach(([eventName, fn]) => {
            // 无法修改 fn ,会导致引用变更重复添加,events.off 中的 array.indexOf(fn) 返回 -1
            events.off(player, eventName, fn);
            events.on(player, eventName, fn);
        });
    }

    async function initH5VideoAdapter() {
        let _media = document.querySelector(mediaQueryStr);
        if (_media) { return; }
        console.log('页面上不存在 video 标签,适配器处理开始');
        _media = document.createElement('video');
        _media.style.display = 'none';
        _media.id = eleIds.h5VideoAdapter;
        _media.classList.add('htmlvideoplayer', 'moveUpSubtitles');
        document.body.prepend(_media);

        _media.play();
        // 平滑补充 timeupdate 中秒级间隔缺失的 100ms 间隙
        window.ede.destroyIntervalIds.push(setInterval(() => { _media.currentTime += 100 / 1e3 }, 100));

        const [playbackManager] = await require(['playbackManager']);
        playbackEventsOn({
            'timeupdate': (e) => {
                // conver to seconds from Ticks
                const realCurrentTime = playbackManager.currentTime(playbackManager.getCurrentPlayer()) / 1e7;                
                const mediaTime = _media.currentTime;
                _media.currentTime = realCurrentTime;
                // playbackRate 同步依赖至少 100ms currentTime 变更
                _media.playbackRate = playbackManager.getPlayerState().PlayState.PlaybackRate ?? 1;
                // 当前时间与上次记录时间差值大于2秒,则判定为用户操作进度,seeking 事件必须在 currentTime 更改后触发,否则回退后弹幕将消失
                if (Math.abs(mediaTime - realCurrentTime) > 2) {
                    _media.dispatchEvent(new Event('seeking'));
                    console.warn('seeking', realCurrentTime, mediaTime);
                }
            },
            'pause': (e) => {
                _media.dispatchEvent(new Event('pause'));
                window.ede.destroyIntervalIds.map(id => clearInterval(id));
                window.ede.destroyIntervalIds = [];
                console.warn('pause');
            },
            'unpause': (e) => {
                _media.dispatchEvent(new Event('play'));
                // 只有老版本 Emby Theater 播放首次会进来,所以上面初始化重新添加一次定时器
                // window.ede.destroyIntervalIds.push(setInterval(() => { _media.currentTime += 100 / 1e3 }, 100));
                console.warn('unpause');
            },
        });
        console.log('已创建虚拟 video 标签,适配器处理正确结束');
    }

    function beforeDestroy() {
        // 此段销毁不重要,可有可无,仅是规范使用,清除弹幕,但未销毁 danmaku 实例
        window.ede.danmaku?.clear();
        // 销毁弹幕按钮容器简单,双 mediaContainerQueryStr 下免去 DOM 位移操作
        getById(eleIds.danmakuCtr)?.remove();
        getById(eleIds.h5VideoAdapter)?.remove();
        // 销毁可能残留的定时器
        window.ede.destroyIntervalIds.map(id => clearInterval(id));
        window.ede.destroyIntervalIds = [];
        // 退出播放页面重置轴偏秒
        lsSetItem(lsKeys.timelineOffset.id, lsKeys.timelineOffset.defaultValue);
    }

    // emby/jellyfin CustomEvent. see: https://github.com/MediaBrowser/emby-web-defaultskin/blob/822273018b82a4c63c2df7618020fb837656868d/nowplaying/videoosd.js#L698
    document.addEventListener('viewshow', function (e) {
        console.log('viewshow', e);
        addEasterEggListener();
        if (e.detail.type === 'video-osd') {
            if (!window.ede) { window.ede = new EDE(); }
            if (!window.ede.appLogAspect && lsGetItem(lsKeys.consoleLogEnable.id)) {
                window.ede.appLogAspect = new AppLogAspect().init();
            }
            initUI();
            initH5VideoAdapter();
            // loadDanmaku(LOAD_TYPE.INIT);
            initListener();
        }
    });
    document.addEventListener('viewbeforehide', e => e.detail.type === 'video-osd' && beforeDestroy());

})();
