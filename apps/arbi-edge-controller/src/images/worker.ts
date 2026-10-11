import { parentPort,workerData } from 'node:worker_threads';
import { processImage } from './pipeline.js';
if(parentPort)parentPort.postMessage(processImage(workerData));
