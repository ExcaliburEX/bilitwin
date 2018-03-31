/***
 * Copyright (C) 2018 Qli5. All Rights Reserved.
 * 
 * @author qli5 <goodlq11[at](163|gmail).com>
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import Exporter from './exporter.js';
import Destroy from '../util/destroy.js';
import FLV from '../flvparser/flv.js';
import MKVTransmuxer from '../flvass2mkv/interface.js';

class UI {
    constructor(twin, option = UI.optionDefaults) {
        this.twin = twin;
        this.option = option;

        this.destroy = new Destroy();
        this.dom = {}
        this.cidSessionDestroy = new Destroy();
        this.cidSessionDom = {};

        this.destroy.addCallback(this.cidSessionDestroy.bind(this));

        this.destroy.addCallback(() => {
            Object.values(this.dom).forEach(e => e.remove());
            this.dom = {};
        });
        this.cidSessionDestroy.addCallback(() => {
            Object.values(this.cidSessionDom).forEach(e => e.remove());
            this.cidSessionDom = {};
        });

        this.styleClearance();
    }

    styleClearance() {
        let ret = `
        .bilibili-player-context-menu-container.black ul.bilitwin li.context-menu-function > a:hover {
            background: rgba(255,255,255,.12);
            transition: all .3s ease-in-out;
            cursor: pointer;
        }
        `;
        if (top.getComputedStyle(top.document.body).color != 'rgb(34, 34, 34)') ret += `
        .bilitwin a {
            cursor: pointer;
            color: #00a1d6;
        }

        .bilitwin a:hover {
            color: #f25d8e;
        }

        .bilitwin button {
            color: #fff;
            cursor: pointer;
            text-align: center;
            border-radius: 4px;
            background-color: #00a1d6;
            vertical-align: middle;
            border: 1px solid #00a1d6;
            transition: .1s;
            transition-property: background-color,border,color;
            user-select: none;
        }

        .bilitwin button:hover {
            background-color: #00b5e5;
            border-color: #00b5e5;
        }

        .bilitwin progress {
            -webkit-appearance: progress;
        }
        `;

        const style = <style type="text/css" rel="stylesheet">{ret}</style>;
        document.head.append(style);

        return this.dom.style = style;
    }

    cidSessionRender() {
        this.buildTitle();

        if (this.option.title) this.appendTitle();
        if (this.option.menu) this.appendMenu();
    }

    // Title Append
    buildTitle(monkey = this.twin.monkey) {
        // 1. build flvA, mp4A, assA
        const fontSize = '15px';
        const flvA = <a style={{ fontSize }}>超清FLV</a>;
        const mp4A = <a style={{ fontSize }}>原生MP4</a>;
        const assA = <a style={{ fontSize }}>弹幕ASS</a>;

        // 1.1 build flvA
        flvA.onmouseover = async () => {
            // 1.1.1 give processing hint
            flvA.textContent = '正在FLV';
            flvA.onmouseover = null;
            if (this.option.autoDanmaku) assA.onmouseover();

            // 1.1.2 query flv
            const href = await monkey.queryInfo('flv');
            if (href == 'does_not_exist') return flvA.textContent = '没有FLV';

            // 1.1.3 display flv
            flvA.textContent = '超清FLV';
            flvA.onclick = () => this.displayFLVDiv();
        };

        // 1.2 build mp4A
        mp4A.onmouseover = async () => {
            // 1.2.1 give processing hint
            mp4A.textContent = '正在MP4';
            mp4A.onmouseover = null;
            if (this.option.autoDanmaku) assA.onmouseover();

            // 1.2.2 query flv
            let href = await monkey.queryInfo('mp4');
            if (href == 'does_not_exist') return mp4A.textContent = '没有MP4';

            // 1.2.3 response mp4
            mp4A.href = href;
            mp4A.textContent = '原生MP4';
            mp4A.download = '';
            mp4A.referrerPolicy = 'origin';
        };

        // 1.3 build assA
        assA.onmouseover = async () => {
            // 1.3.1 give processing hint
            assA.textContent = '正在ASS';
            assA.onmouseover = null;

            // 1.3.2 query flv
            assA.href = await monkey.queryInfo('ass');

            // 1.3.3 response mp4
            assA.textContent = '弹幕ASS';
            if (monkey.mp4 && monkey.mp4.match) {
                assA.download = monkey.mp4.match(/\d(?:\d|-|hd)*(?=\.mp4)/)[0] + '.ass';
            }
            else {
                assA.download = monkey.cid + '.ass';
            }
        };

        // 2. save to cache
        Object.assign(this.cidSessionDom, { flvA, mp4A, assA });
        return this.cidSessionDom;
    }

    appendTitle({ flvA, mp4A, assA } = this.cidSessionDom) {
        // 1. build div
        const div = <div
            onClick={e => e.stopPropagation()}
            style={{ float: 'left', clear: 'left' }}
            className="bilitwin"
        >{...[flvA, ' ', mp4A, ' ', assA]}</div>;

        // 2. append to title
        const tminfo = document.querySelector('div.tminfo') || document.querySelector('div.info-second');
        tminfo.style.float = 'none';
        tminfo.style.marginLeft = '185px';
        tminfo.parentElement.insertBefore(div, tminfo);

        return div;
    }

    buildFLVDiv(monkey = this.twin.monkey, flvs = monkey.flvs, cache = monkey.cache) {
        // 1. build flv splits
        const flvTrs = flvs.map((href, index) => {
            const tr = <tr>
                <td><a href={href}>FLV分段 {index + 1}</a></td>
                <td><a onclick={e => this.downloadFLV({
                    monkey,
                    index,
                    a: e.target,
                    progress: tr.children[2].children[0],
                })}>缓存本段</a></td>
                <td><progress value="0" max="100">进度条</progress></td>
            </tr>;
            return tr;
        });

        // 2. build exporter a
        const exporterA = <a></a>;
        if (this.option.aria2) {
            exporterA.textContent = '导出Aria2';
            exporterA.download = 'bilitwin.session';
            exporterA.href = URL.createObjectURL(new Blob([Exporter.exportAria2(flvs, top.location.origin)]));
        }
        else if (this.option.aria2RPC) {
            exporterA.textContent = '发送Aria2 RPC';
            exporterA.onclick = () => Exporter.sendToAria2RPC(flvs, top.location.origin);
        }
        else if (this.option.m3u8) {
            exporterA.textContent = '导出m3u8';
            exporterA.download = 'bilitwin.m3u8';
            exporterA.href = URL.createObjectURL(new Blob([Exporter.exportM3U8(flvs, top.location.origin, top.navigator.userAgent)]));
        }
        else if (this.option.clipboard) {
            exporterA.textContent = '全部复制到剪贴板';
            exporterA.onclick = () => Exporter.copyToClipboard(flvs.join('\n'));
        }
        else {
            exporterA.textContent = '导出IDM';
            exporterA.download = 'bilitwin.ef2';
            exporterA.href = URL.createObjectURL(new Blob([Exporter.exportIDM(flvs, top.location.origin)]));
        }

        // 3. build body table
        const table = <table style={{ width: '100%', lineHeight: '2em' }}></table>;
        table.append(
            ...flvTrs,
            <tr>
                <td>{...[exporterA]}</td>
                <td><a onclick={e => this.downloadAllFLVs({
                    a: e.target,
                    monkey, table
                })}>缓存全部+自动合并</a></td>
                <td><progress value="0" max={flvs.length + 1}>进度条</progress></td>
            </tr>,
            <tr><td colspan="3">合并功能推荐配置：至少8G RAM。把自己下载的分段FLV拖动到这里，也可以合并哦~</td></tr>,
            cache ?
                <tr><td colspan="3">下载的缓存分段会暂时停留在电脑里，过一段时间会自动消失。建议只开一个标签页。</td></tr> :
                <tr><td colspan="3">建议只开一个标签页。关掉标签页后，缓存就会被清理。别忘了另存为！</td></tr>,
            <tr><td colspan="3" ref={this.displayQuota.bind(this)}></td></tr>
        );
        this.cidSessionDom.flvTable = table;

        // 4. build container dlv
        const div = UI.genDiv();
        div.ondragenter = div.ondragover = e => UI.allowDrag(e);
        div.ondrop = async e => {
            // 4.1 allow drag
            UI.allowDrag(e);

            // 4.2 sort files if possible
            const files = Array.from(e.dataTransfer.files);
            if (files.every(e => e.name.search(/\d+-\d+(?:\d|-|hd)*\.flv/) != -1)) {
                files.sort((a, b) => a.name.match(/\d+-(\d+)(?:\d|-|hd)*\.flv/)[1] - b.name.match(/\d+-(\d+)(?:\d|-|hd)*\.flv/)[1]);
            }

            // 4.3 give loaded files hint
            table.append(files.map(e => <tr><td colspan="3">{file.name}</td></tr>));

            // 4.4 determine output name
            let outputName = files[0].name.match(/\d+-\d+(?:\d|-|hd)*\.flv/);
            if (outputName) outputName = outputName[0].replace(/-\d/, "");
            else outputName = 'merge_' + files[0].name;

            // 4.5 build output ui
            const href = await this.twin.mergeFLVFiles(files);
            table.append(<tr><td colspan="3"><a href={href} download={outputName}>{outputName}</a></td></tr>);
        }

        // 5. build util buttons
        div.append(
            table,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => div.style.display = 'none'}>关闭</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => monkey.cleanAllFLVsInCache()}>清空这个视频的缓存</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => this.twin.clearCacheDB(cache)}>清空所有视频的缓存</button>,
        );

        // 6. cancel on destroy
        this.cidSessionDestroy.addCallback(() => {
            flvTrs.map(tr => {
                const a = tr.children[1].children[0];
                if (a.textContent == '取消') a.click();
            })
        });

        return this.cidSessionDom.flvDiv = div;
    }

    displayFLVDiv(flvDiv = this.cidSessionDom.flvDiv) {
        if (!flvDiv) {
            flvDiv = this.buildFLVDiv();
            document.body.append(flvDiv);
        }
        flvDiv.style.display = '';
        return flvDiv
    }

    async downloadAllFLVs({ a, monkey = this.twin.monkey, table = this.cidSessionDom.flvTable }) {
        if (this.cidSessionDom.downloadAllTr) return;

        // 1. hang player
        monkey.hangPlayer();

        // 2. give hang player hint
        this.cidSessionDom.downloadAllTr = <tr><td colspan="3">已屏蔽网页播放器的网络链接。切换清晰度可重新激活播放器。</td></tr>;
        table.append(this.cidSessionDom.downloadAllTr);

        // 3. click download all split
        for (let i = 0; i < monkey.flvs.length; i++) {
            if (table.rows[i].cells[1].children[0].textContent == '缓存本段')
                table.rows[i].cells[1].children[0].click();
        }

        // 4. set sprogress
        const progress = a.parentNode.nextSibling.children[0];
        progress.max = monkey.flvs.length + 1;
        progress.value = 0;
        for (let i = 0; i < monkey.flvs.length; i++) monkey.getFLV(i).then(e => progress.value++);

        // 5. merge splits
        const files = await monkey.getAllFLVs();
        const href = await this.twin.mergeFLVFiles(files);
        const ass = await monkey.ass;
        const outputName = top.document.getElementsByTagName('h1')[0].textContent.trim();

        // 6. build download all ui
        progress.value++;
        table.prepend(
            <tr>
                <td colspan="3" style="border: 1px solid black">
                    <a href={href} download={`${outputName}.flv`} ref={a => {
                        if (this.option.autoDanmaku) a.onclick = () => a.nextSibling.click()
                    }}>保存合并后FLV</a>
                    {' '}
                    <a href={ass} download={`${outputName}.ass`}>弹幕ASS</a>
                    {' '}
                    <a onclick={() => new MKVTransmuxer().exec(href, ass, `${outputName}.mkv`)}>打包MKV(软字幕封装)</a>
                    {' '}
                    记得清理分段缓存哦~
               </td>
            </tr>
        );

        return href;
    }

    async downloadFLV({ a, monkey = this.twin.monkey, index, progress = {} }) {
        // 1. add beforeUnloadHandler
        const handler = e => UI.beforeUnloadHandler(e);
        window.addEventListener('beforeunload', handler);

        // 2. switch to cancel ui
        a.textContent = '取消';
        a.onclick = () => {
            a.onclick = null;
            window.removeEventListener('beforeunload', handler);
            a.textContent = '已取消';
            monkey.abortFLV(index);
        };

        // 3. try download
        let url;
        try {
            url = await monkey.getFLV(index, (loaded, total) => {
                progress.value = loaded;
                progress.max = total;
            });
            url = URL.createObjectURL(url);
            if (progress.value == 0) progress.value = progress.max = 1;
        } catch (e) {
            a.onclick = null;
            window.removeEventListener('beforeunload', handler);
            a.textContent = '错误';
            throw e;
        }

        // 4. switch to complete ui
        a.onclick = null;
        window.removeEventListener('beforeunload', handler);
        a.textContent = '另存为';
        a.download = monkey.flvs[index].match(/\d+-\d+(?:\d|-|hd)*\.flv/)[0];
        a.href = url;
        return url;
    }

    async displayQuota(td) {
        return new Promise(resolve => {
            const temporaryStorage = window.navigator.temporaryStorage
                || window.navigator.webkitTemporaryStorage
                || window.navigator.mozTemporaryStorage
                || window.navigator.msTemporaryStorage;
            if (!temporaryStorage) return resolve(td.textContent = '这个浏览器不支持缓存呢~关掉标签页后，缓存马上就会消失哦');
            temporaryStorage.queryUsageAndQuota((usage, quota) =>
                resolve(td.textContent = `缓存已用空间：${Math.round(usage / 1048576)} MB / ${Math.round(quota / 1048576)} MB 也包括了B站本来的缓存`)
            );
        });
    }

    // Menu Append
    appendMenu(playerWin = this.twin.playerWin) {
        const monkeyMenu = this.buildMonkeyMenu();
        const polyfillMenu = this.buildPolyfillMenu();

        const ul = <ul class="bilitwin" style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            {...[monkeyMenu, polyfillMenu]}
        </ul>;

        const div = playerWin.document.getElementsByClassName('bilibili-player-context-menu-container black')[0];
        div.prepend(ul);

        return ul;
    }

    buildMonkeyMenu({
        playerWin = this.twin.playerWin,
        BiliMonkey = this.twin.BiliMonkey,
        monkey = this.twin.monkey,
        flvA = this.cidSessionDom.flvA,
        mp4A = this.cidSessionDom.mp4A,
        assA = this.cidSessionDom.assA,
        optionDiv = this.cidSessionDom.optionDiv,
    } = {}) {
        return <li
            class="context-menu-menu bilitwin"
            onclick={() => playerWin.document.getElementById('bilibiliPlayer').click()}
        >
            <a class="context-menu-a">
                BiliMonkey
            <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
            </a>
            <ul>
                <li class="context-menu-function" onclick={async () => {
                    if (flvA.onmouseover) await flvA.onmouseover();
                    flvA.click();
                }}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载FLV
                </a>
                </li>
                <li class="context-menu-function" onclick={async () => {
                    if (mp4A.onmouseover) await mp4A.onmouseover();
                    mp4A.click();
                }}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载MP4
                </a>
                </li>
                <li class="context-menu-function" onclick={async () => {
                    if (assA.onmouseover) await assA.onmouseover();
                    assA.click();
                }}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载ASS
                </a>
                </li>
                <li class="context-menu-function" onclick={() => this.displayOptionDiv()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 设置/帮助/关于
                </a>
                </li>
                <li class="context-menu-function" onclick={async () => UI.displayDownloadAllPageDefaultFormatsBody(await BiliMonkey.getAllPageDefaultFormats(playerWin))}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)批量下载
                </a>
                </li>
                <li class="context-menu-function" onclick={async () => {
                    monkey.proxy = true;
                    monkey.flvs = null;
                    UI.hintInfo('请稍候，可能需要10秒时间……', playerWin);
                    // Yes, I AM lazy.
                    playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div ul li[data-value="80"]').click();
                    await new Promise(r => playerWin.document.getElementsByTagName('video')[0].addEventListener('emptied', r));
                    return monkey.queryInfo('flv');
                }}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)载入缓存FLV
                </a>
                </li>
                <li class="context-menu-function" onclick={() => top.location.reload(true)}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)强制刷新
                </a>
                </li>
                <li class="context-menu-function" onclick={() => this.cidSessionDestroy() && this.cidSessionRender()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)重启脚本
                </a>
                </li>
                <li class="context-menu-function" onclick={() => playerWin.player && playerWin.player.destroy()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)销毁播放器
                </a>
                </li>
            </ul>
        </li>;
    }

    buildPolyfillMenu({
        playerWin = this.twin.playerWin,
        BiliPolyfill = this.twin.BiliPolyfill,
        polyfill = this.twin.polyfill,
        optionDiv = this.cidSessionDom.optionDiv,
    } = {}) {
        let oped = [];
        const refreshSession = new Destroy(() => oped = polyfill.userdata.oped[polyfill.getCollectionId()] || []); // as a convenient callback register
        return <li
            class="context-menu-menu bilitwin"
            onclick={() => playerWin.document.getElementById('bilibiliPlayer').click()}
        >
            <a class="context-menu-a" onmouseover={() => refreshSession()}>
                BiliPolyfill
                {!polyfill.option.betabeta ? '(到设置开启)' : ''}
                <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
            </a>
            <ul>
                <li
                    class="context-menu-function"
                    onclick={() => top.window.open(polyfill.getCoverImage(), '_blank')}
                >
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 获取封面
                    </a>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 更多播放速度
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function" onclick={() => { polyfill.setVideoSpeed(0.1) }}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 0.1
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => { polyfill.setVideoSpeed(3) }}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 3
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={e => polyfill.setVideoSpeed(e.children[0].children[1].value)}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 点击确认
                                <input
                                    type="text"
                                    style="width: 35px; height: 70%"
                                    onclick={e => e.stopPropagation()}
                                    ref={e => refreshSession.addCallback(() => e.value = polyfill.video.playbackRate)}
                                />
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 片头片尾
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function" onclick={() => polyfill.markOPEDPosition(0)}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 片头开始:<span
                                    ref={e => refreshSession.addCallback(() => e.textContent = oped[0] ? BiliPolyfill.secondToReadable(oped[0]) : '无')}
                                ></span>
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => polyfill.markOPEDPosition(1)}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 片头结束:<span
                                    ref={e => refreshSession.addCallback(() => e.textContent = oped[1] ? BiliPolyfill.secondToReadable(oped[1]) : '无')}
                                ></span>
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => polyfill.markOPEDPosition(2)}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 片尾开始:<span
                                    ref={e => refreshSession.addCallback(() => e.textContent = oped[2] ? BiliPolyfill.secondToReadable(oped[2]) : '无')}
                                ></span>
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => polyfill.markOPEDPosition(3)}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 片尾结束:<span
                                    ref={e => refreshSession.addCallback(() => e.textContent = oped[3] ? BiliPolyfill.secondToReadable(oped[3]) : '无')}
                                ></span>
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => polyfill.clearOPEDPosition()}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 取消标记
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => this.displayPolyfillDataDiv()}>
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 检视数据/说明
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 找上下集
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function" onclick={() => {
                            if (polyfill.series[0]) {
                                top.window.open(`https://www.bilibili.com/video/av${polyfill.series[0].aid}`, '_blank')
                            }
                        }}>
                            <a class="context-menu-a" style={{ width: 'initial' }}>
                                <span class="video-contextmenu-icon"></span> <span
                                    ref={e => refreshSession.addCallback(() => e.textContent = polyfill.series[0] ? polyfill.series[0].title : '找不到')}
                                ></span>
                            </a>
                        </li>
                        <li class="context-menu-function" onclick={() => {
                            if (polyfill.series[1]) {
                                top.window.open(`https://www.bilibili.com/video/av${polyfill.series[1].aid}`, '_blank')
                            }
                        }}>
                            <a class="context-menu-a" style={{ width: 'initial' }}>
                                <span class="video-contextmenu-icon"></span> <span
                                    ref={e => refreshSession.addCallback(() => e.textContent = polyfill.series[1] ? polyfill.series[1].title : '找不到')}
                                ></span>
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-function" onclick={() => BiliPolyfill.openMinimizedPlayer()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 小窗播放
                    </a>
                </li>
                <li class="context-menu-function" onclick={() => this.displayOptionDiv()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 设置/帮助/关于
                    </a>
                </li>
                <li class="context-menu-function" onclick={() => polyfill.saveUserdata()}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)立即保存数据
                    </a>
                </li>
                <li class="context-menu-function" onclick={() => {
                    BiliPolyfill.clearAllUserdata(playerWin);
                    polyfill.retrieveUserdata();
                }}>
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)强制清空数据
                    </a>
                </li>
            </ul>
        </li>;
    }

    buildOptionDiv(twin = this.twin) {
        const div = UI.genDiv();

        div.append(
            this.buildMonkeyOptionTable(),
            this.buildPolyfillOptionTable(),
            this.buildUIOptionTable(),
            <table style={{ width: '100%', lineHeight: '2em' }}>
                <tr><td>设置自动保存，刷新后生效。</td></tr>
                <tr><td>视频下载组件的缓存功能只在Windows+Chrome测试过，如果出现问题，请关闭缓存。</td></tr>
                <tr><td>功能增强组件尽量保证了兼容性。但如果有同功能脚本/插件，请关闭本插件的对应功能。</td></tr>
                <tr><td>这个脚本乃“按原样”提供，不附带任何明示，暗示或法定的保证，包括但不限于其没有缺陷，适合特定目的或非侵权。</td></tr>
                <tr><td>
                    <a href="https://greasyfork.org/zh-CN/scripts/27819" target="_blank">更新/讨论</a>
                    {' '}
                    <a href="https://github.com/liqi0816/bilitwin/" target="_blank">GitHub</a>
                    {' '}
                    Author: qli5. Copyright: qli5, 2014+, 田生, grepmusic
                </td></tr>
            </table>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => div.style.display = 'none'}>关闭</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => top.location.reload()}>保存并刷新</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => twin.resetOption() && top.location.reload()}>重置并刷新</button>,
        );

        return this.dom.optionDiv = div;
    }

    buildMonkeyOptionTable(twin = this.twin, BiliMonkey = this.twin.BiliMonkey) {
        const table = <table style={{ width: '100%', lineHeight: '2em' }}>
            <tr><td style="text-align:center">BiliMonkey（视频抓取组件）</td></tr>
            <tr><td style="text-align:center">因为作者偷懒了，缓存的三个选项最好要么全开，要么全关。最好。</td></tr>
        </table>;

        table.append(...BiliMonkey.optionDescriptions.map(([name, description]) => <tr>
            <label>
                <input
                    type="checkbox"
                    checked={twin.option[name]}
                    onchange={e => {
                        twin.option[name] = e.target.checked;
                        twin.saveOption(twin.option);
                    }} />
            </label>
            {description}
        </tr>));

        return table;
    }

    buildPolyfillOptionTable(twin = this.twin, BiliPolyfill = this.twin.BiliPolyfill) {
        const table = <table style={{ width: '100%', lineHeight: '2em' }}>
            <tr><td style="text-align:center">BiliPolyfill（功能增强组件）</td></tr>
            <tr><td style="text-align:center">懒鬼作者还在测试的时候，B站已经上线了原生的稍后再看(๑•̀ㅂ•́)و✧</td></tr>
        </table>;

        table.append(...BiliPolyfill.optionDescriptions.map(([name, description, disabled]) => <tr>
            <label style={{ textDecoration: disabled == 'disabled' ? 'line-through' : undefined }}>
                <input
                    type="checkbox"
                    checked={twin.option[name]}
                    onchange={e => {
                        twin.option[name] = e.target.checked;
                        twin.saveOption(twin.option);
                    }}
                    disabled={disabled == 'disabled'}
                />
            </label>
            {description}
        </tr>));

        return table;
    }

    buildUIOptionTable(twin = this.twin) {
        const table = <table style={{ width: '100%', lineHeight: '2em' }}>
            <tr><td style="text-align:center">UI（用户界面）</td></tr>
        </table>;

        table.append(...UI.optionDescriptions.map(([name, description]) => <tr>
            <label>
                <input
                    type="checkbox"
                    checked={twin.option[name]}
                    onchange={e => {
                        twin.option[name] = e.target.checked;
                        twin.saveOption(twin.option);
                    }} />
            </label>
            {description}
        </tr>));

        return table;
    }

    displayOptionDiv(optionDiv = this.dom.optionDiv) {
        if (!optionDiv) {
            optionDiv = this.buildOptionDiv();
            document.body.append(optionDiv);
        }
        optionDiv.style.display = '';
        return optionDiv
    }

    buildPolyfillDataDiv(polyfill = this.twin.polyfill) {
        const textarea = <textarea style={{ resize: 'vertical', width: '100%', height: '200px' }}>
            {JSON.stringify(polyfill.userdata.oped).replace(/{/, '{\n').replace(/}/, '\n}').replace(/],/g, '],\n')}
        </textarea>;

        const div = UI.genDiv();

        div.append(
            <p style={{ margin: '0.3em' }}>这里是脚本储存的数据。所有数据都只存在浏览器里，别人不知道，B站也不知道，脚本作者更不知道(这个家伙连服务器都租不起 摔</p>,
            <p style={{ margin: '0.3em' }}>B站已上线原生的稍后观看功能。</p>,
            <p style={{ margin: '0.3em' }}>这里是片头片尾。格式是，av号或番剧号:[片头开始(默认=0),片头结束(默认=不跳),片尾开始(默认=不跳),片尾结束(默认=无穷大)]。可以任意填写null，脚本会自动采用默认值。</p>,
            textarea,
            <p style={{ margin: '0.3em' }}>当然可以直接清空啦。只删除其中的一些行的话，一定要记得删掉多余的逗号。</p>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={() => div.remove()}>关闭</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={e => {
                if (!textarea.value) textarea.value = '{\n\n}';
                textarea.value = textarea.value.replace(/,(\s|\n)*}/, '\n}').replace(/,(\s|\n),/g, ',\n').replace(/,(\s|\n)*]/g, ']');
                const userdata = {};
                try {
                    userdata.oped = JSON.parse(textarea.value);
                } catch (e) { alert('片头片尾: ' + e); throw e; }
                e.target.textContent = '格式没有问题！';
                return userdata;
            }}>验证格式</button>,
            <button style={{ padding: '0.5em', margin: '0.2em' }} onclick={e => {
                polyfill.userdata = e.target.previousSibling.onclick({ target: e.target.previousSibling });
                polyfill.saveUserdata();
                e.target.textContent = '保存成功';
            }}>尝试保存</button>,
        );

        return div;
    }

    displayPolyfillDataDiv(polyfill) {
        const div = this.buildPolyfillDataDiv();
        document.body.append(div);
        div.style.display = 'block';

        return div;
    }

    // Common
    static buildDownloadAllPageDefaultFormatsBody(ret) {
        const table = <table onclick={e => e.stopPropagation()}></table>;

        for (const i of ret) {
            table.append(
                <tr>
                    <td>
                        {i.name}
                    </td>
                    <td>
                        <a href={i.durl[0]} download referrerpolicy="origin">{i.durl[0]}</a>
                    </td>
                    <td>
                        <a href={i.danmuku} download={`${i.outputName}.ass`} referrerpolicy="origin">{i.danmuku}</a>
                    </td>
                </tr>,
                ...i.durl.slice(1).map(href => <tr>
                    <td>
                    </td>
                    <td>
                        <a href={href} download referrerpolicy="origin">{href}</a>
                    </td>
                    <td>
                    </td>
                </tr>)
            );
        }

        return <fragment>
            <style>{`
                table {
                    width: 100%;
                    table-layout: fixed;
                }
            
                td {
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    text-align: center;
                }
            `}</style>
            <h1>(测试) 批量抓取</h1>
            <ul>
                <li>
                    <p>只抓取默认清晰度</p>
                </li>
                <li>
                    <p>复制链接地址无效，请左键单击/右键另存为/右键调用下载工具</p>
                    <p><em>开发者：需要校验referrer和user agent</em></p>
                </li>
                <li>
                    <p>flv合并 <a href='http://www.flvcd.com/teacher2.htm'>硕鼠</a></p>
                    <p>批量合并对单标签页负荷太大</p>
                    <p><em>开发者：可以用webworker，但是我没需求，又懒</em></p>
                </li>
            </ul>
            {table}
        </fragment>;
    }

    static displayDownloadAllPageDefaultFormatsBody(ret) {
        top.document.open();
        top.document.close();

        top.document.body.append(UI.buildDownloadAllPageDefaultFormatsBody(ret));
        return ret;
    }

    static genDiv() {
        return <div
            style={{
                position: 'fixed',
                zIndex: '10036',
                top: '50%',
                marginTop: '-200px',
                left: '50%',
                marginLeft: '-320px',
                width: '540px',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '30px 50px',
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: 'rgba(0, 0, 0, 0.6) 1px 1px 40px 0px',
                display: 'none',
            }}
            onClick={e => e.stopPropagation()}
            className="bilitwin"
        ></div>;
    }

    static requestH5Player() {
        const h = document.querySelector('div.tminfo');
        h.prepend('[[脚本需要HTML5播放器(弹幕列表右上角三个点的按钮切换)]] ');
    }

    static allowDrag(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    static beforeUnloadHandler(e) {
        return e.returnValue = '脚本还没做完工作，真的要退出吗？';
    }

    static hintInfo(text, playerWin) {
        const div = <div class="bilibili-player-video-toast-bottom">
            <div class="bilibili-player-video-toast-item">
                <div class="bilibili-player-video-toast-item-text">
                    <span>{text}</span>
                </div>
            </div>
        </div>;
        playerWin.document.getElementsByClassName('bilibili-player-video-toast-wrp')[0].append(div);
        setTimeout(() => div.remove(), 3000);
    }

    static get optionDescriptions() {
        return [
            // 1. automation
            ['autoDanmaku', '下载视频也触发下载弹幕'],

            // 2. user interface
            ['title', '在视频标题旁添加链接'],
            ['menu', '在视频菜单栏添加链接'],

            // 3. download
            ['aria2', '导出aria2'],
            ['aria2RPC', '发送到aria2 RPC'],
            ['m3u8', '(限VLC兼容播放器)导出m3u8'],
            ['clipboard', '(测)(请自行解决referrer)强制导出剪贴板'],
        ];
    }

    static get optionDefaults() {
        return {
            // 1. automation
            autoDanmaku: false,

            // 2. user interface
            title: true,
            menu: true,

            // 3. download
            aria2: false,
            aria2RPC: false,
            m3u8: false,
            clipboard: false,
        }
    }
}

export default UI;
