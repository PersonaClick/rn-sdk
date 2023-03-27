'use strict';


/**
 * @param {string} event
 * @param {{}} data
 */
export async function convertParams(event, data) {

	// Don't work without data
	if( !data ) {
		throw new Error('Track: empty data for track event');
	}

	// Put event to data variable
	let queryParams = {
		event: event,
		items: []
	};

	/**
	 * @param {object} data
	 * @param {int} i
	 */
	function buildParams(data, i = 0) {

		if( typeof (data) === 'object' ) {
			if( !data.id ) {
				throw new Error(`Track: Item ID not set`);
			}
			let item = { id: data.id };
			if (data.price) {
				item['price'] = data.price
			}
			if (data.quantity) {
				item['quantity'] = data.quantity
			}
			if (data.amount) {
				item['quantity'] = data.amount
			}
			queryParams.items.push(item);
		} else {
			if( typeof (data) === 'string' || typeof (data) === 'number' ) {
				queryParams.items.push({id: data});
			} else {
				throw new Error(`Track: Incorrect syntax of the product argument: ${data}. Number, string or extended object supported only. Check manual.`);
			}
		}
	}


	switch(event) {

		// Track view
		case 'view':
			buildParams(data);

			if( data.recommended_by ) {
				queryParams['recommended_by'] = data.recommended_by;
			}
			if( data.recommended_code ) {
				queryParams['recommended_code'] = data.recommended_code;
			}
			break;

		case 'category':
			queryParams['category_id'] = data;
			break;

		case 'wish':
		case 'remove_wish':
			buildParams(data);
			break;

		// Track cart
		case 'cart':

			if( data instanceof Array ) {

				data.forEach((product, index) => {
					if( product.id ) {
						buildParams(product, index)
					} else {
						throw new Error(`Tracking: product ID is not defined: ${JSON.stringify(product)}.`);
					}
				});
				queryParams['full_cart'] = true;

			} else {
				if( data.recommended_by ) {
					queryParams[`recommended_by`] = data.recommended_by
				}
				if( data.recommended_code ) {
					queryParams['recommended_code'] = data.recommended_code;
				}
				buildParams(data)
			}

			break;

		// Track remove from cart
		case 'remove_from_cart':

			if( typeof (data) === 'string' || typeof (data) === 'number' ) {
				queryParams.items.push({id: data});
			} else {
				throw new Error(`Track: Incorrect syntax of the product argument: ${data}. Number or string with product ID supported only for 'remove_from_cart' event. Check manual.`);
			}
			break;

		// Purchase
		case 'purchase':

			//Сегмент для трекинга заказа тестирования подсказок казахами
			if( data.search_segment ) {
				queryParams['segment_ab'] = data.search_segment
			}

			if( data.order ) {
				queryParams['order_id'] = data.order
			}

			for( let i of ['order_price', 'order_cash', 'order_bonuses', 'order_delivery', 'order_discount', 'promocode', 'delivery_type', 'payment_type', 'tax_free', 'delivery_address'] ) {
				if( data[i] ) {
					queryParams[i] = data[i]
				}
			}

			if( !data.products || data.products.length === 0 ) {
				throw new Error(`Track: product list for purchase tracking is empty`);
			}

			data.products.forEach((product, index) => {
				if( product.id ) {
					buildParams(product, index)
				} else {
					throw new Error(`Tracking: product ID is not defined: ${JSON.stringify(product)}.`);
				}
			});

			break;

		case 'recone_click':
		case 'recone_view':
			queryParams['campaign'] = data.id;
			queryParams['inventory'] = data.inventory;
			queryParams['position'] = data.position;
			if( data.recommended_by ) {
				queryParams['recommended_by'] = data.recommended_by
			}
			break;
		// Search
		case 'search':
			if( typeof data == 'string' ) {
				queryParams['search_query'] = data;
			} else {
				queryParams['search_query'] = data.query;
				if( data.results != null ) {
					queryParams['results'] = data.results.join(',')
				}
			}
			break;

		// Unknown event
		default:
			throw new Error(`Track: Undefined event ${event}`);
	}

	if (queryParams.items.length === 0) {
		delete queryParams.items;
	}
	return queryParams;
}
