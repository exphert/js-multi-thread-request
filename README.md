# How to use?
```js
// make the object
const task = new RequestWorker(task_id,task_url,task_name,executeOnUpdate);

//to start the worker
task.start();

//to stop the worker
task.stop();

//to list all current running task
RequestWorker.listRunningTasks();

//to stop specific running task
RequestWorker.stopTask(task_id,task_url,task_name);
```
