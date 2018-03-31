/***
 * Copyright (C) 2018 Qli5. All Rights Reserved.
 * 
 * @author qli5 <goodlq11[at](163|gmail).com>
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class Exporter {
    static exportIDM(urls, referrer = top.location.origin) {
        return urls.map(url => `<\r\n${url}\r\nreferer: ${referrer}\r\n>\r\n`).join('');
    }

    static exportM3U8(urls, referrer = top.location.origin, userAgent = top.navigator.userAgent) {
        return '#EXTM3U\n' + urls.map(url => `#EXTVLCOPT:http-referrer=${referrer}\n#EXTVLCOPT:http-user-agent=${userAgent}\n#EXTINF:-1\n${url}\n`).join('');
    }

    static exportAria2(urls, referrer = top.location.origin) {
        return urls.map(url => `${url}\r\n  referer=${referrer}\r\n`).join('');
    }

    static async sendToAria2RPC(urls, referrer = top.location.origin, target = 'http://127.0.0.1:6800/jsonrpc') {
        // 1. prepare body
        const h = 'referer';
        const body = JSON.stringify(urls.map((url, id) => ({
            id,
            jsonrpc: 2,
            method: "aria2.addUri",
            params: [
                [url],
                { [h]: referrer }
            ]
        })));

        // 2. send to jsonrpc target
        const method = 'POST';
        while (1) {
            try {
                return fetch(target, { method, body }).then(e => e.json());
            }
            catch (e) {
                target = top.prompt('Aria2 connection failed. Please provide a valid server address:', target);
                if (!target) return null;
            }
        }
    }

    static copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = text;
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

export default Exporter;
