/*
Create by Exphert
https://github.com/exphert/js-multi-thread-request
*/

class RequestWorker {
    static activeTasks = new Map();
    static queue = [];
    static maxConcurrent = 3;
    static currentRunning = 0;

    constructor(config = {}) {
        if (!config.url) throw new Error("[RequestWorker] 'url' is required");
        if (!config.process)
            throw new Error("[RequestWorker] 'process' is required");
        if (!config.id) throw new Error("[RequestWorker] 'id' is required");

        this.id = config.id === "_UUID_" ? crypto.randomUUID() : config.id;
        this.url = config.url;
        this.process = config.process;
        this.evalOnUpdate = config.evalOnUpdate || null;
        this.evalOnDone = config.evalOnDone || null;
        this.method = config.method || "event";
        this.doneNeedle = config.doneNeedle || "done";
        this.maxRetries = config.maxRetries ?? 3;
        this.retryDelay = config.retryDelay ?? 1000;
        this.fallbackToFetch = config.fallbackToFetch ?? true;
        this.onProgress = config.onProgress || null;
        this.queue = config.queue ?? false;
        this.showLogs = config.showLogs ?? false;

        this.retryCount = 0;
        this.controller = null;
        this.eventSource = null;
        this.taskKey = `${this.id}-${this.url}-${this.process}`;
        this.receivedData = false; // 👈 track if we received any data
    }

    start() {
        if (RequestWorker.activeTasks.has(this.taskKey)) {
            if (this.showLogs) console.warn(`[${this.taskKey}] Task already active.`);
            return;
        }

        if (RequestWorker.currentRunning >= RequestWorker.maxConcurrent) {
            if (this.showLogs) console.log(`[${this.taskKey}] Queued.`);
            RequestWorker.queue.push(this);
            return;
        }

        RequestWorker.currentRunning++;
        RequestWorker.activeTasks.set(this.taskKey, this);

        this.controller = new AbortController();

        if (this.method === "fetch") {
            this._startFetch();
        } else {
            this._startEventStream();
        }
    }

    _retry() {
        if (this.retryCount < this.maxRetries) {
            const delay = this.retryDelay * (this.retryCount + 1);
            this.retryCount++;
            if (this.showLogs) console.warn(
                `[${this.taskKey}] Retry #${this.retryCount} in ${delay}ms`
            );
            setTimeout(() => {
                this.start();
            }, delay);
        } else {
            if (this.showLogs) console.error(`[${this.taskKey}] Max retries reached.`);
            this.stop();
        }
    }

    _completeIfMatch(data) {
        if (typeof data === "string" && data.trim() === this.doneNeedle) {
            this._callDone(data);
        } else if (typeof this.evalOnUpdate === "function") {
            this.evalOnUpdate(data);
        } else if (
            typeof this.evalOnUpdate !== "function" &&
            this.evalOnUpdate !== null
        ) {
            if (this.showLogs) console.warn(`[${this.id}] evalOnUpdate is not a valid function`);
        }
    }

    _callDone(data) {
        this.stop();
        if (typeof this.evalOnDone === "function") {
            this.evalOnDone(data);
        } else {
            if (this.showLogs) console.warn(`[${this.id}] evalOnDone is not a valid function`);
        }
    }

    _startEventStream() {
        try {
            this.eventSource = new EventSource(this.url);

            this.eventSource.onopen = () => {
                if (this.showLogs) console.log(`[${this.taskKey}] EventStream connected.`);
            };

            this.eventSource.onmessage = (event) => {
                let data = event.data;
                try {
                    data = JSON.parse(event.data);
                } catch (_) {}

                this.receivedData = true;

                if (this.onProgress) this.onProgress(data);
                this._completeIfMatch(data);
            };

            this.eventSource.onerror = (err) => {
                if (this.showLogs) console.warn(
                    `[${this.taskKey}] EventStream error or closed`,
                    err
                );

                // ✅ graceful "done" if we received something before
                if (this.receivedData) {
                    if (this.showLogs) console.log(
                        `[${this.taskKey}] Stream closed after data. Treating as DONE.`
                    );
                    this._callDone(data ?? "stream-closed");
                } else if (this.fallbackToFetch) {
                    if (this.showLogs) console.warn(`[${this.taskKey}] Falling back to fetch`);
                    this.method = "fetch";
                    this.start();
                } else {
                    this._retry();
                }
            };
        } catch (e) {
            if (this.showLogs) console.error(`[${this.taskKey}] Failed to init EventStream`, e);
            this._retry();
        }
    }

    async _startFetch() {
        try {
            const res = await fetch(this.url, {
                method: "GET",
                headers: { Accept: "application/json" },
                signal: this.controller.signal,
            });

            let data;
            try {
                data = await res.clone().json();
            } catch (_) {
                data = await res.text();
            }

            if (this.onProgress) this.onProgress(data);
            this._completeIfMatch(data);

            // ✅ even if no needle matched, fetch is done
            if (typeof data !== "string" || data.trim() !== this.doneNeedle) {
                this._callDone(data ?? "fetch-closed");
            }
        } catch (err) {
            if (err.name === "AbortError") {
                if (this.showLogs) console.log(`[${this.taskKey}] Fetch aborted.`);
            } else {
                if (this.showLogs) console.error(`[${this.taskKey}] Fetch error:`, err);
                this._retry();
            }
        }
    }

    stop() {
        if (this.controller) this.controller.abort();
        if (this.eventSource) this.eventSource.close();

        RequestWorker.activeTasks.delete(this.taskKey);
        RequestWorker.currentRunning = Math.max(
            0,
            RequestWorker.currentRunning - 1
        );
        if (this.showLogs) console.log(`[${this.taskKey}] Stopped.`);

        this._runNextInQueue();
    }

    _runNextInQueue() {
        if (
            RequestWorker.queue.length > 0 &&
            RequestWorker.currentRunning < RequestWorker.maxConcurrent
        ) {
            const nextTask = RequestWorker.queue.shift();
            nextTask.start();
        }
    }

    static stopTask(id, url, process) {
        const key = `${id}-${url}-${process}`;
        const task = RequestWorker.activeTasks.get(key);
        if (task) task.stop();
    }

    static stopAll() {
        for (let task of RequestWorker.activeTasks.values()) task.stop();
        RequestWorker.queue = [];
    }

    static listRunningTasks() {
        return Array.from(RequestWorker.activeTasks.keys());
    }
}
