/**
 * @typedef {Object} SearchOptions
 * @property {string} type - Search type.
 * @property {string} search_query - Search query.
 * @property {number} [limit] - Limit of results.
 * @property {number} [offset] - Offset of results.
 * @property {number} [category_limit] - How many categories for sidebar filter to return.
 * @property {string} [categories] - Comma separated list of categories to filter.
 * @property {boolean} [extended] - Full search results flag.
 * @property {string} [sort_by] - Sort by parameter: popular, price, discount, sales_rate, date.
 * @property {string} [order="desc"] - Sort direction: asc or desc (default).
 * @property {string} [locations] - Comma separated list of locations IDs.
 * @property {string} [brands] - Comma separated list of brands to filter.
 * @property {string} [filters] - Optional escaped JSON string with filter parameters.
 * @property {number} [price_min] - Min price.
 * @property {number} [price_max] - Max price.
 * @property {string} [colors] - Comma separated list of colors.
 * @property {string} [fashion_sizes] - Comma separated list of sizes.
 * @property {string} [exclude] - Comma separated list of products IDs to exclude from search results.
 * @property {string} [email] - Email.
 * @property {string} [merchants] - Comma separated list of merchants.
 * @property {string} [filters_search_by] - Available options for filter: name, quantity, popularity.
 * @property {number} [brand_limit=1000] - Limits the number of brands in the response.
 */

/**
 * @typedef {Object} SearchResponse
 * @property {Array} brands - Array of brands.
 * @property {Array} categories - Array of categories.
 * @property {Array} filters - Array of filters.
 * @property {Array} industrial_filters - Array of industrial filters.
 * @property {string} html - HTML code of the block with products.
 * @property {Object} price_range - Min and max price of products.
 * @property {Array} products - Array of products.
 * @property {number} products_total - Total count of products.
 * @property {string} search_query - Search query.
 * @property {Array} book_authors - Reserved.
 * @property {Array} keywords - Reserved.
 * @property {Array} queries - Reserved.
 * @property {Array} virtual_categories - Reserved.
 */
