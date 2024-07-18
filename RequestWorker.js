class RequestWorker {
  static activeTasks = new Map(); // Use a Map to track active tasks with keys as unique identifiers

  constructor(id, url, process, evalOnUpdate = null) {
    this.id = id;
    this.url = url;
    this.process = process;
    this.evalOnUpdate = evalOnUpdate;
    this.eventSource = null;
    this.controller = null;
    this.taskKey = `${id}-${url}-${process}`; // Unique key for the task
  }

  start() {
    // Check if the task is already in the list of active tasks
    if (RequestWorker.activeTasks.has(this.taskKey)) {
      console.warn(
        `Connection for ID ${this.id}, URL ${this.url}, and Process ${this.process} already exists.`
      );
      return; // Exit if the task is already in use
    }

    // Add task to the list of active tasks
    RequestWorker.activeTasks.set(this.taskKey, this);

    if (this.controller) {
      this.controller.abort();
    }

    this.controller = new AbortController();
    const signal = this.controller.signal;

    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(`Task Key : ${this.taskKey}\nValue : ${data}`);
      const updateFunction = new Function("data", this.evalOnUpdate);
      updateFunction(data); // Pass `data` as a parameter
    };

    this.eventSource.onerror = (err) => {
      console.error(`Error occurred: ${err}`);
      this.stop(); // Call stop to clean up
    };

    signal.addEventListener("abort", () => {
      this.stop(); // Ensure `stop` cleans up
      console.log("Request aborted");
    });
  }

  stop() {
    const taskKey = this.taskKey;
    if (this.controller) {
      this.controller.abort();
      this.controller = null; // Clean up the controller reference
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null; // Clean up the EventSource reference
    }

    // Remove the task from the list of active tasks
    RequestWorker.activeTasks.delete(taskKey);
  }

  // Static method to stop a specific task by id, url, and process
  static stopTask(id, url, process) {
    const taskKey = `${id}-${url}-${process}`;
    const task = RequestWorker.activeTasks.get(taskKey);
    if (task) {
      task.stop(); // Stop and clean up the task
      console.log(
        `Task with ID ${id}, URL ${url}, and Process ${process} stopped.`
      );
    } else {
      console.warn(
        `Task with ID ${id}, URL ${url}, and Process ${process} not found.`
      );
    }
  }

  // Static method to list all running tasks
  static listRunningTasks() {
    return Array.from(RequestWorker.activeTasks.keys());
  }
}
