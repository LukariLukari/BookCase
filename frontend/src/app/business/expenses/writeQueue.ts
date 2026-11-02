// Bound network concurrency without blocking the next input or flooding the server.
export class WriteQueue {
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly concurrency = 2) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push(() => {
        this.active++;
        Promise.resolve().then(work).then(resolve, reject).finally(() => {
          this.active--;
          this.drain();
        });
      });
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.waiting.length) this.waiting.shift()!();
  }
}
