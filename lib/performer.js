'use strict';

import Queue from './queue';
/**
 * Абстрактный класс для обработки поступающий комманд
 */
class Performer {

    /**
     * @param {Array} queue
     * @param {Logger} logger
     */
    constructor(queue) {
        this.queue = new Queue(queue);
        this.initialized = false;
    }

    /**
     * Perform command or add to queue
     * @param {Arguments|Array} command
     */
    push(command) {
        if( this.initialized) {
            this.perform(command)
        } else {
            this.queue.push(command)
        }
    }

    /**
     * Abstract
     */
    perform() {
        throw new Error(`This 'perform' is abstract method, please define in class ${this.constructor.name}`)
    }

    /**
     * Each queue and perform commands.
     */
    performQueue() {
        console.log('Each queue', this);

        // If any commands in queue
        if(this.queue.length > 0) {

            console.log(`Found ${this.queue.length} tasks in queue`, this);

            // Cycle all commands
            let command;
            while ((command = this.queue.next()) !== null) {
                this.perform(command)
            }
        }
    }
}

export default Performer;
