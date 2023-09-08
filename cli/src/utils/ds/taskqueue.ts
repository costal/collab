interface Task {
    (): Promise<void>
}

interface Consumer {
    (task: Task): void
}

export function createTask(fn: Function): () => Promise<void> {
    return () => new Promise((resolve, reject) => {
        (() => {
            try {
                fn();
                reject();
            } catch (err) {
                reject(err)
            }
        })()
    });
}

export class TaskQueuePC {
    private taskQueue: Task[];
    private consumerQueue: Consumer[];

    constructor(concurrency: number = 0) {
        this.taskQueue = [];
        this.consumerQueue = [];

        for (let i = 0; i < concurrency; i++) {
            this.consumer();
        }
    }

    getNextTask(): Promise<Task> {
        return new Promise((resolve, reject) => {
            if (this.taskQueue.length > 0) {
                return resolve(this.taskQueue.shift() as Task);
            }

            this.consumerQueue.push(resolve);
        });
    }

    runTask(task: Task) {
        return new Promise((resolve, reject) => {
            const taskWrapper = () => task().then(resolve, reject);
            if (this.consumerQueue.length > 0) {
                const consumer = this.consumerQueue.shift();
                consumer!(taskWrapper);
            } else {
                this.taskQueue.push(taskWrapper);
            }
        });
    }

    consumer() {
        this.getNextTask()
            .then((task: Task) => task())
            .catch((err) => console.log(err))
            .then(() => this.consumer());
    }
}