/**
 * Worker Manager Module
 * 
 * This module manages web workers for different renderers, keeping track of
 * active workers and providing a consistent interface for worker communication.
 */

// Store all active workers
const workers = new Map();

/**
 * Create a web worker for a specific renderer type
 * @param {string} rendererType - The type of renderer (e.g., 'markdown', 'pdf', 'html')
 * @returns {Worker} - The created worker instance
 */
export function createWorker(rendererType) {
    if (workers.has(rendererType)) {
        return workers.get(rendererType);
    }
    
    // Worker file path based on renderer type
    const workerPath = `/frontend/renderers/workers/${rendererType}-worker.js`;
    
    // Create the worker
    const worker = new Worker(workerPath);
    
    // Store the worker
    workers.set(rendererType, worker);
    
    return worker;
}

/**
 * Create a worker from inline code (blob)
 * @param {string} rendererType - The type of renderer
 * @param {string} workerCode - The worker code as a string
 * @returns {Worker} - The created worker instance
 */
export function createInlineWorker(rendererType, workerCode) {
    if (workers.has(rendererType)) {
        return workers.get(rendererType);
    }
    
    // Create blob from worker code
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    // Create worker
    const worker = new Worker(workerUrl);
    
    // Store the worker
    workers.set(rendererType, worker);
    
    return worker;
}

/**
 * Execute a task in a worker
 * @param {string} rendererType - The type of renderer
 * @param {Object} data - The data to send to the worker
 * @returns {Promise<any>} - Promise resolving to the worker's response
 */
export function executeWorkerTask(rendererType, data) {
    return new Promise((resolve, reject) => {
        // Get or create the worker
        const worker = workers.get(rendererType) || createWorker(rendererType);
        
        // Generate a unique ID for this task
        const taskId = Math.random().toString(36).substring(2, 15);
        
        // Handle worker response
        const handler = (e) => {
            if (e.data.id === taskId) {
                worker.removeEventListener('message', handler);
                if (e.data.error) {
                    reject(new Error(e.data.error));
                } else {
                    resolve(e.data.result);
                }
            }
        };
        
        worker.addEventListener('message', handler);
        
        // Send the data to the worker
        worker.postMessage({
            id: taskId,
            ...data
        });
    });
}

/**
 * Terminate a specific worker
 * @param {string} rendererType - The type of renderer whose worker should be terminated
 */
export function terminateWorker(rendererType) {
    if (workers.has(rendererType)) {
        const worker = workers.get(rendererType);
        worker.terminate();
        workers.delete(rendererType);
    }
}

/**
 * Terminate all active workers
 */
export function terminateAllWorkers() {
    for (const [rendererType, worker] of workers.entries()) {
        worker.terminate();
        workers.delete(rendererType);
    }
}

export default {
    createWorker,
    createInlineWorker,
    executeWorkerTask,
    terminateWorker,
    terminateAllWorkers
}; 