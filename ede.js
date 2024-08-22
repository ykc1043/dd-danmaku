// ==UserScript==
// @name         Emby danmaku extension
// @description  Emby弹幕插件
// @namespace    https://github.com/RyoLee
// @author       RyoLee
// @version      1.29
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
    // Danmaku 依赖路径,index.html 引入的和篡改猴环境不用填,依赖已内置,被 eval() 执行的特殊环境下使用,支持相对绝对网络路径
    // 默认是相对路径等同 https://emby/web/ 和 /system/dashboard-ui/ ,非浏览器客户端必须使用网络路径
    const requireDanmakuPath = "https://fastly.jsdelivr.net/gh/weizhenye/danmaku@2.0.6/dist/danmaku.min.js";
    // 跨域代理 cf_worker
    const corsProxy = 'https://api.9-ch.com/cors/';
    // ------ 用户配置 end ------
    // ------ 程序内部使用,请勿更改 start ------
    const apiPrefix = corsProxy + 'https://api.dandanplay.net/api/v2';
    const check_interval = 200;
    const LOAD_TYPE = {
        CHECK: 'check',
        INIT: 'init',
        REFRESH: 'refresh',
        RELOAD: 'reload', // 优先走缓存,其余类型走接口
        SEARCH: 'search',
    };
    // apiClient.isMinServerVersion("4.8.0.56")
    const appVersion = parseFloat(document.querySelector('html').getAttribute('data-appversion')?.substring(0, 3));
    const isVersionOld = appVersion ? appVersion < 4.8 : true;
    // htmlVideoPlayerContainer
    let mediaContainerQueryStr = '.graphicContentContainer';
    if (isVersionOld) {
        mediaContainerQueryStr = 'div[data-type="video-osd"]';
    }
    const notHide = ':not(.hide)';
    mediaContainerQueryStr += notHide;
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
        danmakuSearchEpisode: 'danmakuSearchEpisode',
        danmakuEpisodeFlag: 'danmakuEpisodeFlag',
        danmakuAnimeDiv: 'danmakuAnimeDiv',
        danmakuSwitchEpisode: 'danmakuSwitchEpisode',
        danmakuEpisodeNumDiv: 'danmakuEpisodeNumDiv',
        danmakuEpisodeLoad: 'danmakuEpisodeLoad',
        danmakuRemark: 'danmakuRemark',
        danmakuAnimeSelect: 'danmakuAnimeSelect',
        danmakuEpisodeNumSelect: 'danmakuEpisodeNumSelect',
        searchImg: 'searchImg',
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
        danmuListDiv: 'danmuListDiv',
        danmuListText: 'danmakuListText',
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
        consoleLogCtrl: 'consoleLogCtrl',
        consoleLogText: 'consoleLogText',
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
    };

    // 此id等同于danmakuTabOpts内的弹幕信息的id
    const currentDanmakuInfoContainerId = 'danmakuTab2';
    // 播放界面下方按钮
    const mediaBtnOpts = [
        { id: eleIds.danmakuSwitchBtn, label: '弹幕开关', iconKey: iconKeys.comment, onClick: doDanmakuSwitch },
        { label: '弹幕设置', iconKey: iconKeys.setting, onClick: createDialog },
    ];
    // 菜单tabs
    const danmakuTabOpts = [
        { id: 'danmakuTab0', name: '弹幕设置', buildMethod: buildDanmakuSetting },
        { id: 'danmakuTab1', name: '手动匹配', buildMethod: buildSearchEpisode },
        { id: currentDanmakuInfoContainerId, name: '弹幕信息', buildMethod: buildCurrentDanmakuInfo },
        { id: 'danmakuTab3', name: '弹幕屏蔽', buildMethod: buildDanmakuFilter },
        { id: 'danmakuTab4', name: '关于', buildMethod: buildAbout },
    ];
    // 弹幕类型过滤
    const danmakuTypeFilterOpts = {
        bottom: { id: 'bottom', name: '底部弹幕' },
        top: { id: 'top', name: '顶部弹幕' },
        ltr: { id: 'ltr', name: '从左至右' },
        // rtl: { id: 'rtl', name: '从右至左', hidden: true },
        onlyWhite: { id: 'onlyWhite', name: '彩色弹幕' },
    };
    const danmakuSource = {
        AcFun: { id: 'AcFun', name: 'A站(AcFun)' },
        BiliBili: { id: 'BiliBili', name: 'B站(BiliBili)' },
        Gamer: { id: 'Gamer', name: '巴哈(Gamer)' },
        DanDanPlay: { id: 'DanDanPlay', name: '弹弹(DanDanPlay)' }, // 无弹幕来源的默认值
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
    const timelineOffsetBtns = [
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
    const danmuListOpts = [
        { id: '0', name: '不启用' , onChange: () => [] },
        { id: '1', name: '显示屏中', onChange: (ede) => ede.danmaku._.runningList },
        { id: '2', name: '显示所有', onChange: (ede) => ede.commentsParsed },
        { id: '3', name: '显示加载', onChange: (ede) => ede.danmaku.comments },
        { id: '4', name: '显示被过滤', onChange: (ede) => { // 取差集慢,减轻负担,默认不启用
            return ede.commentsParsed.filter(s => !ede.danmaku.comments.some(t => s.cuid === t.cuid))
        } },
    ];
    const lsKeys = {
        chConvert: { id: 'danmakuChConvert', defaultValue: 1 },
        switch: { id: 'danmakuSwitch', defaultValue: true },
        filterLevel: { id: 'danmakuFilterLevel', defaultValue: 0 },
        heightRate: { id: 'danmakuHeightRate', defaultValue: 1 },
        fontSizeRate: { id: 'danmakuFontSizeRate', defaultValue: 1 },
        fontOpacity: { id: 'danmakuFontOpacity', defaultValue: 1 },
        speed: { id: 'danmakuSpeed', defaultValue: 1 },
        timelineOffset: { id: 'danmakuTimelineOffset', defaultValue: 0 },
        typeFilter: { id: 'danmakuTypeFilter', defaultValue: [] },
        sourceFilter: { id: 'danmakuSourceFilter', defaultValue: [] },
        showSource: { id: 'danmakuShowSource', defaultValue: [] },
        engine: { id: 'danmakuEngine', defaultValue: 'canvas' },
        filterKeywords: { id: 'danmakuFilterKeywords', defaultValue: '' },
        filterKeywordsEnable: { id: 'danmakuFilterKeywordsEnable', defaultValue: true },
        danmuList: { id: 'danmakuDanmuList', defaultValue: 0 },
        consoleLogEnable: { id: 'danmakuConsoleLogEnable', defaultValue: false },
    };
    // emby ui class
    const embyLabelClass = 'inputLabel';
    const embyInputClass = 'emby-input emby-input-smaller';
    const embyIconButtonClass = 'flex-shrink-zero paper-icon-button-light';
    const embySelectWrapperClass = 'emby-select-wrapper emby-select-wrapper-smaller';
    const embyCheckboxListClass = 'featureList'; // 'checkboxList'
    const embyTextDivClass = 'txtPath fieldDescription';
    const embyTabsMenuClass = 'headerMiddle headerSection sectionTabs headerMiddle-withSectionTabs';
    const embyTabsDivClass1 = 'tabs-viewmenubar tabs-viewmenubar-backgroundcontainer focusable scrollX hiddenScrollX smoothScrollX scrollFrameX emby-tabs';
    const embyTabsDivClass2 = 'tabs-viewmenubar-slider emby-tabs-slider padded-left padded-right nohoverfocus scrollSliderX';
    const embyTabsButtonClass = 'emby-button secondaryText emby-tab-button main-tab-button';
    const embyCheckboxListStyle = 'display: flex;flex-wrap: wrap;';
    const embySliderListStyle = 'display: flex;flex-direction: column;justify-content: center;align-items: center;'; // 容器内元素垂直排列,水平居中 
    const embySliderStyle = 'display: flex; align-items: center; gap: 1em; margin-bottom: 0.3em;'; // 容器内元素横向并排,垂直居中
    
    // ------ 程序内部使用,请勿更改 end ------

    // ------ require start ------
    let skipInnerModule = false;
    try {
        throw new Error();
    } catch(e) {
        const stackTrace = e.stack;
        skipInnerModule = !!stackTrace && stackTrace.includes('CustomCssJS');
        // console.log('ignore this not error, callee:', e);
    }
    if (!skipInnerModule) {
    /* eslint-disable */
    /* https://cdn.jsdelivr.net/npm/danmaku@2.0.6/dist/danmaku.min.js */
    // prettier-ignore
    !function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).Danmaku=e()}(this,(function(){"use strict";var t=function(){if("undefined"==typeof document)return"transform";for(var t=["oTransform","msTransform","mozTransform","webkitTransform","transform"],e=document.createElement("div").style,i=0;i<t.length;i++)if(t[i]in e)return t[i];return"transform"}();function e(t){var e=document.createElement("div");if(e.style.cssText="position:absolute;","function"==typeof t.render){var i=t.render();if(i instanceof HTMLElement)return e.appendChild(i),e}if(e.textContent=t.text,t.style)for(var n in t.style)e.style[n]=t.style[n];return e}var i={name:"dom",init:function(){var t=document.createElement("div");return t.style.cssText="overflow:hidden;white-space:nowrap;transform:translateZ(0);",t},clear:function(t){for(var e=t.lastChild;e;)t.removeChild(e),e=t.lastChild},resize:function(t,e,i){t.style.width=e+"px",t.style.height=i+"px"},framing:function(){},setup:function(t,i){var n=document.createDocumentFragment(),s=0,r=null;for(s=0;s<i.length;s++)(r=i[s]).node=r.node||e(r),n.appendChild(r.node);for(i.length&&t.appendChild(n),s=0;s<i.length;s++)(r=i[s]).width=r.width||r.node.offsetWidth,r.height=r.height||r.node.offsetHeight},render:function(e,i){i.node.style[t]="translate("+i.x+"px,"+i.y+"px)"},remove:function(t,e){t.removeChild(e.node),this.media||(e.node=null)}},n="undefined"!=typeof window&&window.devicePixelRatio||1,s=Object.create(null);function r(t,e){if("function"==typeof t.render){var i=t.render();if(i instanceof HTMLCanvasElement)return t.width=i.width,t.height=i.height,i}var r=document.createElement("canvas"),h=r.getContext("2d"),o=t.style||{};o.font=o.font||"10px sans-serif",o.textBaseline=o.textBaseline||"bottom";var a=1*o.lineWidth;for(var d in a=a>0&&a!==1/0?Math.ceil(a):1*!!o.strokeStyle,h.font=o.font,t.width=t.width||Math.max(1,Math.ceil(h.measureText(t.text).width)+2*a),t.height=t.height||Math.ceil(function(t,e){if(s[t])return s[t];var i=12,n=t.match(/(\d+(?:\.\d+)?)(px|%|em|rem)(?:\s*\/\s*(\d+(?:\.\d+)?)(px|%|em|rem)?)?/);if(n){var r=1*n[1]||10,h=n[2],o=1*n[3]||1.2,a=n[4];"%"===h&&(r*=e.container/100),"em"===h&&(r*=e.container),"rem"===h&&(r*=e.root),"px"===a&&(i=o),"%"===a&&(i=r*o/100),"em"===a&&(i=r*o),"rem"===a&&(i=e.root*o),void 0===a&&(i=r*o)}return s[t]=i,i}(o.font,e))+2*a,r.width=t.width*n,r.height=t.height*n,h.scale(n,n),o)h[d]=o[d];var u=0;switch(o.textBaseline){case"top":case"hanging":u=a;break;case"middle":u=t.height>>1;break;default:u=t.height-a}return o.strokeStyle&&h.strokeText(t.text,a,u),h.fillText(t.text,a,u),r}function h(t){return 1*window.getComputedStyle(t,null).getPropertyValue("font-size").match(/(.+)px/)[1]}var o={name:"canvas",init:function(t){var e=document.createElement("canvas");return e.context=e.getContext("2d"),e._fontSize={root:h(document.getElementsByTagName("html")[0]),container:h(t)},e},clear:function(t,e){t.context.clearRect(0,0,t.width,t.height);for(var i=0;i<e.length;i++)e[i].canvas=null},resize:function(t,e,i){t.width=e*n,t.height=i*n,t.style.width=e+"px",t.style.height=i+"px"},framing:function(t){t.context.clearRect(0,0,t.width,t.height)},setup:function(t,e){for(var i=0;i<e.length;i++){var n=e[i];n.canvas=r(n,t._fontSize)}},render:function(t,e){t.context.drawImage(e.canvas,e.x*n,e.y*n)},remove:function(t,e){e.canvas=null}};function a(t){var e=this,i=this.media?this.media.currentTime:Date.now()/1e3,n=this.media?this.media.playbackRate:1;function s(t,s){if("top"===s.mode||"bottom"===s.mode)return i-t.time<e._.duration;var r=(e._.width+t.width)*(i-t.time)*n/e._.duration;if(t.width>r)return!0;var h=e._.duration+t.time-i,o=e._.width+s.width,a=e.media?s.time:s._utc,d=o*(i-a)*n/e._.duration,u=e._.width-d;return h>e._.duration*u/(e._.width+s.width)}for(var r=this._.space[t.mode],h=0,o=0,a=1;a<r.length;a++){var d=r[a],u=t.height;if("top"!==t.mode&&"bottom"!==t.mode||(u+=d.height),d.range-d.height-r[h].range>=u){o=a;break}s(d,t)&&(h=a)}var m=r[h].range,c={range:m+t.height,time:this.media?t.time:t._utc,width:t.width,height:t.height};return r.splice(h+1,o-h-1,c),"bottom"===t.mode?this._.height-t.height-m%this._.height:m%(this._.height-t.height)}var d="undefined"!=typeof window&&(window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame)||function(t){return setTimeout(t,50/3)},u="undefined"!=typeof window&&(window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.webkitCancelAnimationFrame)||clearTimeout;function m(t,e,i){for(var n=0,s=0,r=t.length;s<r-1;)i>=t[n=s+r>>1][e]?s=n:r=n;return t[s]&&i<t[s][e]?s:r}function c(t){return/^(ltr|top|bottom)$/i.test(t)?t.toLowerCase():"rtl"}function l(){var t=9007199254740991;return[{range:0,time:-t,width:t,height:0},{range:t,time:t,width:0,height:0}]}function f(t){t.ltr=l(),t.rtl=l(),t.top=l(),t.bottom=l()}function p(){if(!this._.visible||!this._.paused)return this;if(this._.paused=!1,this.media)for(var t=0;t<this._.runningList.length;t++){var e=this._.runningList[t];e._utc=Date.now()/1e3-(this.media.currentTime-e.time)}var i=this,n=function(t,e,i,n){return function(){t(this._.stage);var s=Date.now()/1e3,r=this.media?this.media.currentTime:s,h=this.media?this.media.playbackRate:1,o=null,d=0,u=0;for(u=this._.runningList.length-1;u>=0;u--)o=this._.runningList[u],r-(d=this.media?o.time:o._utc)>this._.duration&&(n(this._.stage,o),this._.runningList.splice(u,1));for(var m=[];this._.position<this.comments.length&&(o=this.comments[this._.position],!((d=this.media?o.time:o._utc)>=r));)r-d>this._.duration||(this.media&&(o._utc=s-(this.media.currentTime-o.time)),m.push(o)),++this._.position;for(e(this._.stage,m),u=0;u<m.length;u++)(o=m[u]).y=a.call(this,o),this._.runningList.push(o);for(u=0;u<this._.runningList.length;u++){o=this._.runningList[u];var c=(this._.width+o.width)*(s-o._utc)*h/this._.duration;"ltr"===o.mode&&(o.x=c-o.width+.5|0),"rtl"===o.mode&&(o.x=this._.width-c+.5|0),"top"!==o.mode&&"bottom"!==o.mode||(o.x=this._.width-o.width>>1),i(this._.stage,o)}}}(this._.engine.framing.bind(this),this._.engine.setup.bind(this),this._.engine.render.bind(this),this._.engine.remove.bind(this));return this._.requestID=d((function t(){n.call(i),i._.requestID=d(t)})),this}function g(){return!this._.visible||this._.paused||(this._.paused=!0,u(this._.requestID),this._.requestID=0),this}function _(){if(!this.media)return this;this.clear(),f(this._.space);var t=m(this.comments,"time",this.media.currentTime);return this._.position=Math.max(0,t-1),this}function v(t){t.play=p.bind(this),t.pause=g.bind(this),t.seeking=_.bind(this),this.media.addEventListener("play",t.play),this.media.addEventListener("pause",t.pause),this.media.addEventListener("playing",t.play),this.media.addEventListener("waiting",t.pause),this.media.addEventListener("seeking",t.seeking)}function w(t){this.media.removeEventListener("play",t.play),this.media.removeEventListener("pause",t.pause),this.media.removeEventListener("playing",t.play),this.media.removeEventListener("waiting",t.pause),this.media.removeEventListener("seeking",t.seeking),t.play=null,t.pause=null,t.seeking=null}function y(t){this._={},this.container=t.container||document.createElement("div"),this.media=t.media,this._.visible=!0,this.engine=(t.engine||"DOM").toLowerCase(),this._.engine="canvas"===this.engine?o:i,this._.requestID=0,this._.speed=Math.max(0,t.speed)||144,this._.duration=4,this.comments=t.comments||[],this.comments.sort((function(t,e){return t.time-e.time}));for(var e=0;e<this.comments.length;e++)this.comments[e].mode=c(this.comments[e].mode);return this._.runningList=[],this._.position=0,this._.paused=!0,this.media&&(this._.listener={},v.call(this,this._.listener)),this._.stage=this._.engine.init(this.container),this._.stage.style.cssText+="position:relative;pointer-events:none;",this.resize(),this.container.appendChild(this._.stage),this._.space={},f(this._.space),this.media&&this.media.paused||(_.call(this),p.call(this)),this}function x(){if(!this.container)return this;for(var t in g.call(this),this.clear(),this.container.removeChild(this._.stage),this.media&&w.call(this,this._.listener),this)Object.prototype.hasOwnProperty.call(this,t)&&(this[t]=null);return this}var b=["mode","time","text","render","style"];function L(t){if(!t||"[object Object]"!==Object.prototype.toString.call(t))return this;for(var e={},i=0;i<b.length;i++)void 0!==t[b[i]]&&(e[b[i]]=t[b[i]]);if(e.text=(e.text||"").toString(),e.mode=c(e.mode),e._utc=Date.now()/1e3,this.media){var n=0;void 0===e.time?(e.time=this.media.currentTime,n=this._.position):(n=m(this.comments,"time",e.time))<this._.position&&(this._.position+=1),this.comments.splice(n,0,e)}else this.comments.push(e);return this}function T(){return this._.visible?this:(this._.visible=!0,this.media&&this.media.paused||(_.call(this),p.call(this)),this)}function E(){return this._.visible?(g.call(this),this.clear(),this._.visible=!1,this):this}function k(){return this._.engine.clear(this._.stage,this._.runningList),this._.runningList=[],this}function C(){return this._.width=this.container.offsetWidth,this._.height=this.container.offsetHeight,this._.engine.resize(this._.stage,this._.width,this._.height),this._.duration=this._.width/this._.speed,this}var D={get:function(){return this._.speed},set:function(t){return"number"!=typeof t||isNaN(t)||!isFinite(t)||t<=0?this._.speed:(this._.speed=t,this._.width&&(this._.duration=this._.width/t),t)}};function z(t){t&&y.call(this,t)}return z.prototype.destroy=function(){return x.call(this)},z.prototype.emit=function(t){return L.call(this,t)},z.prototype.show=function(){return T.call(this)},z.prototype.hide=function(){return E.call(this)},z.prototype.clear=function(){return k.call(this)},z.prototype.resize=function(){return C.call(this)},Object.defineProperty(z.prototype,"speed",D),z}));
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
            this.danmuCache = {};
            this.destroyTimeoutIds = [];
            this.commentsParsed = [];
            this.searchDanmakuOpts = {}; // 手动搜索变量
            this.appLogAspect = null; // 应用日志切面
        }
    }

    class AppLogAspect {
        constructor() {
            this.initialized = false;
            this.originalError = console.error;
            this.originalLog = console.log;
            this.originalOnerror = null;
            this.value = '';
            this.listeners = [];
        }
        init() {
            if (this.initialized) { return this; }
            console.error = (...args) => {
                this.originalError.apply(console, args);
                this.value += this.format('ERROR', args);
                this.notifyListeners();
            };
            console.log = (...args) => {
                this.originalLog.apply(console, args);
                this.value += this.format('INFO', args);
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
                console.log = this.originalLog;
                window.onerror = this.originalOnerror;
                clearValue && (this.value = '');
                this.listeners = [];
                this.initialized = false;
            }
            return this;
        }
        format(level, args) {
            return `[${new Date(Date.now()).toLocaleString()}] [${level}] : `
                + args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n';
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
        _media.addEventListener('play', loadDanmaku);
        console.log('Listener初始化完成');
    }

    function initUI() {
        // 已初始化
        if (document.getElementById(eleIds.danmakuCtr)) { return; }
        console.log('正在初始化UI');

        // 弹幕按钮容器 div
        const parent = document.querySelector(`${mediaContainerQueryStr} .videoOsdBottom-maincontrols .videoOsdBottom-buttons`);
        // 延时判断,精确 dom query 时播放器 UI 小概率暂未渲染
        if (!parent) {
            window.ede.destroyTimeoutIds.push(setTimeout(() => {
                console.log("retry initUI!");
                initUI();
            }, check_interval));
            return;
        }
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
    }

    async function getEmbyItemInfo() {
        return window.require(['playbackManager']).then((items) => items?.[0].currentItem());
    }

    async function fatchEmbyItemInfo(id) {
        return await ApiClient.getItem(ApiClient.getCurrentUserId(), id);
    }

    async function fetchSearchEpisodes(anime, episode, withRelated = true) {
        if (!anime) { throw new Error('anime is required'); }
        const searchUrl = `${apiPrefix}/search/episodes?anime=${anime}&withRelated=${withRelated}
            ${episode ? `&episode=${episode}` : ''}`;
        const animaInfo = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept-Encoding': 'gzip',
                Accept: 'application/json',
                'User-Agent': navigator.userAgent,
            },
        })
            .then((response) => response.json())
            .catch((error) => {
                console.log('查询失败:', error);
                return null;
            });
        console.log('查询成功', animaInfo);
        return animaInfo;
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
            episode: episode, // this is episode number, not a index
            animeName: animeName,
            seriesOrMovieId: item.SeriesId || item.Id,
        };
    }

    async function getEpisodeInfo(is_auto = true) {
        const itemInfoMap = await getMapByEmbyItemInfo();
        if (!itemInfoMap) { return null; }
        const { _episode_key, animeId } = itemInfoMap;
        let { animeName, episode } = itemInfoMap;
        if (is_auto && window.localStorage.getItem(_episode_key)) {
            return JSON.parse(window.localStorage.getItem(_episode_key));
        }

        let animeOriginalTitle = null;
        let animaInfo = await fetchSearchEpisodes(animeName, is_auto ? episode : null);
        if (is_auto && animaInfo.animes.length == 0) {
            // from: https://github.com/Izumiko/jellyfin-danmaku/blob/jellyfin/ede.js#L886
            console.log(`标题名: ${animeName},自动匹配未查询到结果,将使用原标题名,重试一次`);
            const seriesOrMovieInfo = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemInfoMap.seriesOrMovieId);
            if (seriesOrMovieInfo.OriginalTitle) {
                animeName = seriesOrMovieInfo.OriginalTitle;
                animaInfo = await fetchSearchEpisodes(animeName, is_auto ? episode : null);
                if (animaInfo.animes.length > 0) { console.log(`使用原标题名: ${animeName},自动匹配成功`); }
                animeOriginalTitle = animeName;
            }
        }
        if (animaInfo.animes.length == 0) {
            console.log(`弹幕查询无结果`);
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
        episode = 0;
        const episodeInfo = {
            episodeId: animaInfo.animes[selectAnime_id].episodes[episode].episodeId,
            episodeTitle: animaInfo.animes[selectAnime_id].type == 'tvseries'
                ? animaInfo.animes[selectAnime_id].episodes[episode].episodeTitle
                : null,
            animeId: animaInfo.animes[selectAnime_id].animeId,
            animeTitle: animaInfo.animes[selectAnime_id].animeTitle,
            animeOriginalTitle,
        };
        localStorage.setItem(_episode_key, JSON.stringify(episodeInfo));
        return episodeInfo;
    }

    function getComments(episodeId) {
        const url = apiPrefix + '/comment/' + episodeId + '?withRelated=true&chConvert=' + window.ede.chConvert;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Accept-Encoding': 'gzip',
                Accept: 'application/json',
                'User-Agent': navigator.userAgent,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('弹幕获取成功: ' + data.comments.length);
                return data.comments;
            })
            .catch((error) => {
                console.log('弹幕获取失败:', error);
                return null;
            });
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
        let wrapper = document.getElementById(eleIds.danmakuWrapper);
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
        // 弹幕基准速度,这里可以根据屏幕尺寸再计算添加倍率,不过还是设备上手调比较简单
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
                            getComments(episodeId).then((comments) => {
                                window.ede.danmuCache[episodeId] = comments;
                                createDanmaku(comments)
                                    .then(() => {
                                        console.log('弹幕就位');
                                        embyToast({ text: `弹幕就位,已获取 ${comments.length} 条弹幕` });
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
                const danmakuCtrEle = document.getElementById(eleIds.danmakuCtr);
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
                    },
                    [showSource.cid.id]: $comment.cid,
                    [showSource.source.id]: values[3].match(sourceUidReg)?.[1] || danmakuSource.DanDanPlay.id,
                    [showSource.originalUserId.id]: values[3].match(sourceUidReg)?.[2] || values[3],
                };
                cmt.text += showSourceIds.map(id => id === showSource.source.id ? `,[${cmt[id]}]` : ',' + cmt[id]).join('');
                cmt.cuid = cmt[showSource.cid.id] + ',' + cmt[showSource.originalUserId.id];
                return cmt;
            })
            .filter((x) => x);
    }

    async function createDialog() {
        const html = `<div id="${eleIds.dialogContainer}"></div>`;
        embyDialog({ html, buttons: [{ name: '关闭' }] });
        afterEmbyDialogCreated();
    }

    async function afterEmbyDialogCreated() {
        require(["css!modules/emby-elements/emby-textarea/emby-textarea.css"]);
        require(["css!modules/emby-elements/emby-select/emby-select.css"]);
        const itemInfoMap = await getMapByEmbyItemInfo();
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

        const dialogContainer = document.getElementById(eleIds.dialogContainer);
        let formDialogHeader = document.querySelector('.formDialogHeader');
        const formDialogFooter = document.querySelector('.formDialogFooter');
        if (!dialogContainer) {
            window.ede.destroyTimeoutIds.push(setTimeout(() => {
                console.log("retry dialogContainer!");
                afterEmbyDialogCreated();
            }, check_interval));
            return;
        }
        formDialogHeader = formDialogHeader || dialogContainer;
        const tabsMenuContainer = document.createElement('div');
        tabsMenuContainer.className = embyTabsMenuClass;
        tabsMenuContainer.appendChild(embyTabs(danmakuTabOpts, danmakuTabOpts[0].id, 'id', 'name', (index) => {
            danmakuTabOpts.forEach((obj, i) => {
                const elem = document.getElementById(obj.id);
                if (elem) { elem.hidden = i !== index; }
            });
        }));
        formDialogHeader.appendChild(tabsMenuContainer);
        formDialogHeader.style = 'width: 100%; padding: 0; height: auto;';

        danmakuTabOpts.forEach((tab, index) => {
            if (tab.hidden) { return; }
            const tabContainer = document.createElement('div');
            tabContainer.id = tab.id;
            tabContainer.style.textAlign = 'left';
            tabContainer.hidden = index != 0;
            dialogContainer.appendChild(tabContainer);
            tab.buildMethod(tab.id);
        });
        if (formDialogFooter) {
            formDialogFooter.style.padding = '0.3em';
        }
    }

    function buildDanmakuSetting(containerId) {
        const container = document.getElementById(containerId);
        let template =  `
            <div style="display: flex; justify-content: center;">
                <div>
                    <div id="${eleIds.danmakuSwitchDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">弹幕开关 </label>
                    </div>
                    <div id="${eleIds.danmakuChConverDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">简繁转换: </label>
                    </div>
                    <div id="${eleIds.danmakuEngineDiv}" style="margin-bottom: 0.2em;">
                        <label class="${embyLabelClass}">切换弹幕引擎: </label>
                    </div>
                    <label class="${embyLabelClass}">弹幕样式: </label>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">大小: </label>
                        <div id="${eleIds.danmakuSizeDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuSizeLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">透明度: </label>
                        <div id="${eleIds.danmakuOpacityDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuOpacityLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">速度: </label>
                        <div id="${eleIds.danmakuSpeedDiv}" style="width: 15.5em; text-align: center;"></div>
                        <label id="${eleIds.danmakuSpeedLabel}" style="width:4em;"></label>
                    </div>
                    <div style="${embySliderStyle}">
                        <label class="${embyLabelClass}" style="width:4em;">轴偏秒: </label>
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

        container.querySelector('#' + eleIds.danmakuSwitchDiv).prepend(
            embyButton({ id: eleIds.danmakuSwitch, label: '弹幕开关'
                , iconKey: lsGetItem(lsKeys.switch.id) ? iconKeys.switch_on : iconKeys.switch_off
                , style: (lsGetItem(lsKeys.switch.id) ? 'color:#52b54b;' : '') + 'font-size:1.5em;padding:0;' }
                // , style: lsGetItem(lsKeys.switch.id) ? 'color:#52b54b;font-size:1.5em;padding:0;': 'font-size:1.5em;padding:0;'}
                , doDanmakuSwitch)
        );
        container.querySelector('#' + eleIds.danmakuChConverDiv).appendChild(
            embyTabs(danmakuChConverOpts, window.ede.chConvert, 'id', 'name', doDanmakuChConverChange)
        );
        container.querySelector('#' + eleIds.danmakuEngineDiv).appendChild(
            embyTabs(danmakuEngineOpts, lsGetItem(lsKeys.engine.id), 'id', 'name', doDanmakuEngineSelect)
        );
        // 滑块
        const fontSizeRate = lsGetItem(lsKeys.fontSizeRate.id);
        const fontOpacity = lsGetItem(lsKeys.fontOpacity.id);
        const danmakuSpeed = lsGetItem(lsKeys.speed.id);
        const sizeSlider = embySlider({ labelId: eleIds.danmakuSizeLabel, key: lsKeys.fontSizeRate.id }
            , { value: fontSizeRate }, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        const alphaSlider = embySlider({ labelId: eleIds.danmakuOpacityLabel, key: lsKeys.fontOpacity.id }
            , { max: 1, value: fontOpacity }, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        const speedSlider = embySlider({ labelId: eleIds.danmakuSpeedLabel, key: lsKeys.speed.id }
            , { value: danmakuSpeed }, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        container.querySelector('#' + eleIds.danmakuSizeDiv).appendChild(sizeSlider);
        container.querySelector('#' + eleIds.danmakuOpacityDiv).appendChild(alphaSlider);
        container.querySelector('#' + eleIds.danmakuSpeedDiv).appendChild(speedSlider);
        document.getElementById(eleIds.danmakuSizeLabel).innerText = fontSizeRate;
        document.getElementById(eleIds.danmakuOpacityLabel).innerText = fontOpacity;
        document.getElementById(eleIds.danmakuSpeedLabel).innerText = danmakuSpeed;
        // 弹幕时间轴偏移秒数
        const btnContainer = container.querySelector('#' + eleIds.timelineOffsetDiv);
        const timelineOffsetOpts = { labelId: eleIds.timelineOffsetLabel, key: lsKeys.timelineOffset.id };
        onDanmakuStyleChangeLabel(lsGetItem(lsKeys.timelineOffset.id), timelineOffsetOpts);
        timelineOffsetBtns.forEach(btn => {
            btnContainer.appendChild(embyButton(btn, (e) => {
                if (e.target) {
                    let oldValue = lsGetItem(lsKeys.timelineOffset.id);
                    let newValue = oldValue + (parseFloat(e.target.getAttribute('valueOffset')) || 0);
                    // 如果 offset 为 0,则 newValue 应该设置为 0
                    if (newValue === oldValue) { newValue = 0; }
                    onDanmakuStyleChange(newValue, timelineOffsetOpts);
                }
            }));
        });
        // 配置 JSON 导入,导出
        const settingsCtrlEle = container.querySelector('#' + eleIds.settingsCtrl);
        settingsCtrlEle.appendChild(
            embyButton({ label: '配置', iconKey: iconKeys.more }, doShowSettingsText)
        );
        settingsCtrlEle.appendChild(
            embyButton({ id: eleIds.settingReloadBtn, label: '刷新', iconKey: iconKeys.refresh, style: 'display: none;' }
                , () => document.getElementById(eleIds.settingsText).value = getSettingsJson(2))
        );
        settingsCtrlEle.appendChild(
            embyButton({ id: eleIds.settingsImportBtn, label: '应用', iconKey: iconKeys.done, style: 'display: none;' }, () => {
                lsMultiSet(JSON.parse(document.getElementById(eleIds.settingsText).value));
                loadDanmaku(LOAD_TYPE.INIT);
                closeEmbyDialog();
            })
        );
    }

    function buildSearchEpisode(containerId) {
        const container = document.getElementById(containerId);
        let template = `
            <div>
                <div>
                    <label class="${embyLabelClass}">标题: </label>
                    <div style="display: flex;" id="${eleIds.danmakuSearchNameDiv}"></div>
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
            </div>
        `;
        container.innerHTML = template.trim();
        const searchNameDiv = container.querySelector('#' + eleIds.danmakuSearchNameDiv);
        searchNameDiv.appendChild(embyInput({id: eleIds.danmakuSearchName, value: window.ede.searchDanmakuOpts.animeName, type: 'search'}
            , doDanmakuSearchEpisode));
        searchNameDiv.appendChild(embyButton({ id: eleIds.danmakuSearchEpisode, label: '搜索', iconKey: iconKeys.search}
            , doDanmakuSearchEpisode));
        searchNameDiv.appendChild(embyButton({ label: '切换[原]标题', iconKey: iconKeys.text_format }, doSearchTitleSwtich));
        container.querySelector('#' + eleIds.danmakuEpisodeLoad).appendChild(
            embyButton({ id: eleIds.danmakuSwitchEpisode, label: '加载弹幕', iconKey: iconKeys.done }, doDanmakuSwitchEpisode)
        );
    }

    function buildCurrentDanmakuInfo(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !window.ede.episode_info) { return; }
        const { episodeTitle, animeId, animeTitle } = window.ede.episode_info;
        const imgSrc = `https://img.dandanplay.net/anime/${animeId}.jpg`;
        const loadSum = window.ede.danmaku?.comments.length ?? 0;
        const downloadSum = window.ede.commentsParsed.length;
        let template = `
            <div style="display: flex;">
                ${!animeId || animeId === -1 ? '' :
                `<img src="${imgSrc}" style="width: 20%;height: 100%;margin-right: 2%;" 
                    loading="lazy" decoding="async" draggable="false" class="coveredImage-noScale"></img>`}
                <div>
                    <div>
                        <label class="${embyLabelClass}">媒体名: </label>
                        <div class="${embyTextDivClass}">${animeTitle}</div>
                    </div>
                    ${!episodeTitle ? '' :
                    `<div>
                        <label class="${embyLabelClass}">分集名: </label>
                        <div class="${embyTextDivClass}">${episodeTitle}</div>
                    </div>`}
                    <div>
                        <label class="${embyLabelClass}">其它信息: </label>
                        <div class="${embyTextDivClass}">
                            获取总数: ${downloadSum}, 
                            加载总数: ${loadSum}, 
                            被过滤数: ${downloadSum - loadSum}
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 2%;">
                <label class="${embyLabelClass}">弹幕列表: </label>
                <div id="${eleIds.danmuListDiv}" style="margin: 1% 0;"></div>
                <textarea id="${eleIds.danmuListText}" readOnly style="display: none;resize: vertical;width: 100%" rows="8" 
                    is="emby-textarea" class="txtOverview emby-textarea"></textarea>
            </div>
        `;
        container.innerHTML = template.trim();

        container.querySelector('#' + eleIds.danmuListDiv).appendChild(
            embyTabs(danmuListOpts, lsKeys.danmuList.defaultValue, 'id', 'name', doDanmuListOptsChange)
        );
    }

    function buildDanmakuFilter(containerId) {
        const container = document.getElementById(containerId);
        let template = `
            <div>
                <div id="${eleIds.danmakuTypeFilterDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">屏蔽类型: </label>
                </div>
                <div id="${eleIds.danmakuSourceFilterDiv}">
                    <label class="${embyLabelClass}">屏蔽来源平台: </label>
                </div>
                <div id="${eleIds.danmakuShowSourceDiv}">
                    <label class="${embyLabelClass}">显示每条来源: </label>
                </div>
                <div id="${eleIds.danmakuFilterLevelDiv}">
                    <label class="${embyLabelClass}">密度等级: </label>
                </div>
                <div id="${eleIds.danmakuHeightRateDiv}">
                    <label class="${embyLabelClass}">高度比例: </label>
                </div>
                <div id="${eleIds.filterKeywordsDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">屏蔽关键词: </label>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();

        container.querySelector('#' + eleIds.danmakuTypeFilterDiv).appendChild(
            embyCheckboxList(null, eleIds.danmakuTypeFilterSelectName
                , lsGetItem(lsKeys.typeFilter.id), Object.values(danmakuTypeFilterOpts), doDanmakuTypeFilterSelect)
        );
        container.querySelector('#' + eleIds.danmakuSourceFilterDiv).appendChild(
            embyCheckboxList(null, eleIds.danmakuSourceFilterSelectName
                , lsGetItem(lsKeys.sourceFilter.id), Object.values(danmakuSource), doDanmakuSourceFilterSelect)
        );
        container.querySelector('#' + eleIds.danmakuShowSourceDiv).appendChild(
            embyCheckboxList(null, eleIds.danmakuShowSourceSelectName
                , lsGetItem(lsKeys.showSource.id), Object.values(showSource), doDanmakuShowSourceSelect)
        );
        container.querySelector('#' + eleIds.danmakuFilterLevelDiv).appendChild(
            embyTabs(danmakuFilterLevelOpts, lsGetItem(lsKeys.filterLevel.id)
                , 'id', 'name', doDanmakuFilterLevelChange)
        );
        container.querySelector('#' + eleIds.danmakuHeightRateDiv).appendChild(
            embyTabs(danmakuHeightRateOpts, lsGetItem(lsKeys.heightRate.id) 
                , 'id', 'name', doDanmakuHeightRateChange)
        );
        // 屏蔽关键词
        const keywordsContainer = container.querySelector('#' + eleIds.filterKeywordsDiv);
        const keywordsEnableDiv = keywordsContainer.appendChild(document.createElement('div'));
        const keywordsBtn = embyButton({ label: '加载关键词过滤', iconKey: iconKeys.done_disabled }, doDanmakuFilterKeywordsBtnClick);
        keywordsBtn.disabled = true;
        keywordsEnableDiv.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; width: 100%;');
        keywordsEnableDiv.appendChild(embyCheckbox({ id: eleIds.filterKeywordsEnableId, label: '启用' }
            , lsGetItem(lsKeys.filterKeywordsEnable.id), (flag) => updateFilterKeywordsBtn(keywordsBtn, flag
                , document.getElementById(eleIds.filterKeywordsId).value.trim()))
        );
        keywordsEnableDiv.appendChild(document.createElement('div')).appendChild(keywordsBtn);
        keywordsContainer.appendChild(document.createElement('div')).appendChild(
            embyTextarea({id: eleIds.filterKeywordsId, value: lsGetItem(lsKeys.filterKeywords.id)
                , style: 'width: 100%;margin-top: 0.2em;', rows: 8}, (event) => updateFilterKeywordsBtn(keywordsBtn
                , document.getElementById(eleIds.filterKeywordsEnableId).checked, event.target.value.trim()))
        );
        const label = document.createElement('label');
        label.innerText = `关键词/正则匹配过滤,支持过滤[正文,${Object.values(showSource).map(o => o.name).join()}],多个表达式用换行分隔`;
        label.className = 'fieldDescription';
        keywordsContainer.appendChild(document.createElement('div')).appendChild(label);
    }

    function buildAbout(containerId) {
        const container = document.getElementById(containerId);
        if (!container) { return; }
        let template = `
            <div id="${eleIds.consoleLogCtrl}"></div>
            <textarea id="${eleIds.consoleLogText}" readOnly style="resize: vertical;width: 100%;margin-top: 0.6em;" 
                rows="14" is="emby-textarea" class="txtOverview emby-textarea"></textarea>
            <div class="fieldDescription">注意开启后原本控制台中调用方将被覆盖,不使用请保持关闭状态<div>
        `;
        container.innerHTML = template.trim();
        buildConsoleLog(container);
    }

    function buildConsoleLog(container) {
        const consoleLogEnable = lsGetItem(lsKeys.consoleLogEnable.id);
        const consoleLogTextEle = container.querySelector('#' + eleIds.consoleLogText);
        consoleLogTextEle.style.display = consoleLogEnable ? '' : 'none';
        if (consoleLogEnable) { doConsoleLogChange(consoleLogEnable); }
        const consoleLogCtrlEle = container.querySelector('#' + eleIds.consoleLogCtrl);
        consoleLogCtrlEle.appendChild(embyCheckbox({ label: '启用控制台日志' }, consoleLogEnable, doConsoleLogChange));
        consoleLogCtrlEle.appendChild(
            embyButton({ label: '清除', iconKey: iconKeys.block }
                , () => { consoleLogTextEle.value = ''; window.ede.appLogAspect.value = ''; })
        );
    }
    
    function doDanmakuSwitch() {
        console.log('切换弹幕开关');
        const flag = !lsGetItem(lsKeys.switch.id);
        flag ? window.ede.danmaku.show() : window.ede.danmaku.hide();
        document.getElementById(eleIds.danmakuSwitchBtn).firstChild.innerHTML = flag ? iconKeys.comment : iconKeys.comments_disabled;
        const switchElement = document.getElementById(eleIds.danmakuSwitch);
        if (switchElement) {
            switchElement.firstChild.innerHTML = flag ? iconKeys.switch_on : iconKeys.switch_off;
            switchElement.style.color = flag ? '#52b54b' : '';
        }
        lsSetItem(lsKeys.switch.id, flag);
    }

    async function doDanmakuSearchEpisode() {
        let embySearch = document.getElementById(eleIds.danmakuSearchName);
        if (!embySearch) { return; }
        let searchName = embySearch.value
        const danmakuRemarkEle = document.getElementById(eleIds.danmakuRemark);
        danmakuRemarkEle.innerText = searchName ? '' : '请填写标题';
        const spinnerEle = document.querySelector(".mdl-spinner");
        spinnerEle.classList.remove('hide');
        
        const animaInfo = await fetchSearchEpisodes(searchName);
        spinnerEle.classList.add('hide');
        if (!animaInfo || animaInfo.animes.length < 1) {
            danmakuRemarkEle.innerText = '搜索结果为空';
            document.getElementById(eleIds.danmakuSwitchEpisode).disabled = true;
            document.getElementById(eleIds.danmakuEpisodeFlag).hidden = true;
            return;
        } else {
            danmakuRemarkEle.innerText = '';
        }
        const danmakuAnimeDiv = document.getElementById(eleIds.danmakuAnimeDiv);
        const danmakuEpisodeNumDiv = document.getElementById(eleIds.danmakuEpisodeNumDiv);
        danmakuAnimeDiv.innerHTML = '';
        danmakuEpisodeNumDiv.innerHTML = '';
        const animes = animaInfo.animes;
        window.ede.searchDanmakuOpts.animes = animes;

        let selectAnimeIdx = animes.findIndex(anime => anime.animeId == window.ede.searchDanmakuOpts.animeId);
        selectAnimeIdx = selectAnimeIdx !== -1 ? selectAnimeIdx : 0;
        const animeSelect = embySelect({ id: eleIds.danmakuAnimeSelect, label: '剧集: ', style: 'width: auto;max-width: 100%;' }
            , selectAnimeIdx, animes, 'animeId', opt => `${opt.animeTitle} 类型：${opt.typeDescription}`, doDanmakuAnimeSelect);
        danmakuAnimeDiv.appendChild(animeSelect);
        const episodeNumSelect = embySelect({ id: eleIds.danmakuEpisodeNumSelect, label: '集数: ', style: 'width: auto;max-width: 100%;' }
            , window.ede.searchDanmakuOpts.episode, animes[selectAnimeIdx].episodes, 'episodeId', 'episodeTitle');
        danmakuEpisodeNumDiv.appendChild(episodeNumSelect);
        document.getElementById(eleIds.danmakuEpisodeFlag).hidden = false;
        document.getElementById(eleIds.danmakuSwitchEpisode).disabled = false;
        document.getElementById(eleIds.searchImg).src = 
            `https://img.dandanplay.net/anime/${animes[selectAnimeIdx].animeId}.jpg`;
    }

    function doSearchTitleSwtich(e) {
        const searchInputEle = document.getElementById(eleIds.danmakuSearchName);
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
        const numDiv = document.getElementById(eleIds.danmakuEpisodeNumDiv);
        numDiv.innerHTML = '';
        const anime = window.ede.searchDanmakuOpts.animes[index];
        const episodeNumSelect = embySelect({ id: eleIds.danmakuEpisodeNumSelect, label: '集数: ' }, index
            , anime.episodes, 'episodeId', 'episodeTitle');
        episodeNumSelect.style.maxWidth = '100%';
        numDiv.appendChild(episodeNumSelect);
        document.getElementById(eleIds.searchImg).src = 
            `https://img.dandanplay.net/anime/${anime.animeId}.jpg`;
    }

    function doDanmakuSwitchEpisode() {
        const animeSelect = document.getElementById(eleIds.danmakuAnimeSelect);
        const episodeNumSelect = document.getElementById(eleIds.danmakuEpisodeNumSelect);
        const anime = window.ede.searchDanmakuOpts.animes[animeSelect.selectedIndex];

        const episodeInfo = {
            episodeId: episodeNumSelect.value,
            episodeTitle: anime.type == 'tvseries' 
                ?  episodeNumSelect.options[episodeNumSelect.selectedIndex].text
                : null,
            animeId: anime.animeId,
            animeTitle: anime.animeTitle,
        }
        localStorage.setItem(window.ede.searchDanmakuOpts._episode_key, JSON.stringify(episodeInfo));
        console.log(`手动匹配信息:`, episodeInfo);
        loadDanmaku(LOAD_TYPE.RELOAD);
        closeEmbyDialog();
    }

    function doDanmakuEngineSelect(index) {
        let selectedValue = danmakuEngineOpts[index].id;
        if (lsCheckSet(lsKeys.engine.id, selectedValue)) { 
            console.log(`已更改弹幕引擎为: ${selectedValue}`);
            loadDanmaku(LOAD_TYPE.RELOAD);
        }
    }

    function doDanmakuChConverChange(index) {
        window.ede.chConvert = danmakuChConverOpts[index].id;
        lsSetItem(lsKeys.chConvert.id, window.ede.chConvert);
        loadDanmaku(LOAD_TYPE.REFRESH);
        console.log(danmakuChConverOpts[index].name);
    }

    function doDanmakuFilterLevelChange(index) {
        const level = parseInt(danmakuFilterLevelOpts[index].id);
        console.log(`切换弹幕密度等级: ${level}`);
        if (lsCheckSet(lsKeys.filterLevel.id, level)) { loadDanmaku(LOAD_TYPE.RELOAD); }
    }

    function doDanmakuHeightRateChange(index) {
        const valueStr = danmakuHeightRateOpts[index].id;
        console.log(`切换弹幕高度比例: ${valueStr}`);
        if (lsCheckSet(lsKeys.heightRate.id, valueStr)) { loadDanmaku(LOAD_TYPE.RELOAD); }
    }

    function doDanmuListOptsChange(index) {
        const danmuListEle = document.getElementById(eleIds.danmuListText);
        danmuListEle.style.display = index == lsKeys.danmuList.defaultValue ? 'none' : '';
        const f = new Intl.DateTimeFormat('default', { minute: '2-digit', second: '2-digit' });
        danmuListEle.value = danmuListOpts[index].onChange(window.ede)
            .map((c, i) => `[${i + 1}] [${f.format(new Date(c.time * 1000))}] : `
                + `${c.text} [${c.source}],[${c.originalUserId}],[${c.cid}]`
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

    function onDanmakuStyleChange(val, props) {
        onDanmakuStyleChangeLabel(val, props);
        if (props?.key && lsCheckSet(props.key, val)) {
            console.log(`${props.key} changed to ${val}`);
            loadDanmaku(LOAD_TYPE.RELOAD);
        }
    }

    function onDanmakuStyleChangeLabel(val, props) {
        if (props?.labelId) { document.getElementById(props.labelId).innerText = val; }
    }

    function doShowSettingsText(event) {
        const checked = !event.target.checked;
        event.target.checked = checked;
        event.target.title = checked ? '关闭' : '配置';
        event.target.firstChild.innerHTML = checked ? iconKeys.close : iconKeys.more;
        const settingsTextEle = document.getElementById(eleIds.settingsText);
        settingsTextEle.style.display = checked ? '' : 'none';
        if (checked) { settingsTextEle.value = getSettingsJson(2); }
        [eleIds.settingReloadBtn, eleIds.settingsImportBtn].forEach(id => {
            document.getElementById(id).style.display = checked ? '' : 'none';
        });
    }
    
    function doDanmakuFilterKeywordsBtnClick(event) {
        const btn = event.currentTarget;
        if (btn) {
            btn.style = '';
            btn.disabled = true;
        }
        let keywords = document.getElementById(eleIds.filterKeywordsId).value.trim();
        let enable = document.getElementById(eleIds.filterKeywordsEnableId).checked;
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
        const consoleLogTextEle = document.getElementById(eleIds.consoleLogText);
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
                }
            });
        } else {
            consoleLogTextEle.value = '';
            window.ede.appLogAspect.destroy();
            window.ede.appLogAspect = null;
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
            input.addEventListener('keyup', (e) => { if (e.key === 'Enter') { onEnter(e); } });
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
            button.innerHTML = `<i class="md-icon autortl" style="pointer-events: none;">${props.iconKey}</i>`;
            button.className = embyIconButtonClass;
        } else {
            button.className = 'btnOption raised emby-button';
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
            if (option.hidden) { return; }
            const value = getValueOrInvoke(option, optionValueKey);
            const title = getValueOrInvoke(option, optionTitleKey);
            const tabButton = document.createElement('button');
            tabButton.className = `${embyTabsButtonClass}${value == selectedValue ? ' emby-tab-button-active' : ''}`;
            tabButton.setAttribute('data-index', index);
            tabButton.textContent = title;
            tabsSlider.appendChild(tabButton);
        });
        tabs.appendChild(tabsSlider);
        if (typeof onChange === 'function') {
            tabs.addEventListener('tabchange', e => onChange(e.detail.selectedTabIndex));
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
            selectElement.appendChild(optionElement);
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
            checkboxContainer.appendChild(embyCheckbox({ name: checkBoxName, label: option.name, value: option.id }
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
        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(span);
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
        const defaultOpts = { min: 0.1, max: 3, step: 0.1, orient: 'horizontal', 'data-bubble': false, 'data-hoverthumb': true , style: ''};
        options = { ...defaultOpts, ...options };
        const slider = document.createElement('input', { is: 'emby-slider' });
        slider.setAttribute('type', 'range');
        if (props.id) { slider.setAttribute('id', props.id); }
        Object.entries(options).forEach(([key, value]) => slider.setAttribute(key, value));
        if (options.value) { slider.setValue(options.value);}
        // other EventListeners : 'beginediting'(every step), 'endediting'(end of tap/swipe)
        if (typeof onChange === 'function') {
            // Trigger after end of tap/swipe
            slider.addEventListener('change', e => onChange(e.target.value, props));
        }
        if (typeof onSliding === 'function') {
            // when clicking/sliding, trigger every step
            slider.addEventListener('input', e => onSliding(e.target.value, props));
        }
        // 以下兼容旧版本emby,控制器操作锁定滑块焦点
        slider.addEventListener('keydown', e => {
            const step = parseFloat(slider.step) || 1;
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);
            let value = parseFloat(slider.value);
            const orient = slider.getAttribute('orient') || 'horizontal';
            switch (e.key) {
                case "ArrowLeft":
                case "ArrowRight":
                    if (orient === 'horizontal' 
                            && ((e.key === "ArrowLeft" && value > min) || (e.key === "ArrowRight" && value < max))) {
                        e.preventDefault();
                        e.stopPropagation();
                        value += e.key === "ArrowLeft" ? -step : step;
                        value = Math.min(Math.max(value, min), max);
                        slider.value = value;
                        slider.dispatchEvent(new Event('input'));
                        slider.dispatchEvent(new Event('change'));
                    }
                    break;
                case "ArrowUp":
                case "ArrowDown":
                    if (orient === 'vertical' 
                            && ((e.key === "ArrowDown" && value > min) || (e.key === "ArrowUp" && value < max))) {
                        e.preventDefault();
                        e.stopPropagation();
                        value += e.key === "ArrowUp" ? step : -step;
                        value = Math.min(Math.max(value, min), max);
                        slider.value = value;
                        slider.dispatchEvent(new Event('input'));
                        slider.dispatchEvent(new Event('change'));
                    }
                    break;
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
            .catch(error => { console.log(`点击弹出框外部取消: ` + error) });
    }

    function closeEmbyDialog() {
        document.querySelector('.formDialogFooterItem').dispatchEvent(new Event('click'));
    }

    // see: ../web/modules/common/dialogs/alert.js
    async function embyAlert(opts = {}) {
        const defaultOpts = { text: '', title: '', timeout: 0, html: ''};
        opts = { ...defaultOpts, ...opts };
        return require(['alert']).then(items => items[0]?.(opts))
            .catch(error => { console.log(`点击弹出框外部取消: ` + error) });
    }

    // see: ../web/modules/toast/toast.js
    async function embyToast(opts = {}) {
        const defaultOpts = { text: '', secondaryText: '', icon: '', iconStrikeThrough: false};
        opts = { ...defaultOpts, ...opts };
        return require(['toast'], toast => toast(opts));
    }

    function getValueOrInvoke(option, keyOrFunc) {
        return typeof keyOrFunc === 'function' ? keyOrFunc(option) : option[keyOrFunc];
    }

    function getSettingsJson(space = 4) {
        return JSON.stringify(Object.fromEntries(Object.entries(lsKeys).map(([key, value]) => [value.id, lsGetItem(value.id)])), null, space);
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
    function lsMultiSet(keyValues, needCheck = true) {
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

    // from emby videoosd.js bindToPlayer events, warning: not dom event
    function playbackEventsOn(eventsMap, data = {}) {
        require(['playbackManager', 'events'], (playbackManager, events) => {
            if (!playbackManager || !events) { return; }
            const player = playbackManager.getCurrentPlayer();
            const playState = playbackManager.getPlayerState().PlayState;
            Object.entries(eventsMap).forEach(([eventName, fn]) => {
                events.off(player, eventName, fn);
                events.on(player, eventName, (e, ...args) => {
                    fn(e, ...args, { playbackManager, events, player, playState, ...data });
                    // 禁止在 timeupdate 回调中打印日志及复杂操作,每秒都会触发一次
                    if ('timeupdate' != eventName) {
                        console.log(`playbackEventsOn ${eventName} event: ${fn.name}`);
                    }
                });
            });
        });
    }

    function initH5VideoAdapter() {
        let _media = document.querySelector(mediaQueryStr);
        if (_media) { return; }
        console.log('页面上不存在 video 标签,适配器处理开始');
        _media = document.createElement('video');
        _media.id = eleIds.h5VideoAdapter;
        _media.classList.add('htmlvideoplayer', 'moveUpSubtitles');
        document.body.prepend(_media);
        _media.play();

        // 需在其它事件中实现,同步 video 适配器播放倍率,有 bug 未实现且只显示半屏,暂时注释
        // if (!_media.src) {
        //     _media.playbackRate = data.playbackManager.getPlayerState().PlayState.PlaybackRate ?? 1;
        // }
        playbackEventsOn({
            // conver to seconds from Ticks
            'timeupdate': (e, data) => _media.currentTime = data.playbackManager.currentTime(data.player) / 1e7,
            'pause': (e, data) => _media.dispatchEvent(new Event('pause')),
            'unpause': (e, data) => _media.dispatchEvent(new Event('play')),
        });
        console.log('已创建虚拟 video 标签,适配器处理正确结束');
        embyToast({ text: `已创建虚拟 video 标签,适配器处理正确结束` });
    }

    function beforeDestroy() {
        // 此段销毁不重要,可有可无,仅是规范使用,清除弹幕,但未销毁 danmaku 实例
        window.ede.danmaku?.clear();
        window.ede.appLogAspect?.destroy();
        window.ede.appLogAspect = null;
        // 销毁弹幕按钮容器简单,双 mediaContainerQueryStr 下免去 DOM 位移操作
        document.getElementById(eleIds.danmakuCtr)?.remove();
        // 销毁定时器
        window.ede.destroyTimeoutIds.forEach(id => clearTimeout(id));
        window.ede.destroyTimeoutIds = [];
        // 退出播放页面重置轴偏秒
        lsSetItem(lsKeys.timelineOffset.id, lsKeys.timelineOffset.defaultValue);
    }

    // emby/jellyfin CustomEvent. see: https://github.com/MediaBrowser/emby-web-defaultskin/blob/822273018b82a4c63c2df7618020fb837656868d/nowplaying/videoosd.js#L698
    document.addEventListener('viewshow', function (e) {
        console.log('viewshow', e);
        if (e.detail.type === 'video-osd') {
            window.ede = new EDE();
            if (lsGetItem(lsKeys.consoleLogEnable.id)) {
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
