# Player measurements

Chrome's network throttling does not reach Web Workers, so these scripts use
a local server that mimics production instead: `Cache-Control: no-cache` +
ETag (304), one shared bandwidth bucket and a fixed latency.

    node sim-server.mjs ../.. 8790 2 50          # root, port, MB/s, ms
    node play.mjs http://127.0.0.1:8790/index.html monthly 30 4
    node dl.mjs   http://127.0.0.1:8790/index.html monthly 4

`play.mjs` plays the same stretch three times (first visit, again in the same
page, after a reload) and prints frames advanced, time spent loading and
where each file came from (`window.__oe.store.net`). `dl.mjs` plays without
downloading, presses "download", then plays the whole series. Both need
`puppeteer-core` (installed outside the repo).
