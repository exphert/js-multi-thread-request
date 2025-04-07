# How to use?
```js
// make the object
const task = new RequestWorker(task_id,task_url,task_name,executeOnUpdate);

// start the worker
task.start();

// stop the worker
task.stop();

// list all current running task
RequestWorker.listRunningTasks();

// stop specific running task
RequestWorker.stopTask(task_id,task_url,task_name);

// stop all running task
RequestWorker.stopAll();
```
