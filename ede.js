// ==UserScript==
// @name         Emby danmaku extension
// @description  Emby弹幕插件
// @namespace    https://github.com/RyoLee
// @author       RyoLee
// @version      1.20
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
    const showSettingBtns = false;  // 是否播放界面下方显示弹幕设置按钮（简繁转换、屏蔽等级、弹幕信息、弹幕大小）
    // Danmaku 依赖路径,index.html 引入的和篡改猴环境不用填,依赖已内置,被 eval() 执行的特殊环境下使用,支持相对绝对网络路径
    // const requireDanmakuPath = "danmaku.min.js";
    // 默认是相对路径等同 https://emby/web/ 和 /system/dashboard-ui/ ,非浏览器客户端必须使用网络路径
    const requireDanmakuPath = "https://fastly.jsdelivr.net/gh/weizhenye/danmaku@2.0.6/dist/danmaku.min.js";
    // ------ 用户配置 start ------
    // ------ 程序内部使用,请勿更改 start ------
    const dandanplayApi = "https://api.9-ch.com/cors/https://api.dandanplay.net/api/v2";
    let embyItemId = '';
    let isJellyfin = false;
    const check_interval = 200;
    const chConverTtitle = ['当前状态: 未启用', '当前状态: 转换为简体', '当前状态: 转换为繁体'];
    const danmuCache = {};
    const LOAD_TYPE = {
        CHECK: 'check',
        INIT: 'init',
        REFRESH: 'refresh',
        RELOAD: 'reload',
        SEARCH: 'search',
    };
    // 0:当前状态关闭 1:当前状态打开
    // const danmaku_icons = ['\uE0B9', '\uE7A2'];
    const danmaku_icons = ['\uE7A2', '\uE0B9'];
    // const search_icon = '\uE881';
    const search_icon = 'tune';
    const translate_icon = '\uE927';
    const info_icon = '\uE0E0';
    const filter_icons = ['\uE3E0', '\uE3D0', '\uE3D1', '\uE3D2'];
    const danmuStyleSetter_icon = '\uE0F0';
    const buttonOptions = {
        // class: 'paper-icon-button-light',
        class: 'osdIconButton paper-icon-button-light',
        is: 'paper-icon-button-light',
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
    const displayButtonOpts = {
        title: '弹幕开关',
        id: 'displayDanmaku',
        innerText: null,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('切换弹幕开关');
            window.ede.danmakuSwitch = (window.ede.danmakuSwitch + 1) % 2;
            window.localStorage.setItem(lsKeys.danmakuSwitch, window.ede.danmakuSwitch);
            document.querySelector('#displayDanmaku').children[0].innerText = danmaku_icons[window.ede.danmakuSwitch];
            if (window.ede.danmaku) {
                window.ede.danmakuSwitch == 1 ? window.ede.danmaku.show() : window.ede.danmaku.hide();
            }
        },
    };
    const searchButtonOpts = {
        title: '弹幕设置',
        id: 'searchDanmaku',
        iconKey: search_icon,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            createDialog();
        },
    };
    // if showSettingBtns = true -- start --
    const translateButtonOpts = {
        title: null,
        id: 'translateDanmaku',
        innerText: translate_icon,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('切换简繁转换');
            window.ede.chConvert = (window.ede.chConvert + 1) % 3;
            window.localStorage.setItem(lsKeys.chConvert, window.ede.chConvert);
            document.querySelector('#translateDanmaku').setAttribute('title', chConverTtitle[window.ede.chConvert]);
            loadDanmaku(LOAD_TYPE.REFRESH);
            console.log(document.querySelector('#translateDanmaku').getAttribute('title'));
        },
    };
    const infoButtonOpts = {
        title: '弹幕信息',
        id: 'printDanmakuInfo',
        innerText: info_icon,
        onclick: () => {
            if (!window.ede.episode_info || window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('显示当前信息');
            let msg = '动画名称:' + window.ede.episode_info.animeTitle;
            if (window.ede.episode_info.episodeTitle) {
                msg += '\n分集名称:' + window.ede.episode_info.episodeTitle;
            }
            sendNotification('当前弹幕匹配', msg);
        },
    };

    const filterButtonOpts = {
        title: '弹幕密度等级',
        id: 'filteringDanmaku',
        innerText: null,
        onclick: () => { 
            let level = parseInt(window.localStorage.getItem(lsKeys.danmakuFilterLevel) ?? 0);
            level = (level + 1) % 4;
            console.log(`切换弹幕密度等级: ${level}`);
            doDanmakuChange({ danmakuFilterLevel: level });
            document.getElementById(eleIds.filteringDanmaku).children[0].innerText = filter_icons[level];
        },
    };
    // if showSettingBtns = true -- end --

    const lsKeys = {
        // ede
        chConvert: 'chConvert',
        danmakuSwitch: 'danmakuSwitch',
        danmakuFilterLevel: 'danmakuFilterLevel',
        // createResizeButton
        danmakuFontSizeMagnification: 'danmakuFontSizeMagnification',
        danmakuFontOpacity: 'danmakuFontOpacity',
        danmakuSpeed: 'danmakuSpeed',
        danmakuTimelineOffset: 'danmakuTimelineOffset',
        // setButtonEvent
        danmakuTypeFilter: 'danmakuTypeFilter',
        danmakuEngine: 'danmakuEngine',
    };
    const eleIds = {
        danmakuCtr: 'danmakuCtr',
        h5VideoAdapterContainer: 'h5VideoAdapterContainer',
        dialogContainer: 'dialogContainer',
        // searchEpisodeInfoHtml
        danmakuSwitchDiv: 'danmakuSwitchDiv',
        danmakuSwitch: 'danmakuSwitch',
        danmakuSearchNameDiv: 'danmakuSearchNameDiv',
        danmakuSearchName: 'danmakuSearchName',
        danmakuSearchEpisode: 'danmakuSearchEpisode',
        danmakuEpisodeFlag: 'danmakuEpisodeFlag',
        danmakuEpisodeDiv: 'danmakuEpisodeDiv',
        danmakuSwitchEpisode: 'danmakuSwitchEpisode',
        danmakuEpisodeNumDiv: 'danmakuEpisodeNumDiv',
        danmakuEpisodeLoad: 'danmakuEpisodeLoad',
        danmakuRemark: 'danmakuRemark',
        danmakuEpisodeSelect: 'danmakuEpisodeSelect',
        danmakuEpisodeNumSelect: 'danmakuEpisodeNumSelect',
        // danmakuSetting
        filteringDanmaku: filterButtonOpts.id,
        danmakuTypeFilterDiv: 'danmakuTypeFilterDiv',
        danmakuTypeFilterLabel: 'danmakuTypeFilterLabel',
        danmakuTypeFilterSelect: 'danmakuTypeFilterSelect',
        danmakuTypeFilterSelectName: 'danmakuTypeFilterSelectName',
        danmakuEngineDiv: 'danmakuEngineDiv',
        danmakuEngineSelect: 'danmakuEngineSelect',
        danmakuChConverDiv: 'danmakuChConverDiv',
        danmakuFilterLevelDiv: 'danmakuFilterLevelDiv',
        // danmakuStyle
        danmakuSizeDiv: 'danmakuSizeDiv',
        danmakuSizeLabel: 'danmakuSizeLabel',
        danmakuAlphaDiv: 'danmakuAlphaDiv',
        danmakuAlphaLabel: 'danmakuAlphaLabel',
        danmakuSpeedDiv: 'danmakuSpeedDiv',
        danmakuSpeedLabel: 'danmakuSpeedLabel',
        danmakuOffsetDiv: 'danmakuOffsetDiv',
        danmakuOffsetLabel: 'danmakuOffsetLabel',
        // filterKeywords
        filterKeywordsEnableId: 'filterKeywordsEnableId',
        filterKeywordsId: 'filterKeywordsId',
        filterKeywordsDiv: 'filterKeywordsDiv',
        filterKeywordsBtn: 'filterKeywordsBtn',
    };
    // emby ui class
    const embyLabelClass = 'inputLabel';
    const embyInputClass = 'txtName txtInput-withlockedfield emby-input emby-input-largerfont emby-input-smaller';
    const embyIconButtonClass = 'itemAction paper-icon-button-light';
    const embySelectWrapperClass = 'emby-select-wrapper emby-select-wrapper-smaller';
    const embyCheckboxListClass = 'featureList'; // 'checkboxList'
    const embyTextDivClass = 'txtPath fieldDescription';
    const embyTabsMenuClass = 'headerMiddle headerSection sectionTabs headerMiddle-withSectionTabs';
    const embyTabsDivClass1 = 'tabs-viewmenubar tabs-viewmenubar-backgroundcontainer focusable scrollX hiddenScrollX smoothScrollX scrollFrameX emby-tabs';
    const embyTabsDivClass2 = 'tabs-viewmenubar-slider emby-tabs-slider padded-left padded-right nohoverfocus scrollSliderX';
    const embyTabsButtonClass = 'emby-button secondaryText emby-tab-button main-tab-button';
    const embySelectStyle = 'font-size: inherit;font-family: inherit;font-weight: inherit;padding-top: 0;padding-bottom: 0;box-sizing: border-box;outline: 0 !important;-webkit-tap-highlight-color: transparent;width: auto;border-radius: .3em;letter-spacing: inherit;padding-inline-start: 1ch;padding-inline-end: 3.6ch;height: 2.4em;';
    const embyCheckboxListStyle = 'display: flex;flex-wrap: wrap;';
    const embySliderListStyle = 'display: flex;flex-direction: column;justify-content: center;align-items: center;';
    const embySliderStyle = 'display: flex; align-items: center; gap: 1em; margin-bottom: 0.3em;';
    const embySliderLabelStyle = 'width:4em;';
    const embyOffsetBtnStyle = 'margin: 0;padding: 0;';
    const embyCheckGreenStyle = 'color: #388e3c;';

    // 手动搜索变量
    let searchDanmakuOpts = {};
    // 此id等同于danmakuTabOpts内的弹幕信息的id
    let currentDanmakuInfoContainerId = 'danmakuTab2';
    // 菜单tabs
    const danmakuTabOpts = [
        { id: 'danmakuTab0', name: '弹幕设置', buildMethod: buildDanmakuSetting },
        { id: 'danmakuTab1', name: '手动匹配', buildMethod: buildSearchEpisode},
        { id: currentDanmakuInfoContainerId, name: '弹幕信息', buildMethod: buildCurrentDanmakuInfo },
        { id: 'danmakuTab3', name: '弹幕样式', buildMethod: buildDanmakuStyle },
    ];
    // 弹幕类型过滤
    const danmakuTypeFilterOpts = [
        { id: 'bottom', name: '底部弹幕' },
        { id: 'top', name: '顶部弹幕' },
        { id: 'ltr', name: '从左至右' },
        // { id: 'rtl', name: '从右至左', hidden: true },
        { id: 'onlyWhite', name: '彩色弹幕' },
    ];
    // 弹幕引擎
    const danmakuEngineOpts = [
        { id: 'canvas', name: 'canvas'},
        { id: 'dom', name: 'dom'},
    ];
    const danmakuChConverOpts = [
        { id: '0', name: '未启用'},
        { id: '1', name: '转换为简体'},
        { id: '2', name: '转换为繁体'},
    ];
    const danmakuFilterLevelOpts = [
        { id: '0', name: '0'},
        { id: '1', name: '1'},
        { id: '2', name: '2'},
        { id: '3', name: '3'},
    ];
    const danmakuStyleOffsetBtns = [
        { label: '-30', styleOffset: '-30', iconKey: '&#xe05a;', style: embyOffsetBtnStyle},
        { label: '-10', styleOffset: '-10', iconKey: '&#xe059;', style: embyOffsetBtnStyle},
        { label: '-5', styleOffset: '-5', iconKey: '&#xe05b;', style: embyOffsetBtnStyle},
        { label: '-1', styleOffset: '-1', iconKey: '&#xE042;', style: embyOffsetBtnStyle},
        { label: '0', styleOffset: '0', iconKey: '&#xE041;', style: embyOffsetBtnStyle},
        { label: '+1', styleOffset: '1', iconKey: '&#xE042;', style: embyOffsetBtnStyle + ' transform: rotateY(180deg);'},
        { label: '+5', styleOffset: '5', iconKey: '&#xe058;', style: embyOffsetBtnStyle},
        { label: '+10', styleOffset: '10', iconKey: '&#xe056;', style: embyOffsetBtnStyle},
        { label: '+30', styleOffset: '30', iconKey: '&#xe057;', style: embyOffsetBtnStyle},
    ];
    
    // ------ 程序内部使用,请勿更改 end ------

    // ------ require start ------
    let skipInnerModule = false;
    try {
        throw new Error();
    } catch(e) {
        const stackTrace = e.stack;
        skipInnerModule = !!stackTrace && stackTrace.includes('eval');
        console.log('ignore this not error, callee:', e);
    }
    if (!skipInnerModule) {
    /* eslint-disable */
    /* https://cdn.jsdelivr.net/npm/danmaku@2.0.6/dist/danmaku.min.js */
    // prettier-ignore
    !function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).Danmaku=e()}(this,(function(){"use strict";var t=function(){if("undefined"==typeof document)return"transform";for(var t=["oTransform","msTransform","mozTransform","webkitTransform","transform"],e=document.createElement("div").style,i=0;i<t.length;i++)if(t[i]in e)return t[i];return"transform"}();function e(t){var e=document.createElement("div");if(e.style.cssText="position:absolute;","function"==typeof t.render){var i=t.render();if(i instanceof HTMLElement)return e.appendChild(i),e}if(e.textContent=t.text,t.style)for(var n in t.style)e.style[n]=t.style[n];return e}var i={name:"dom",init:function(){var t=document.createElement("div");return t.style.cssText="overflow:hidden;white-space:nowrap;transform:translateZ(0);",t},clear:function(t){for(var e=t.lastChild;e;)t.removeChild(e),e=t.lastChild},resize:function(t,e,i){t.style.width=e+"px",t.style.height=i+"px"},framing:function(){},setup:function(t,i){var n=document.createDocumentFragment(),s=0,r=null;for(s=0;s<i.length;s++)(r=i[s]).node=r.node||e(r),n.appendChild(r.node);for(i.length&&t.appendChild(n),s=0;s<i.length;s++)(r=i[s]).width=r.width||r.node.offsetWidth,r.height=r.height||r.node.offsetHeight},render:function(e,i){i.node.style[t]="translate("+i.x+"px,"+i.y+"px)"},remove:function(t,e){t.removeChild(e.node),this.media||(e.node=null)}},n="undefined"!=typeof window&&window.devicePixelRatio||1,s=Object.create(null);function r(t,e){if("function"==typeof t.render){var i=t.render();if(i instanceof HTMLCanvasElement)return t.width=i.width,t.height=i.height,i}var r=document.createElement("canvas"),h=r.getContext("2d"),o=t.style||{};o.font=o.font||"10px sans-serif",o.textBaseline=o.textBaseline||"bottom";var a=1*o.lineWidth;for(var d in a=a>0&&a!==1/0?Math.ceil(a):1*!!o.strokeStyle,h.font=o.font,t.width=t.width||Math.max(1,Math.ceil(h.measureText(t.text).width)+2*a),t.height=t.height||Math.ceil(function(t,e){if(s[t])return s[t];var i=12,n=t.match(/(\d+(?:\.\d+)?)(px|%|em|rem)(?:\s*\/\s*(\d+(?:\.\d+)?)(px|%|em|rem)?)?/);if(n){var r=1*n[1]||10,h=n[2],o=1*n[3]||1.2,a=n[4];"%"===h&&(r*=e.container/100),"em"===h&&(r*=e.container),"rem"===h&&(r*=e.root),"px"===a&&(i=o),"%"===a&&(i=r*o/100),"em"===a&&(i=r*o),"rem"===a&&(i=e.root*o),void 0===a&&(i=r*o)}return s[t]=i,i}(o.font,e))+2*a,r.width=t.width*n,r.height=t.height*n,h.scale(n,n),o)h[d]=o[d];var u=0;switch(o.textBaseline){case"top":case"hanging":u=a;break;case"middle":u=t.height>>1;break;default:u=t.height-a}return o.strokeStyle&&h.strokeText(t.text,a,u),h.fillText(t.text,a,u),r}function h(t){return 1*window.getComputedStyle(t,null).getPropertyValue("font-size").match(/(.+)px/)[1]}var o={name:"canvas",init:function(t){var e=document.createElement("canvas");return e.context=e.getContext("2d"),e._fontSize={root:h(document.getElementsByTagName("html")[0]),container:h(t)},e},clear:function(t,e){t.context.clearRect(0,0,t.width,t.height);for(var i=0;i<e.length;i++)e[i].canvas=null},resize:function(t,e,i){t.width=e*n,t.height=i*n,t.style.width=e+"px",t.style.height=i+"px"},framing:function(t){t.context.clearRect(0,0,t.width,t.height)},setup:function(t,e){for(var i=0;i<e.length;i++){var n=e[i];n.canvas=r(n,t._fontSize)}},render:function(t,e){t.context.drawImage(e.canvas,e.x*n,e.y*n)},remove:function(t,e){e.canvas=null}};function a(t){var e=this,i=this.media?this.media.currentTime:Date.now()/1e3,n=this.media?this.media.playbackRate:1;function s(t,s){if("top"===s.mode||"bottom"===s.mode)return i-t.time<e._.duration;var r=(e._.width+t.width)*(i-t.time)*n/e._.duration;if(t.width>r)return!0;var h=e._.duration+t.time-i,o=e._.width+s.width,a=e.media?s.time:s._utc,d=o*(i-a)*n/e._.duration,u=e._.width-d;return h>e._.duration*u/(e._.width+s.width)}for(var r=this._.space[t.mode],h=0,o=0,a=1;a<r.length;a++){var d=r[a],u=t.height;if("top"!==t.mode&&"bottom"!==t.mode||(u+=d.height),d.range-d.height-r[h].range>=u){o=a;break}s(d,t)&&(h=a)}var m=r[h].range,c={range:m+t.height,time:this.media?t.time:t._utc,width:t.width,height:t.height};return r.splice(h+1,o-h-1,c),"bottom"===t.mode?this._.height-t.height-m%this._.height:m%(this._.height-t.height)}var d="undefined"!=typeof window&&(window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame)||function(t){return setTimeout(t,50/3)},u="undefined"!=typeof window&&(window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.webkitCancelAnimationFrame)||clearTimeout;function m(t,e,i){for(var n=0,s=0,r=t.length;s<r-1;)i>=t[n=s+r>>1][e]?s=n:r=n;return t[s]&&i<t[s][e]?s:r}function c(t){return/^(ltr|top|bottom)$/i.test(t)?t.toLowerCase():"rtl"}function l(){var t=9007199254740991;return[{range:0,time:-t,width:t,height:0},{range:t,time:t,width:0,height:0}]}function f(t){t.ltr=l(),t.rtl=l(),t.top=l(),t.bottom=l()}function p(){if(!this._.visible||!this._.paused)return this;if(this._.paused=!1,this.media)for(var t=0;t<this._.runningList.length;t++){var e=this._.runningList[t];e._utc=Date.now()/1e3-(this.media.currentTime-e.time)}var i=this,n=function(t,e,i,n){return function(){t(this._.stage);var s=Date.now()/1e3,r=this.media?this.media.currentTime:s,h=this.media?this.media.playbackRate:1,o=null,d=0,u=0;for(u=this._.runningList.length-1;u>=0;u--)o=this._.runningList[u],r-(d=this.media?o.time:o._utc)>this._.duration&&(n(this._.stage,o),this._.runningList.splice(u,1));for(var m=[];this._.position<this.comments.length&&(o=this.comments[this._.position],!((d=this.media?o.time:o._utc)>=r));)r-d>this._.duration||(this.media&&(o._utc=s-(this.media.currentTime-o.time)),m.push(o)),++this._.position;for(e(this._.stage,m),u=0;u<m.length;u++)(o=m[u]).y=a.call(this,o),this._.runningList.push(o);for(u=0;u<this._.runningList.length;u++){o=this._.runningList[u];var c=(this._.width+o.width)*(s-o._utc)*h/this._.duration;"ltr"===o.mode&&(o.x=c-o.width+.5|0),"rtl"===o.mode&&(o.x=this._.width-c+.5|0),"top"!==o.mode&&"bottom"!==o.mode||(o.x=this._.width-o.width>>1),i(this._.stage,o)}}}(this._.engine.framing.bind(this),this._.engine.setup.bind(this),this._.engine.render.bind(this),this._.engine.remove.bind(this));return this._.requestID=d((function t(){n.call(i),i._.requestID=d(t)})),this}function g(){return!this._.visible||this._.paused||(this._.paused=!0,u(this._.requestID),this._.requestID=0),this}function _(){if(!this.media)return this;this.clear(),f(this._.space);var t=m(this.comments,"time",this.media.currentTime);return this._.position=Math.max(0,t-1),this}function v(t){t.play=p.bind(this),t.pause=g.bind(this),t.seeking=_.bind(this),this.media.addEventListener("play",t.play),this.media.addEventListener("pause",t.pause),this.media.addEventListener("playing",t.play),this.media.addEventListener("waiting",t.pause),this.media.addEventListener("seeking",t.seeking)}function w(t){this.media.removeEventListener("play",t.play),this.media.removeEventListener("pause",t.pause),this.media.removeEventListener("playing",t.play),this.media.removeEventListener("waiting",t.pause),this.media.removeEventListener("seeking",t.seeking),t.play=null,t.pause=null,t.seeking=null}function y(t){this._={},this.container=t.container||document.createElement("div"),this.media=t.media,this._.visible=!0,this.engine=(t.engine||"DOM").toLowerCase(),this._.engine="canvas"===this.engine?o:i,this._.requestID=0,this._.speed=Math.max(0,t.speed)||144,this._.duration=4,this.comments=t.comments||[],this.comments.sort((function(t,e){return t.time-e.time}));for(var e=0;e<this.comments.length;e++)this.comments[e].mode=c(this.comments[e].mode);return this._.runningList=[],this._.position=0,this._.paused=!0,this.media&&(this._.listener={},v.call(this,this._.listener)),this._.stage=this._.engine.init(this.container),this._.stage.style.cssText+="position:relative;pointer-events:none;",this.resize(),this.container.appendChild(this._.stage),this._.space={},f(this._.space),this.media&&this.media.paused||(_.call(this),p.call(this)),this}function x(){if(!this.container)return this;for(var t in g.call(this),this.clear(),this.container.removeChild(this._.stage),this.media&&w.call(this,this._.listener),this)Object.prototype.hasOwnProperty.call(this,t)&&(this[t]=null);return this}var b=["mode","time","text","render","style"];function L(t){if(!t||"[object Object]"!==Object.prototype.toString.call(t))return this;for(var e={},i=0;i<b.length;i++)void 0!==t[b[i]]&&(e[b[i]]=t[b[i]]);if(e.text=(e.text||"").toString(),e.mode=c(e.mode),e._utc=Date.now()/1e3,this.media){var n=0;void 0===e.time?(e.time=this.media.currentTime,n=this._.position):(n=m(this.comments,"time",e.time))<this._.position&&(this._.position+=1),this.comments.splice(n,0,e)}else this.comments.push(e);return this}function T(){return this._.visible?this:(this._.visible=!0,this.media&&this.media.paused||(_.call(this),p.call(this)),this)}function E(){return this._.visible?(g.call(this),this.clear(),this._.visible=!1,this):this}function k(){return this._.engine.clear(this._.stage,this._.runningList),this._.runningList=[],this}function C(){return this._.width=this.container.offsetWidth,this._.height=this.container.offsetHeight,this._.engine.resize(this._.stage,this._.width,this._.height),this._.duration=this._.width/this._.speed,this}var D={get:function(){return this._.speed},set:function(t){return"number"!=typeof t||isNaN(t)||!isFinite(t)||t<=0?this._.speed:(this._.speed=t,this._.width&&(this._.duration=this._.width/t),t)}};function z(t){t&&y.call(this,t)}return z.prototype.destroy=function(){return x.call(this)},z.prototype.emit=function(t){return L.call(this,t)},z.prototype.show=function(){return T.call(this)},z.prototype.hide=function(){return E.call(this)},z.prototype.clear=function(){return k.call(this)},z.prototype.resize=function(){return C.call(this)},Object.defineProperty(z.prototype,"speed",D),z}));
    /* eslint-enable */
    } else {
        !!window.Danmaku || Emby.importModule(requireDanmakuPath).then(f => {
            console.log(f);
            window.Danmaku = f;
        }).catch(error => {
            console.error(`fail Emby.importModule error:`, error);
        });
    }
    // ------ require end ------

    class EDE {
        constructor() {
            this.chConvert = 1;
            if (window.localStorage.getItem(lsKeys.chConvert)) {
                this.chConvert = window.localStorage.getItem(lsKeys.chConvert);
            }
            // 0:当前状态关闭 1:当前状态打开
            this.danmakuSwitch = 1;
            if (window.localStorage.getItem(lsKeys.danmakuSwitch)) {
                this.danmakuSwitch = parseInt(window.localStorage.getItem(lsKeys.danmakuSwitch));
            }
            this.danmaku = null;
            this.episode_info = null;
            this.ob = null;
            this.loading = false;
            this.destroyTimeoutIds = [];
            this.filterKeywords = '';
            this.filterKeywordsEnable = false;
        }
    }

    function createButton(opt) {
        let button = document.createElement('button');
        opt = { ...buttonOptions, ...opt };
        Object.entries(opt).forEach(([key, value]) => button.setAttribute(key, value));
        if (opt.innerText) {
            let icon = document.createElement('span');
            icon.className = 'md-icon autortl';
            icon.innerText = opt.innerText;
            button.appendChild(icon);
        } else if (opt.iconKey) {
            button.innerHTML = `<i class="md-icon autortl">${opt.iconKey}</i>`;
        }
        button.onclick = opt.onclick;
        return button;
    }

    // if showSettingBtns = true
    function createSubPanel(popDiv, label, localStorageKey, inputOpts = {}) {
        const defaultOpts = { min: 0.1, max: 3, step: 0.1 };
        inputOpts = { ...defaultOpts, ...inputOpts };
        // 大小调整SubPanel
        let subPanelEle = document.createElement('div');
        subPanelEle.style.display = 'flex';
        subPanelEle.style.flexDirection = 'column';
        subPanelEle.style.flexWrap = 'nowrap';
        subPanelEle.style.justifyContent = 'center';
        subPanelEle.style.alignItems = 'center';
        // 滑动条
        let sliderEle = document.createElement('input');
        sliderEle.setAttribute('orient', 'vertical');
        sliderEle.setAttribute('type', 'range');
        sliderEle.setAttribute('min', String(inputOpts.min));
        sliderEle.setAttribute('max', String(inputOpts.max));
        sliderEle.setAttribute('step', String(inputOpts.step));
        sliderEle.style.width = '30px';
        sliderEle.style.height = '60px';
        sliderEle.style.appearance = 'slider-vertical';
        sliderEle.oninput = () => {
            inputEle.value = parseFloat(sliderEle.value).toFixed(1);
        };
        // 输入框
        let inputEle = document.createElement('input');
        inputEle.type = 'text';
        inputEle.style.width = '30px';
        inputEle.style.textAlign = 'center';
        inputEle.oninput = () => {
            var oldValue = window.localStorage.getItem(localStorageKey) ?? '1.0';
            var fontSizeMagnification = parseFloat(inputEle.value);
            if (isNaN(fontSizeMagnification)) {
                inputEle.value = oldValue;
                sliderEle.value = oldValue;
                alert('请输入有效的数字！');
            } else if (fontSizeMagnification < inputOpts.min
                || fontSizeMagnification > inputOpts.max
            ) {
                inputEle.value = oldValue;
                sliderEle.value = oldValue;
                alert(`请输入${inputOpts.min}到${inputOpts.max}之间的数字！`);
            } else {
                sliderEle.value = fontSizeMagnification.toFixed(1);
            }
        };
        // 监听 Input 回车结束设置
        inputEle.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                popDiv.style.display = 'none';
                if (popDiv.startSetter) {
                    popDiv.startSetter = undefined;
                    doDanmakuChange({ localStorageKey: inputEle.value });
                }
            }
        });
        // 标签
        let labelEle = document.createElement('span');
        labelEle.innerText = label;

        // DOM, 将滑动条和输入框和描述添加到 subPanel
        subPanelEle.appendChild(sliderEle);
        subPanelEle.appendChild(inputEle);
        subPanelEle.appendChild(labelEle);
        // Props, 定义获取元素的方法
        subPanelEle.getSlider = () => sliderEle;
        subPanelEle.getInput = () => inputEle;
        subPanelEle.getLabel = () => labelEle;
        return subPanelEle;
    }

    /** 调整字幕大小和透明度的Button
     *  if showSettingBtns = true
     * @returns
     */
    function createResizeButton() {
        // 创建按钮
        // let button = document.createElement('button', buttonOptions);
        let button = document.createElement('button');
        for (let key in buttonOptions) {
            button.setAttribute(key, buttonOptions[key]);
        }
        button.setAttribute('title', '弹幕调整');
        button.setAttribute('id', 'danmuStyleSetter');
        //创建按钮图标
        let icon = document.createElement('span');
        icon.className = 'md-icon';
        icon.innerText = danmuStyleSetter_icon;

        // 创建弹出面板
        let popDiv = document.getElementById('danmuStyleSetterPopPanel');
        if (popDiv) popDiv.remove();
        popDiv = document.createElement('div');
        popDiv.setAttribute('id', 'danmuStyleSetterPopPanel');
        popDiv.startSetter = undefined;
        popDiv.style.display = 'none';
        popDiv.style.position = 'absolute';
        popDiv.style.padding = '6px';
        popDiv.style.background = '#555';
        popDiv.style.flexWrap = 'nowrap';
        popDiv.style.justifyContent = 'center';
        popDiv.style.alignItems = 'center';

        // 大小调整 SubPanel
        const fontSizeSetPopDiv = createSubPanel(popDiv, '大小', lsKeys.danmakuFontSizeMagnification);
        const fontSizeInput = fontSizeSetPopDiv.getInput();
        const fontSizeSlider = fontSizeSetPopDiv.getSlider();

        // 透明度调整 SubPanel
        const fontOpacitySetPopDiv = createSubPanel(popDiv, '透明度', lsKeys.danmakuFontOpacity, { max: 1 });
        const fontOpacityInput = fontOpacitySetPopDiv.getInput();
        const fontOpacitySlider = fontOpacitySetPopDiv.getSlider();

        // 基准速度调整 SubPanel
        const speedSetPopDiv = createSubPanel(popDiv, '速度', lsKeys.danmakuSpeed);
        const speedInput = speedSetPopDiv.getInput();
        const speedSlider = speedSetPopDiv.getSlider();

        // 时间轴偏移秒数调整 SubPanel
        const timelineOffsetSetPopDiv = createSubPanel(popDiv, '轴偏秒', lsKeys.danmakuTimelineOffset, {
            min: -30, max: 30, step: 1,
        });
        const timelineOffsetInput = timelineOffsetSetPopDiv.getInput();
        const timelineOffsetSlider = timelineOffsetSetPopDiv.getSlider();

        // 所有 danmakuCtr 都没渲染
        const popDivClientWidth = 2 * parseInt(popDiv.style.padding.replace('px', ''))
            + parseInt(fontSizeInput.style.width.replace('px', ''))
            + parseInt(fontOpacityInput.style.width.replace('px', ''))
            + parseInt(speedInput.style.width.replace('px', ''))
            + parseInt(timelineOffsetInput.style.width.replace('px', ''))
            + 30; // this is offset for label

        // icon插入button
        button.appendChild(icon);
        popDiv.appendChild(fontSizeSetPopDiv);
        popDiv.appendChild(fontOpacitySetPopDiv);
        popDiv.appendChild(speedSetPopDiv);
        popDiv.appendChild(timelineOffsetSetPopDiv);
        // 将POP插入body
        document.body.appendChild(popDiv);

        // 监听鼠标点击事件
        button.addEventListener('click', function (event) {
            if (popDiv.style.display == 'none') {
                // 赋初值
                let curFontSizeMag = localStorage.getItem(lsKeys.danmakuFontSizeMagnification);
                let curFontOpacity = localStorage.getItem(lsKeys.danmakuFontOpacity);
                let curSpeed = localStorage.getItem(lsKeys.danmakuSpeed);
                let curTimelineOffset = localStorage.getItem(lsKeys.danmakuTimelineOffset);
                curFontSizeMag = isNaN(parseFloat(curFontSizeMag)) ? '1.0' : curFontSizeMag;
                curFontOpacity = isNaN(parseFloat(curFontOpacity)) ? '1.0' : curFontOpacity;
                curSpeed = isNaN(parseFloat(curSpeed)) ? '1.0' : curSpeed;
                curTimelineOffset = isNaN(parseFloat(curTimelineOffset)) ? '0.0' : curTimelineOffset;
                fontSizeSlider.value = curFontSizeMag;
                fontSizeInput.value = curFontSizeMag;
                fontOpacitySlider.value = curFontOpacity;
                fontOpacityInput.value = curFontOpacity;
                speedSlider.value = curSpeed;
                speedInput.value = curSpeed;
                timelineOffsetSlider.value = curTimelineOffset;
                timelineOffsetInput.value = curTimelineOffset;

                // CSS
                var x = event.clientX - 36 > 0 ? event.clientX - 36 : 0;
                var y = event.clientY - 160 > 0 ? event.clientY - 160 : 0;
                // 假如超出屏幕宽度,则将 popDiv 向左移动自身的宽度
                if (x + popDivClientWidth > window.screen.availWidth) {
                    x -= popDivClientWidth;
                }

                popDiv.startSetter = '1';
                popDiv.style.left = x + 'px';
                popDiv.style.top = y + 'px';
                popDiv.style.display = 'flex';
            } else {
                popDiv.style.display = 'none';
                if (popDiv.startSetter) {
                    popDiv.startSetter = undefined;
                    doDanmakuChange({
                        [lsKeys.danmakuFontSizeMagnification]: fontSizeInput.value,
                        [lsKeys.danmakuFontOpacity]: fontOpacityInput.value,
                        [lsKeys.danmakuSpeed]: speedInput.value,
                        [lsKeys.danmakuTimelineOffset]: timelineOffsetInput.value,
                    });
                }
            }
        });
        // 监听页面点击事件
        document.addEventListener('click', function (event) {
            // 检查点击事件的目标元素是否是div或div内的元素
            if (event.target === popDiv || popDiv.contains(event.target) 
                || event.target === button || button.contains(event.target)
            ) {
                return; // 如果是，则不执行下面的代码
            }
            popDiv.style.display = 'none';
            if (popDiv.startSetter) {
                popDiv.startSetter = undefined;
                doDanmakuChange({ 
                    [lsKeys.danmakuFontSizeMagnification]: fontSizeInput.value,
                    [lsKeys.danmakuFontOpacity]: fontOpacityInput.value,
                    [lsKeys.danmakuSpeed]: speedInput.value,
                    [lsKeys.danmakuTimelineOffset]: timelineOffsetInput.value,
                });
            }
        });
        return button;
    }

    /**
     * 热重载弹幕并更新本地存储值,例如执行弹幕大小和透明度变换...
     * @param {Object} keyValuePairs - 键值对对象,如 {key1: value1, key2: value2}
     * @param {Function} [callback] - 更新后执行的回调函数
     */
    function doDanmakuChange(keyValuePairs, callback) {
        let flag = false;
        Object.keys(keyValuePairs).forEach(key => {
            const oldValue = window.localStorage.getItem(key);
            const newValue = keyValuePairs[key];
            if (newValue !== oldValue) {
                window.localStorage.setItem(key, newValue);
                flag = true;
            }
        });
        if (flag) { loadDanmaku(LOAD_TYPE.RELOAD); }
        if (typeof callback === 'function') { callback(); }
    }

    function initListener() {
        let _media = document.querySelector(mediaQueryStr);
        // 页面未加载
        if (!_media) {
            window.ede.episode_info && (window.ede.episode_info = null);
            return;
        }
        if (_media.getAttribute('ede_listening')) { return; }
        console.log('正在初始化Listener');
        _media.setAttribute('ede_listening', true);
        _media.addEventListener('play', () => {
            console.log('H5VideoPlayListener: 初始化弹幕信息');
            loadDanmaku(LOAD_TYPE.INIT);
        });
        const flag = window.ede.danmaku && window.ede.danmakuSwitch == 1;
        playbackEventsOn({
            'unpause': (e, data) => {
                console.log('unpause event: ' + e.type);
                if (flag) {
                    console.log('Resizing');
                    window.ede.danmaku.hide();
                    window.ede.danmaku.show();
                    window.ede.danmaku.resize();
                }
            },
        });
        console.log('Listener初始化完成');
    }

    function initUI() {
        // 已初始化
        if (document.getElementById(eleIds.danmakuCtr)) {
            return;
        }
        console.log('正在初始化UI');

        // 弹幕按钮容器 div
        // const ctrQueryStr = `.videoOsdBottom-maincontrols ${isJellyfin ? '.buttons' : '.videoOsdBottom-buttons'}`; // this not need setTimeout, but unknown why
        // .graphicContentContainer:not(.hide) .videoOsdBottom-maincontrols .videoOsdBottom-buttons
        const ctrQueryStr = `${mediaContainerQueryStr} .videoOsdBottom-maincontrols ${isJellyfin ? '.buttons' : '.videoOsdBottom-buttons'}`;
        const parent = document.querySelector(ctrQueryStr);
        // 延时判断,精确 dom query 时播放器 UI 小概率暂未渲染
        if (!parent) {
            window.ede.destroyTimeoutIds.push(setTimeout(() => {
                console.log("retry initUI!");
                initUI();
            }, check_interval));
            return;
        }

        // 在老客户端上存在右侧按钮,在右侧按钮前添加
        const rightButtonsStr = `.videoOsdBottom-buttons-right`;
        const rightButtons = parent.querySelector(rightButtonsStr);

        let menubar = document.createElement('div');
        menubar.id = eleIds.danmakuCtr;
        if (!window.ede.episode_info) {
            menubar.style.opacity = 0.5;
        }
        if (rightButtons) {
            parent.insertBefore(menubar, rightButtons);
        } else {
            parent.append(menubar);
        }
        
        // 弹幕开关
        displayButtonOpts.innerText = danmaku_icons[window.ede.danmakuSwitch];
        menubar.appendChild(createButton(displayButtonOpts));
        // 弹幕设置
        menubar.appendChild(createButton(searchButtonOpts));
        if (showSettingBtns) {
            // 简繁转换
            translateButtonOpts.title = chConverTtitle[window.ede.chConvert];
            menubar.appendChild(createButton(translateButtonOpts));
            // 屏蔽密度等级
            filterButtonOpts.innerText = filter_icons[parseInt(window.localStorage.getItem(lsKeys.danmakuFilterLevel) ?? 0)];
            menubar.appendChild(createButton(filterButtonOpts));
            // 弹幕信息
            menubar.appendChild(createButton(infoButtonOpts));
            // 弹幕大小调整
            menubar.appendChild(createResizeButton());
        }
        console.log('UI初始化完成');
    }

    // android 不兼容, web 和 Electron 兼容
    function sendNotification(title, msg) {
        const Notification = window.Notification || window.webkitNotifications;
        console.log(msg);
        if (Notification.permission === 'granted') {
            return new Notification(title, {
                body: msg,
            });
        } else {
            Notification.requestPermission((permission) => {
                if (permission === 'granted') {
                    return new Notification(title, {
                        body: msg,
                    });
                }
            });
        }
    }

    async function getEmbyItemInfo() {
        return window.require(['playbackManager']).then((items) => items?.[0].currentItem());
    }

    async function fatchEmbyItemInfo(id) {
        return await ApiClient.getItem(ApiClient.getCurrentUserId(), id);
    }

    async function fetchSearchEpisodes(anime, episode, withRelated = true) {
        if (!anime) { throw new Error('anime is required'); }
        const searchUrl = `${dandanplayApi}/search/episodes?anime=${anime}&withRelated=${withRelated}
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
        let item;
        if (isJellyfin) {
            item = await fatchEmbyItemInfo(embyItemId);
        } else {
            item = await getEmbyItemInfo();
            if (!item) {
                // getEmbyItemInfo from playbackManager null, will next called
                return null;
            }
        }
        let _id;
        let animeName;
        let anime_id = -1;
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
            anime_id = window.localStorage.getItem(_id_key);
        }
        if (window.localStorage.getItem(_name_key)) {
            animeName = window.localStorage.getItem(_name_key);
        }
        return {
            _id: _id,
            _id_key: _id_key,
            _name_key: _name_key,
            _episode_key: _episode_key,
            anime_id: anime_id,
            episode: episode, // this is episode number, not a index
            animeName: animeName,
            seriesOrMovieId: item.SeriesId || item.Id,
        };
    }

    async function getEpisodeInfo(is_auto = true) {
        const itemInfoMap = await getMapByEmbyItemInfo();
        if (!itemInfoMap) { return null; }
        const { _episode_key, anime_id } = itemInfoMap;
        let { animeName, episode } = itemInfoMap;
        if (is_auto) {
            if (window.localStorage.getItem(_episode_key)) {
                return JSON.parse(window.localStorage.getItem(_episode_key));
            }
        }
        // if (!is_auto) {
        //     animeName = prompt('确认动画名:', animeName);
        //     if (animeName == null) throw new Error('用户取消确认动画名操作');
        // }

        let animaInfo = await fetchSearchEpisodes(animeName, is_auto ? episode : null);
        if (is_auto && animaInfo.animes.length == 0) {
            // from: https://github.com/Izumiko/jellyfin-danmaku/blob/jellyfin/ede.js#L886
            console.log(`标题名: ${animeName},自动匹配未查询到结果,将使用原标题名,重试一次`);
            const seriesOrMovieInfo = await ApiClient.getItem(ApiClient.getCurrentUserId(), itemInfoMap.seriesOrMovieId);
            if (seriesOrMovieInfo.OriginalTitle) {
                animeName = seriesOrMovieInfo.OriginalTitle;
                animaInfo = await fetchSearchEpisodes(animeName, is_auto ? episode : null);
                if (animaInfo.animes.length > 0) {
                    console.log(`使用原标题名: ${animeName},自动匹配成功`);
                }
            }
        }
        if (animaInfo.animes.length == 0) {
            console.log(`弹幕查询无结果`);
            return null;
        }

        let selectAnime_id = 1;
        if (anime_id != -1) {
            for (let index = 0; index < animaInfo.animes.length; index++) {
                if (animaInfo.animes[index].animeId == anime_id) {
                    selectAnime_id = index + 1;
                }
            }
        }
        // if (!is_auto) {
        //     let anime_lists_str = list2string(animaInfo);
        //     console.log(anime_lists_str);
        //     selectAnime_id = prompt('选择:\n' + anime_lists_str, selectAnime_id);
        //     if (selectAnime_id == null) throw new Error('用户取消选择集数操作');
        //     selectAnime_id = parseInt(selectAnime_id) - 1;
        //     window.localStorage.setItem(_id_key, animaInfo.animes[selectAnime_id].animeId);
        //     window.localStorage.setItem(_name_key, animaInfo.animes[selectAnime_id].animeTitle);
        //     let episode_lists_str = ep2string(animaInfo.animes[selectAnime_id].episodes);
        //     episode = prompt('确认集数:\n' + episode_lists_str, parseInt(episode));
        //     if (episode == null) throw new Error('用户取消确认集数操作');
        //     episode = parseInt(episode) - 1;
        // } else {
            selectAnime_id = parseInt(selectAnime_id) - 1;
            episode = 0;
        // }
        let episodeInfo = {
            episodeId: animaInfo.animes[selectAnime_id].episodes[episode].episodeId,
            animeTitle: animaInfo.animes[selectAnime_id].animeTitle,
            episodeTitle: animaInfo.animes[selectAnime_id].type == 'tvseries'
                ? animaInfo.animes[selectAnime_id].episodes[episode].episodeTitle
                : null,
        };
        window.localStorage.setItem(_episode_key, JSON.stringify(episodeInfo));
        return episodeInfo;
    }

    function getComments(episodeId) {
        let url = dandanplayApi + '/comment/' + episodeId + '?withRelated=true&chConvert=' + window.ede.chConvert;
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
            window.ede.danmaku.clear();
            window.ede.danmaku.destroy();
            window.ede.danmaku = null;
        }
        let _comments = danmakuFilter(danmakuParser(comments));
        console.log('弹幕加载成功: ' + _comments.length);

        // while (!document.querySelector(mediaContainerQueryStr)) {
        //     await new Promise((resolve) => setTimeout(resolve, 200));
        // }

        mediaContainerQueryStr = isJellyfin ? '.syncPlayContainer' : mediaContainerQueryStr;

        let _container = document.querySelector(mediaContainerQueryStr);
        let _media = document.querySelector(mediaQueryStr);
        if (!_media) throw new Error('用户已退出视频播放');
        if (!isVersionOld) {
            _media.style.position = 'absolute';
        }
        // 弹幕基准速度,这里可以根据屏幕尺寸再计算添加倍率,不过还是设备上手调比较简单
        let _speed = 144 * (parseFloat(localStorage.getItem(lsKeys.danmakuSpeed)) || 1);
        window.ede.danmaku = new Danmaku({
            container: _container,
            media: _media,
            comments: _comments,
            engine: localStorage.getItem(lsKeys.danmakuEngine) || 'canvas',
            speed: _speed,
        });
        window.ede.danmakuSwitch == 1 ? window.ede.danmaku.show() : window.ede.danmaku.hide();
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
                        if (loadType === LOAD_TYPE.RELOAD && danmuCache[episodeId]) {
                            createDanmaku(danmuCache[episodeId])
                                .then(() => {
                                    console.log('弹幕就位');
                                    embyToast({ text: `弹幕就位,已加载 ${window.ede.danmaku?.comments.length} 条弹幕` });
                                })
                                .catch((err) => {
                                    console.log(err);
                                });
                        } else {
                            getComments(episodeId).then((comments) => {
                                danmuCache[episodeId] = comments;
                                window.ede.downloadSum = comments.length;
                                createDanmaku(comments)
                                    .then(() => {
                                        console.log('弹幕就位');
                                        embyToast({ text: `弹幕就位,已获取 ${window.ede.downloadSum} 条弹幕` });
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
                if (document.getElementById(eleIds.danmakuCtr).style.opacity != 1) {
                    document.getElementById(eleIds.danmakuCtr).style.opacity = 1;
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    function danmakuFilter(comments) {
        let _comments = [...comments];
        _comments = danmakuTypeFilter(_comments);
        _comments = danmakuDensityLevelFilter(_comments);
        _comments = danmakuKeywordsFilter(_comments);
        return _comments;
    }

    /** 过滤弹幕类型 */
    function danmakuTypeFilter(comments) {
        let _comments = [...comments];
        let idArray = JSON.parse(window.localStorage.getItem(lsKeys.danmakuTypeFilter) ?? '[]');
        // 彩色过滤,只留下默认的白色
        if (idArray.includes('onlyWhite')) {
            _comments = _comments.filter(c => '#ffffff' === c.style.color.toLowerCase().slice(0, 7));
            idArray.splice(idArray.indexOf('onlyWhite'), 1);
        }
        // 过滤特定模式的弹幕
        if (idArray.length > 0) {
            _comments = _comments.filter(c => !idArray.includes(c.mode));
        }
        return _comments;
    }

    /** 过滤弹幕密度等级,水平和垂直 */
    function danmakuDensityLevelFilter(comments) {
        let level = parseInt(window.localStorage.getItem(lsKeys.danmakuFilterLevel) ?? 0);
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
        let enbale = window.ede.filterKeywordsEnable;
        if (!enbale) { return comments;}
        let _comments = [...comments];
        let keywords = window.ede.filterKeywords.split(/\r?\n/).map(k => k.trim());
        if (keywords.length > 0) {
            _comments = _comments.filter(c => !keywords.some(k => c.text.includes(k)));
        }
        return _comments;
    }

    function danmakuParser($obj) {
        //const fontSize = Number(values[2]) || 25
        // 弹幕大小
        const fontSizeMagnification = parseFloat(
            localStorage.getItem(lsKeys.danmakuFontSizeMagnification)
        ) || 1;
        let fontSize = 25;
        const h3Ele = document.querySelector(isJellyfin ? '.osdTitle' : '.videoOsdTitle');
        if (h3Ele) {
            fontSize = parseFloat(getComputedStyle(h3Ele).fontSize.replace('px', '')) * fontSizeMagnification;
        } else {
            fontSize = Math.round(
                (window.screen.height > window.screen.width 
                    ? window.screen.width 
                    : window.screen.height / 1080) * 18 * fontSizeMagnification
            );
        }
        // 弹幕透明度
        const fontOpacity = Math.round((parseFloat(localStorage.getItem(lsKeys.danmakuFontOpacity)) || 1.0) * 255).toString(16);
        // 时间轴偏移秒数
        const timelineOffset = parseInt(localStorage.getItem(lsKeys.danmakuTimelineOffset)) || 0;
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
                return {
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
                };
            })
            .filter((x) => x);
    }

    // function list2string($obj2) {
    //     const $animes = $obj2.animes;
    //     let anime_lists = $animes.map(($single_anime) => {
    //         return $single_anime.animeTitle + ' 类型:' + $single_anime.typeDescription;
    //     });
    //     let anime_lists_str = '1:' + anime_lists[0];
    //     for (let i = 1; i < anime_lists.length; i++) {
    //         anime_lists_str = anime_lists_str + '\n' + (i + 1).toString() + ':' + anime_lists[i];
    //     }
    //     return anime_lists_str;
    // }

    // function ep2string($obj3) {
    //     const $animes = $obj3;
    //     let anime_lists = $animes.map(($single_ep) => {
    //         return $single_ep.episodeTitle;
    //     });
    //     let ep_lists_str = '1:' + anime_lists[0];
    //     for (let i = 1; i < anime_lists.length; i++) {
    //         ep_lists_str = ep_lists_str + '\n' + (i + 1).toString() + ':' + anime_lists[i];
    //     }
    //     return ep_lists_str;
    // }

    async function createDialog() {
        const html = `<div id="${eleIds.dialogContainer}"></div>`;
        embyDialog({ html, buttons: [{ name: '关闭' }] });
        afterEmbyDialogCreated();
    }

    async function afterEmbyDialogCreated() {
        const itemInfoMap = await getMapByEmbyItemInfo();
        const { _id_key, _name_key, _episode_key, anime_id, animeName, episode } = itemInfoMap;
        searchDanmakuOpts = {
            _id_key: _id_key,
            _name_key: _name_key,
            _episode_key: _episode_key,
            anime_id: anime_id,
            animeName: animeName,
            episode: (parseInt(episode) || 1) - 1, // convert to index
            animes: [],
        }

        let dialogContainer = document.getElementById(eleIds.dialogContainer);
        if (!dialogContainer) {
            window.ede.destroyTimeoutIds.push(setTimeout(() => {
                console.log("retry dialogContainer!");
                afterEmbyDialogCreated();
            }, check_interval));
            return;
        }
        let tabsMenuContainer = document.createElement('div');
        tabsMenuContainer.className = embyTabsMenuClass;
        tabsMenuContainer.appendChild(embyTabs(danmakuTabOpts, danmakuTabOpts[0].id, 'id', 'name', (index) => {
            danmakuTabOpts.forEach((obj, i) => document.getElementById(obj.id).hidden = i !== index);
        }));
        dialogContainer.appendChild(tabsMenuContainer);

        danmakuTabOpts.forEach((tab, index) => {
            let tabContainer = document.createElement('div');
            tabContainer.id = tab.id;
            tabContainer.style.textAlign = 'left';
            tabContainer.hidden = index != 0;
            dialogContainer.appendChild(tabContainer);
            tab.buildMethod(tab.id);
        });
    }
    
    function buildSearchEpisode(containerId) {
        let container = document.getElementById(containerId);
        let template = `
            <div>
                <div>
                    <label class="${embyLabelClass}">标题: </label>
                    <div style="display: flex;" id="${eleIds.danmakuSearchNameDiv}"></div>
                </div>
                <div id="${eleIds.danmakuEpisodeFlag}" hidden>
                    <label class="${embyLabelClass}">媒体名: </label>
                    <div class="${embySelectWrapperClass}" style="max-width: 100%;" id="${eleIds.danmakuEpisodeDiv}"></div>
                    <label class="${embyLabelClass}">分集名: </label>
                    <div style="display: flex;">
                        <div class="${embySelectWrapperClass}" style="max-width: 90%;"  id="${eleIds.danmakuEpisodeNumDiv}"></div>
                        <div id="${eleIds.danmakuEpisodeLoad}"></div>
                    </div>
                </div>
                <div>
                    <label class="${embyLabelClass}" id="${eleIds.danmakuRemark}"></label>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        let searchInput = embyInput(eleIds.danmakuSearchName, null, searchDanmakuOpts.animeName);
        let searchBtn = embyButton({id: eleIds.danmakuSearchEpisode, label: '搜索', iconKey: 'search'}, doDanmakuSearchEpisode);
        container.querySelector('#' + eleIds.danmakuSearchNameDiv).appendChild(searchInput);
        container.querySelector('#' + eleIds.danmakuSearchNameDiv).appendChild(searchBtn);
        let loadBtn = embyButton({id: eleIds.danmakuSwitchEpisode, label: '加载弹幕', iconKey: 'check', style: embyCheckGreenStyle}
            , doDanmakuSwitchEpisode);
        container.querySelector('#' + eleIds.danmakuEpisodeLoad).appendChild(loadBtn);
    }

    function buildCurrentDanmakuInfo(containerId) {
        let container = document.getElementById(containerId);
        if (!container || !window.ede.episode_info) { return; }
        let template = `
            <div>
                <div>
                    <label class="${embyLabelClass}">媒体名: </label>
                    <div class="${embyTextDivClass}">${window.ede.episode_info.animeTitle}</div>
                </div>
                ${window.ede.episode_info.episodeTitle ?
                `<div>
                    <label class="${embyLabelClass}">分集名: </label>
                    <div class="${embyTextDivClass}">${window.ede.episode_info.episodeTitle}</div>
                </div>`
                : ''}
                <div>
                    <label class="${embyLabelClass}">其它信息: </label>
                    <div class="${embyTextDivClass}">
                        获取总条数: ${window.ede.downloadSum}, 
                        加载总条数: ${window.ede.danmaku?.comments.length}, 
                        被过滤条数: ${window.ede.downloadSum - window.ede.danmaku?.comments.length ?? 0}
                    </div>
                </div>
                <div id="testBtns">
                    
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        
    }

    function buildDanmakuSetting(containerId) {
        let container = document.getElementById(containerId);
        let template =  `
            <div>
                <div id="${eleIds.danmakuSwitchDiv}" style="margin-bottom: 0.2em;"></div>
                <div id="${eleIds.danmakuTypeFilterDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">弹幕屏蔽类型: </label>
                </div>
                <div id="${eleIds.danmakuFilterLevelDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">弹幕屏蔽等级: </label>
                </div>
                <div id="${eleIds.danmakuChConverDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">简繁转换: </label>
                </div>
                <div id="${eleIds.danmakuEngineDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">切换弹幕引擎: </label>
                </div>
                <div id="${eleIds.filterKeywordsDiv}" style="margin-bottom: 0.2em;">
                    <label class="${embyLabelClass}">屏蔽关键字: </label>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        let typeFilterCheckboxList = embyCheckboxList(eleIds.danmakuTypeFilterSelect, eleIds.danmakuTypeFilterSelectName
            , localStorage.getItem(lsKeys.danmakuTypeFilter), danmakuTypeFilterOpts, doDanmakuTypeFilterSelect);
        container.querySelector('#' + eleIds.danmakuTypeFilterDiv).appendChild(typeFilterCheckboxList);
        let engineTabs = embyTabs(danmakuEngineOpts, localStorage.getItem(lsKeys.danmakuEngine) ?? danmakuEngineOpts[0].id
            , 'id', 'name', doDanmakuEngineSelect);
        container.querySelector('#' + eleIds.danmakuEngineDiv).appendChild(engineTabs);
        let chConvertTabs = embyTabs(danmakuChConverOpts, window.ede.chConvert, 'id', 'name', doDanmakuChConverChange);
        container.querySelector('#' + eleIds.danmakuChConverDiv).appendChild(chConvertTabs);
        let filterLevelTabs = embyTabs(danmakuFilterLevelOpts, window.localStorage.getItem(lsKeys.danmakuFilterLevel) ?? 0
            , 'id', 'name', doDanmakuFilterLevelChange);
        container.querySelector('#' + eleIds.danmakuFilterLevelDiv).appendChild(filterLevelTabs);
        let switchCheckbox = embyCheckbox(eleIds.danmakuSwitch, eleIds.danmakuSwitch, '弹幕开关', window.ede.danmakuSwitch == 1
            , window.ede.danmakuSwitch == 1, doDanmakuSwitch);
        container.querySelector('#' + eleIds.danmakuSwitchDiv).appendChild(switchCheckbox);
        // 屏蔽关键字
        let keywordsContainer = container.querySelector('#' + eleIds.filterKeywordsDiv);
        let enableDiv = keywordsContainer.appendChild(document.createElement('div'));
        let keywordsBtn = embyButton({id: eleIds.filterKeywordsBtn,label: '加载关键词过滤', iconKey: 'check'}, doDanmakuFilterKeywordsBtnClick);
        keywordsBtn.disabled = true;
        enableDiv.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; width: 90%;');
        enableDiv.appendChild(embyCheckbox(eleIds.filterKeywordsEnableId, '', '启用', '', window.ede.filterKeywordsEnable
            , (flag) => updateFilterKeywordsBtn(keywordsBtn, flag, document.getElementById(eleIds.filterKeywordsId).value.trim())));
        enableDiv.appendChild(document.createElement('div'))
                .appendChild(keywordsBtn);
        keywordsContainer.appendChild(document.createElement('div'))
            .appendChild(embyTextarea(eleIds.filterKeywordsId, window.ede.filterKeywords,'width: 90%;margin-top: 0.2em;', 8, true, false
                , (event) => updateFilterKeywordsBtn(keywordsBtn, document.getElementById(eleIds.filterKeywordsEnableId).checked, event.target.value.trim())));
        let label = document.createElement('label');
        label.innerText = '关键词过滤，支持正则匹配，多个关键词用换行分隔';
        label.className = 'fieldDescription';
        keywordsContainer.appendChild(document.createElement('div'))
            .appendChild(label);
        
    }

    function buildDanmakuStyle(containerId) {
        let container = document.getElementById(containerId);
        let template = `
            <div style="${embySliderListStyle}">
                <div style="${embySliderStyle}">
                    <label class="${embyLabelClass}" style="${embySliderLabelStyle}">大小: </label>
                    <div id="${eleIds.danmakuSizeDiv}" style="width: 15.5em; text-align: center;"></div>
                    <label id="${eleIds.danmakuSizeLabel}" style="${embySliderLabelStyle}"></label>
                </div>
                <div style="${embySliderStyle}">
                    <label class="${embyLabelClass}" style="${embySliderLabelStyle}">透明度: </label>
                    <div id="${eleIds.danmakuAlphaDiv}" style="width: 15.5em; text-align: center;"></div>
                    <label id="${eleIds.danmakuAlphaLabel}" style="${embySliderLabelStyle}"></label>
                </div>
                <div style="${embySliderStyle}">
                    <label class="${embyLabelClass}" style="${embySliderLabelStyle}">速度: </label>
                    <div id="${eleIds.danmakuSpeedDiv}" style="width: 15.5em; text-align: center;"></div>
                    <label id="${eleIds.danmakuSpeedLabel}" style="${embySliderLabelStyle}"></label>
                </div>
                <div style="${embySliderStyle}">
                    <label class="${embyLabelClass}" style="${embySliderLabelStyle}">轴偏秒: </label>
                    <div id="${eleIds.danmakuOffsetDiv}" style="width: 15.5em; text-align: center;"></div>
                    <label id="${eleIds.danmakuOffsetLabel}" style="${embySliderLabelStyle}">0</label>
                </div>
            </div>
        `;
        container.innerHTML = template.trim();
        let sizeSlider = embySlider({ labelId: eleIds.danmakuSizeLabel, key: lsKeys.danmakuFontSizeMagnification}
            , {}, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        let alphaSlider = embySlider({ labelId: eleIds.danmakuAlphaLabel, key: lsKeys.danmakuFontOpacity}
            , { max: 1}, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        let speedSlider = embySlider({ labelId: eleIds.danmakuSpeedLabel, key: lsKeys.danmakuSpeed}
            , {}, onDanmakuStyleChange, onDanmakuStyleChangeLabel);
        container.querySelector('#' + eleIds.danmakuSizeDiv).appendChild(sizeSlider);
        container.querySelector('#' + eleIds.danmakuAlphaDiv).appendChild(alphaSlider);
        container.querySelector('#' + eleIds.danmakuSpeedDiv).appendChild(speedSlider);
        embySliderSetValue(sizeSlider, localStorage.getItem(lsKeys.danmakuFontSizeMagnification) || '1.0');
        embySliderSetValue(alphaSlider, localStorage.getItem(lsKeys.danmakuFontOpacity) || '1.0');
        embySliderSetValue(speedSlider, localStorage.getItem(lsKeys.danmakuSpeed) || '1.0');
        let btnContainer = container.querySelector('#' + eleIds.danmakuOffsetDiv);
        let styleOffsetOpts = { labelId: eleIds.danmakuOffsetLabel, key: lsKeys.danmakuTimelineOffset };
        onDanmakuStyleChangeLabel(localStorage.getItem(lsKeys.danmakuTimelineOffset) || '0', styleOffsetOpts);
        danmakuStyleOffsetBtns.forEach(btn => {
            btnContainer.appendChild(embyButton(btn, (event) => {
                const elementType = event.target.nodeName.toLowerCase();
                let element = undefined;
                if (elementType === 'button') {
                    element = event.target;
                } else if (elementType === 'i') {
                    element = event.target.parentElement;
                }
                if (element) {
                    let oldValue = parseFloat(localStorage.getItem(lsKeys.danmakuTimelineOffset) || '0');
                    let newValue = oldValue + (parseFloat(element.getAttribute('styleOffset')) || 0);
                    // 如果 offset 为 0，则 newValue 应该设置为 0
                    if (newValue === oldValue) { newValue = 0;}
                    onDanmakuStyleChange(newValue, styleOffsetOpts);
                }
            }));
        });
    }
    

    function doDanmakuSwitch(flag) {
        console.log('切换弹幕开关');
        window.ede.danmakuSwitch = flag ? 1 : 0;
        window.localStorage.setItem(lsKeys.danmakuSwitch, window.ede.danmakuSwitch);
        document.querySelector('#displayDanmaku').children[0].innerText = danmaku_icons[window.ede.danmakuSwitch];
        if (window.ede.danmaku) {
            flag ? window.ede.danmaku.show() : window.ede.danmaku.hide();
        }
    }

    async function doDanmakuSearchEpisode() {
        let embySearch = document.getElementById(eleIds.danmakuSearchName);
        if (!embySearch) {
            return;
        }
        let searchName = embySearch.value
        const danmakuRemarkEle = document.getElementById(eleIds.danmakuRemark);
        danmakuRemarkEle.innerText = searchName ? '' : '请填写标题';
        document.querySelector(".mdl-spinner").classList.remove('hide');
        let anime_id = searchDanmakuOpts.anime_id;
        let episode = searchDanmakuOpts.episode;
        
        const animaInfo = await fetchSearchEpisodes(searchName);
        document.querySelector('.mdl-spinner').classList.add('hide');
        if (!animaInfo || animaInfo.animes.length < 1) {
            danmakuRemarkEle.innerText = '搜索结果为空';
            document.getElementById(eleIds.danmakuSwitchEpisode).disabled = true;
            document.getElementById(eleIds.danmakuEpisodeFlag).hidden = true;
            return;
        } else {
            danmakuRemarkEle.innerText = '';
        }
        let danmakuEpisodeDiv = document.getElementById(eleIds.danmakuEpisodeDiv);
        let danmakuEpisodeNumDiv = document.getElementById(eleIds.danmakuEpisodeNumDiv);
        danmakuEpisodeDiv.innerHTML = '';
        danmakuEpisodeNumDiv.innerHTML = '';
        let animes = animaInfo.animes;
        searchDanmakuOpts.animes = animes;

        let selectAnimeIdx = animes.findIndex(anime => anime.animeId == anime_id);
        selectAnimeIdx = selectAnimeIdx !== -1 ? selectAnimeIdx : 0;
        let episodeSelect = embySelect(eleIds.danmakuEpisodeSelect, '剧集: ', selectAnimeIdx
            , animes, 'animeId', option => `${option.animeTitle} 类型：${option.typeDescription}`, doDanmakuEpisodeSelect);
        danmakuEpisodeDiv.appendChild(episodeSelect);
        let episodeNumSelect = embySelect(eleIds.danmakuEpisodeNumSelect, '集数: ', episode
            , animes[selectAnimeIdx].episodes, 'episodeId', 'episodeTitle');
        episodeNumSelect.style.maxWidth = '100%';
        danmakuEpisodeNumDiv.appendChild(episodeNumSelect);        
        document.getElementById(eleIds.danmakuEpisodeFlag).hidden = false;
        document.getElementById(eleIds.danmakuSwitchEpisode).disabled = false;
    }  

    function doDanmakuEpisodeSelect() {
        let numDiv = document.getElementById(eleIds.danmakuEpisodeNumDiv);
        numDiv.innerHTML = '';
        const idx = document.getElementById(eleIds.danmakuEpisodeSelect).selectedIndex;
        let episodeNumSelect = embySelect(eleIds.danmakuEpisodeNumSelect, '集数: ', idx
            , searchDanmakuOpts.animes[idx].episodes, 'episodeId', 'episodeTitle');
        episodeNumSelect.style.maxWidth = '100%';
        numDiv.appendChild(episodeNumSelect);
    }

    function doDanmakuSwitchEpisode() {
        let episodeSelect = document.getElementById(eleIds.danmakuEpisodeSelect);
        let episodeNumSelect = document.getElementById(eleIds.danmakuEpisodeNumSelect);

        let episodeInfo = {
            episodeId: episodeNumSelect.value,
            animeTitle: searchDanmakuOpts.animes[episodeSelect.selectedIndex].animeTitle,
            episodeTitle: searchDanmakuOpts.animes[episodeSelect.selectedIndex].type == 'tvseries' 
                ?  episodeNumSelect.options[episodeNumSelect.selectedIndex].text
                : null,
        }
        window.localStorage.setItem(searchDanmakuOpts._episode_key, JSON.stringify(episodeInfo));
        console.log(`手动匹配信息:`, episodeInfo);
        loadDanmaku(LOAD_TYPE.RELOAD);
    }

    function doDanmakuEngineSelect(index) {
        let selectedValue = danmakuEngineOpts[index].id;
        if (selectedValue != localStorage.getItem(lsKeys.danmakuEngine)) {
            localStorage.setItem(lsKeys.danmakuEngine, selectedValue);
            console.log(`已更改弹幕引擎为: ${selectedValue}`);
            loadDanmaku(LOAD_TYPE.RELOAD);
            // embyToast({ text: `已生效,已更改弹幕引擎为: ${selectedValue}` });
        }
    }

    function doDanmakuChConverChange(index) {
        window.ede.chConvert = danmakuChConverOpts[index].id;
        window.localStorage.setItem(lsKeys.chConvert, window.ede.chConvert);
        document.querySelector('#translateDanmaku')?.setAttribute('title', chConverTtitle[window.ede.chConvert]);
        loadDanmaku(LOAD_TYPE.REFRESH);
        console.log(chConverTtitle[window.ede.chConvert]);
    }

    function doDanmakuFilterLevelChange(index) {
        const level = parseInt(danmakuFilterLevelOpts[index].id);
        console.log(`切换弹幕密度等级: ${level}`);
        doDanmakuChange({ danmakuFilterLevel: level });
        const doc = document.getElementById(eleIds.filteringDanmaku);
        if (doc) {
            doc.children[0].innerHTML = filter_icons[level];
        }
    }

    function doDanmakuTypeFilterSelect() {
        const checkList = Array.from(document.getElementsByName(eleIds.danmakuTypeFilterSelectName))
            .filter(item => item.checked).map(item => item.value);
        localStorage.setItem(lsKeys.danmakuTypeFilter, JSON.stringify(checkList));
        loadDanmaku(LOAD_TYPE.RELOAD);
        const idNameMap = new Map(danmakuTypeFilterOpts.map(opt => [opt.id, opt.name]));
        console.log(`当前弹幕类型过滤为: ${JSON.stringify(checkList.map(s => idNameMap.get(s)))}`);
        // embyToast({ text: `已生效,当前弹幕类型过滤为: ${JSON.stringify(checkList.map(s => idNameMap.get(s)))}` });
    }

    function onDanmakuStyleChange(val, props) {
        // reset the label
        onDanmakuStyleChangeLabel(val, props);
        if (props?.key) {
            const oldValue = parseFloat(localStorage.getItem(props.key));
            if (oldValue != parseFloat(val)) {
                localStorage.setItem(props.key, val);
                console.log(`${props.key} changed to ${val}`);
                loadDanmaku(LOAD_TYPE.RELOAD);
            }
        }
    }

    function onDanmakuStyleChangeLabel(val, props) {
        if (props?.labelId) {
            document.getElementById(props.labelId).innerText = val;
            console.log(`${props.key} slider to ${val}`);
        }
    }

    function doDanmakuFilterKeywordsBtnClick(event) {
        console.log('keywordsBtn.click', event);
        event.target.style = '';
        event.target.disabled = true;
        let keywords = document.getElementById(eleIds.filterKeywordsId).value.trim();
        let enable = document.getElementById(eleIds.filterKeywordsEnableId).checked;
        if (enable !== window.ede.filterKeywordsEnable) {
            window.ede.filterKeywordsEnable = enable;
        }
        if (keywords !== window.ede.filterKeywords) {
            window.ede.filterKeywords = keywords;
        } else if (keywords === '') {
            return;
        }
        loadDanmaku(LOAD_TYPE.RELOAD);
    }

    function updateFilterKeywordsBtn(btn, flag, keywords) {
        const isSame = flag === window.ede.filterKeywordsEnable && keywords === window.ede.filterKeywords;
        btn.style = isSame ? '' : embyCheckGreenStyle;
        btn.disabled = isSame;
    }

    function embyInput(id, style, value, onChange) {
        let input = document.createElement('input', { is: 'emby-input' });
        input.setAttribute('id', id);
        input.setAttribute('style', style);
        input.setAttribute('value', value);
        input.className = embyInputClass;
        input.addEventListener('change', onChange);
        return input;
    }

    /** props: {id: 'btnId', label: 'label text', style: '', iconKey: '', ...} 
     * for setAttribute(key, value)
     * 'iconKey' will not setAttribute
     * */
    function embyButton(props, onClick) {
        let button = document.createElement('button', { is: 'emby-button' });
        button.setAttribute('type', 'button');
        Object.entries(props).forEach(([key, value]) => {
            if (key !== 'iconKey') {button.setAttribute(key, value);}
        });
        if (props.iconKey) {
            button.setAttribute('title', props.label);
            button.setAttribute('aria-label', props.label);
            button.innerHTML = `<i class="md-icon autortl">${props.iconKey}</i>`;
            button.className = embyIconButtonClass;
        } else {
            button.className = 'btnOption raised emby-button';
            button.textContent = props.label;
        }
        if (onClick) {button.addEventListener('click', onClick);}
        return button;
    }

    function embyTabs(options, selectedValue, optionValueKey, optionTitleKey, onChange) {
        let tabs = document.createElement('div', { is: 'emby-tabs' });
        tabs.setAttribute('data-index', '0');
        tabs.className = embyTabsDivClass1;
        tabs.style.width = 'fit-content';
        let tabsSlider = document.createElement('div');
        tabsSlider.className = embyTabsDivClass2;
        tabsSlider.style.padding = '0.25em';
        options.forEach((option, index) => {
            const value = getValueOrInvoke(option, optionValueKey);
            const title = getValueOrInvoke(option, optionTitleKey);
            let tabButton = document.createElement('button');
            tabButton.className = `${embyTabsButtonClass}${value === selectedValue ? ' emby-tab-button-active' : ''}`;
            tabButton.setAttribute('data-index', index);
            tabButton.textContent = title;
            tabsSlider.appendChild(tabButton);
        });
        tabs.appendChild(tabsSlider);
        if (onChange) {
            tabs.addEventListener('tabchange', e => onChange(e.detail.selectedTabIndex));
        }
        return tabs;
    }

    function embySelect(id, label, selected, options, optionValueKey, optionTitleKey, onChange) {
        if (!Number.isInteger(selected)) {
            selected = options.indexOf(selected);
        }
        const selectElement = document.createElement('select', { is: 'emby-select'});
        selectElement.setAttribute('id', id);
        selectElement.setAttribute('label', label);
        selectElement.setAttribute('style', embySelectStyle);
        selectElement.setAttribute('class', 'selectSyncTarget emby-select');
        options.forEach((option, index) => {
            const value = getValueOrInvoke(option, optionValueKey);
            const title = getValueOrInvoke(option, optionTitleKey);
            let optionElement = document.createElement('option');
            optionElement.value = value;
            optionElement.textContent = title;
            if (index === selected) {
                optionElement.selected = true;
            }
            selectElement.appendChild(optionElement);
        });
        if (onChange) {
            selectElement.addEventListener('change', e => onChange(e.target.value));
        }
        return selectElement;
    }
    
    function embyCheckboxList(id, checkBoxName, selectedStrArray, options, onChange, isVertical = false) {
        let checkboxContainer = document.createElement('div');
        checkboxContainer.setAttribute('class', embyCheckboxListClass);
        checkboxContainer.setAttribute('style', isVertical ? '' : embyCheckboxListStyle);
        checkboxContainer.setAttribute('id', id);
        options.forEach(option => {
            checkboxContainer.appendChild(embyCheckbox(null, checkBoxName, option.name, option.id, 
                selectedStrArray?.indexOf(option.id) > -1 , onChange));
        });
        return checkboxContainer;
    }
    
    function embyCheckbox(id, name, label, value, checked = false, onChange) {
        let checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add('emby-checkbox-label');
        checkboxLabel.setAttribute('style', 'width: auto;');
        let checkbox = document.createElement('input', { is: 'emby-checkbox' });
        checkbox.setAttribute('is', 'emby-checkbox');
        checkbox.setAttribute('type', 'checkbox');
        if (id) { checkbox.setAttribute('id', id); }
        checkbox.setAttribute('name', name);
        checkbox.setAttribute('value', value);
        checkbox.checked = checked;
        checkbox.classList.add('emby-checkbox', 'chkEnableLiveTvAccess');
        if (onChange) {
            checkbox.addEventListener('change', e => onChange(e.target.checked));
        }
        let span = document.createElement('span');
        span.setAttribute('class', 'checkboxLabel');
        span.innerHTML = label;
        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(span);
        return checkboxLabel;
    }

    function embyTextarea(id, value, style, rows = 10, resize = true, readonly = false, onBlur) {
        let textarea = document.createElement('textarea', { is: 'emby-textarea' });
        textarea.setAttribute('id', id);
        textarea.setAttribute('style', style);
        textarea.setAttribute('rows', rows);
        textarea.className = 'txtOverview emby-textarea';
        textarea.readOnly = readonly;
        textarea.style.resize = resize;
        textarea.value = value;
        if (typeof onBlur === 'function') { textarea.addEventListener('blur', onBlur)};
        return textarea;
    }

    // orient: 'vertical' | 'horizontal' 垂直/水平
    // props: {id: 'slider id', labelId: 'label id', ...} will return to the callback
    function embySlider(props = {}, options = {}, onChange, onSliding) {
        const defaultOpts = { min: 0.1, max: 3, step: 0.1, orient: 'horizontal', bubble: false, hoverthumb: true , style: ''};
        options = { ...defaultOpts, ...options };
        let slider = document.createElement('input', { is: 'emby-slider' });
        slider.setAttribute('type', 'range');
        if (props.id) { slider.setAttribute('id', props.id); }
        slider.setAttribute('min', options.min);
        slider.setAttribute('max', options.max);
        slider.setAttribute('step', options.step);
        slider.setAttribute('style', options.style);
        slider.setAttribute('orient', options.orient);
        slider.setAttribute('data-bubble', options.bubble);  // To show the value bubble
        slider.setAttribute('data-hoverthumb', options.hoverthumb);
        if (onChange) {
            // Trigger after end of tap/swipe
            slider.addEventListener('change', e => onChange(e.target.value, props));
        }
        if (onSliding) {
            // when clicking/sliding, trigger every step
            slider.addEventListener('input', e => onSliding(e.target.value, props));
        }
        /* slider.addEventListener('beginediting', function(event) {
            // when clicking/sliding, trigger every step
            console.log('Slider editing started');
        });
        slider.addEventListener('endediting', function(event) {
            // Trigger after end of tap/swipe
            console.log('Slider editing ended');
        }); */
        // Add keyboard event listeners to the slider
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

    // after slider append to container, then call this function to set value to slider
    function embySliderSetValue(slider, value) {
        slider.value = value;
        slider.dispatchEvent(new Event('change'));
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

    // from emby videoosd.js bindToPlayer events, warning: not dom event
    function playbackEventsOn(eventsMap, data = {}) {
        require(['playbackManager', 'events'], (playbackManager, events) => {
            if (!playbackManager || !events) { return; }
            const player = playbackManager.getCurrentPlayer();
            const playState = playbackManager.getPlayerState().PlayState;
            console.log(`PlaybackRate: ${playState.PlaybackRate}`);
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
        let _container = document.querySelector('.htmlVideoPlayerContainer');
        if (!_container) {
            _container = document.createElement('div');
            _container.id = eleIds.h5VideoAdapterContainer;
            _container.classList.add('htmlVideoPlayerContainer');
            document.body.insertBefore(_container, document.body.firstChild);
        }
        _media = document.createElement('video');
        _media.classList.add('htmlvideoplayer', 'moveUpSubtitles');
        _container.insertBefore(_media, _container.firstChild);
        _media.play();

        // 需在其它事件中实现,同步 video 适配器播放倍率,有 bug 未实现且只显示半屏,暂时注释
        // if (!_media.src) {
        //     _media.playbackRate = data.playbackManager.getPlayerState().PlayState.PlaybackRate ?? 1;
        // }
        playbackEventsOn({
            'timeupdate': (e, data) => {
                // conver to seconds from Ticks
                _media.currentTime = data.playbackManager.currentTime(data.player) / 1e7;
            },
        });
        console.log('已创建虚拟 video 标签,适配器处理正确结束');
        embyToast({ text: `已创建虚拟 video 标签,适配器处理正确结束` });
    }

    function beforeDestroy() {
        // 此段销毁不重要,可有可无,仅是规范使用
        // 清除弹幕,但未销毁 danmaku 实例
        if (window.ede.danmaku) {
            window.ede.danmaku.clear();
            console.log(`已清除弹幕`);
        }
        // 销毁自定义的 initH5VideoAdapter
        const _container = document.getElementById(eleIds.h5VideoAdapterContainer);
        if (_container) {
            _container.remove();
            console.log(`已销毁 initH5VideoAdapter: ${eleIds.h5VideoAdapterContainer}`);
        }
        // 以下重要,销毁弹幕按钮容器简单,双 mediaContainerQueryStr 下免去 DOM 位移操作
        const danmakuCtrEle = document.getElementById(eleIds.danmakuCtr);
        if (danmakuCtrEle) {
            danmakuCtrEle.remove();
            console.log(`已销毁弹幕按钮容器: ${eleIds.danmakuCtr}`);
        }
        // 以下重要，销毁定时器
        window.ede.destroyTimeoutIds.forEach(id => clearTimeout(id));
        window.ede.destroyTimeoutIds = [];
    }

    // emby/jellyfin CustomEvent. see: https://github.com/MediaBrowser/emby-web-defaultskin/blob/822273018b82a4c63c2df7618020fb837656868d/nowplaying/videoosd.js#L698
    document.addEventListener('viewshow', function (e) {
        console.log('viewshow', e);
        isJellyfin = ApiClient.appName().startsWith('Jellyfin');
        embyItemId = e.detail.params.id ?? embyItemId;
        let isTargetPage = e.detail.type === 'video-osd';
        if (isTargetPage) {
            window.ede = new EDE();
            initUI();
            initH5VideoAdapter();
            // loadDanmaku(LOAD_TYPE.INIT);
            initListener();
        }
    });
    document.addEventListener('viewbeforehide', function (e) {
        console.log('viewbeforehide', e);
        let isTargetPage = e.detail.type === 'video-osd';
        if (isTargetPage) {
            beforeDestroy();
        }
    });

})();
