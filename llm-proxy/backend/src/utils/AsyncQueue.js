class AsyncQueue {
    constructor() {
        this.items = [];
        this.waiting = [];
    }

    enqueue(item) {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve(item);
        } else {
            this.items.push(item);
        }
    }

    dequeue() {
        if (this.items.length > 0) {
            return Promise.resolve(this.items.shift());
        } else {
            return new Promise((resolve) => {
                this.waiting.push(resolve);
            });
        }
    }

    isEmpty() {
        return this.items.length === 0;
    }

    clear() {
        const remainingItems = [...this.items];
        this.items = [];
        return remainingItems;
    }
}

module.exports = AsyncQueue;
