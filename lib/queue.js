'use strict';

class Queue {

    get length() {
        return this.queue.length
    }

    /**
     * @param {Array} queue
     */
    constructor(queue) {
        this.queue = queue || [];
    }

    /**
     * Add to queue
     * @param {Array} item
     */
    push(item) {
        this.queue.push(item);
    }

    /**
     * Fetch init command from queue
     * @returns {Arguments}
     * @throws Error
     */
    getInit() {
        let command = this.findByName('init');
        if (command) {
            return command;
        } else {
            throw new Error('Init command not found in queue');
        }
    }

    /**
     * Fetch command from queue by name
     * @returns {Arguments|undefined}
     */
    findByName(name) {
        for( let i = 0; i < this.queue.length; i++ ) {
            if( this.queue[i][0] === name ) {
                return this.queue.splice(i, 1)[0];
            }
        }
    }


    /**
     * Fetch next command from queue
     * @returns {Arguments|null}
     */
    next() {
        if (this.queue.length > 0) {
            return this.queue.splice(0, 1)[0];
        } else {
            return null;
        }
    }
}

export default Queue;