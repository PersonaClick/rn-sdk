'use strict';

class pushData {
    /**
     * @param {Array} queue
     */
    constructor(data) {
        this.data = data || [];
    }
    /**
     * Add payload
     * @param {Array} item
     */
    push(item) {
        if ( this.data.length > 0 && this.data.findIndex( x => x.messageId === item.messageId) > -1 ) {
            let payloadId = this.data.findIndex( x => x.messageId === item.messageId) ;
            this.data[payloadId] = Object.assign( this.data.find( x => x.messageId === item.messageId), item );
        } else {
            this.data.push(item);
        }
    }
    /**
     * Get payload
     * @param {String} messageId
     */
    get(messageId) {
        return this.data.find( x => x.messageId === messageId)
    }
}

export default pushData;
