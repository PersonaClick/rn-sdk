import { convertParams } from '../tracker.js';

describe('Track', () => {
  const initialEventData = {
    email: "john.doe@examplemail.com",
    phone: "4400114527199",
    products: [
      { id: 37, price: 318, quantity: 1 }
    ],
    order: 'N318',
    order_price: 29999
  };
  describe('Purchase', () => {
    test('adds "custom" to the request if a non-empty object is passed', async () => {
      const customProperties = {
        date_start: '2024-03-01',
        date_finish: '2024-03-11',
        duration: 11,
        route: 'NewYork - Madrid - Istanbul',
        route_start: 'NewYork',
        route_finish: 'Istanbul',
        tour_class: 'Luxury',
        adults_count: 2,
        children_count: 1,
        infants_count: 1,
        deck: 'lower1',
        rooms: '334,335'
      };

      const result = await convertParams('purchase', {...initialEventData, custom: customProperties});

      expect(result).toHaveProperty('custom');
      expect(result.custom).toEqual(customProperties);
      expect(result).toHaveProperty('order_id', initialEventData.order);
      expect(result).toHaveProperty('order_price', initialEventData.order_price);
      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: initialEventData.products[0].id })]));
    });
    test('does not add "custom" to the request if it is not passed', async () => {
      const result = await convertParams('purchase', initialEventData);

      expect(result).not.toHaveProperty('custom');
      expect(result).toHaveProperty('order_id', initialEventData.order);
      expect(result).toHaveProperty('order_price', initialEventData.order_price);
      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: initialEventData.products[0].id })]));
    });
    test('does not add "custom" to the request if an invalid value is passed', async () => {
      const customProperties = [
        {
          date_start: '2024-03-01',
        },
        {
          date_finish: '2024-03-11',
        },
      ];

      const result = await convertParams('purchase', {...initialEventData, custom: customProperties});

      expect(result).not.toHaveProperty('custom');
      expect(result).toHaveProperty('order_id', initialEventData.order);
      expect(result).toHaveProperty('order_price', initialEventData.order_price);
      expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: initialEventData.products[0].id })]));
    });
  })

  describe('Wish', () => {
    const itemsIds = [111, 222];

    test('adds the parameter full_wish only if an array is passed', async () => {
      let result = await convertParams('wish', []);
      expect(result).toHaveProperty('full_wish', true);

      result = await convertParams('wish', itemsIds);
      expect(result).toHaveProperty('full_wish', true);

      result = await convertParams('wish', 111);
      expect(result).not.toHaveProperty('full_wish');
    });
    test('adds items if a non-empty array is passed', async () => {
      let result = await convertParams('wish', itemsIds);
      expect(result).toHaveProperty('full_wish', true);
      expect(result.items.length).toBe(2);
      itemsIds.forEach(id => {
        expect(result.items).toEqual(expect.arrayContaining([{ id }]));
      });

      result = await convertParams('wish', []);
      expect(result).toHaveProperty('full_wish', true);
      expect(result).not.toHaveProperty('items');
    });
    test('adds one object to items if a string or number is passed', async () => {
      const stringId = '111';
      const numberId = 111;

      let result = await convertParams('wish', stringId);
      expect(result).not.toHaveProperty('full_wish');
      expect(result.items.length).toBe(1);
      expect(result.items).toEqual([{ id: stringId }]);

      result = await convertParams('wish', numberId);
      expect(result).not.toHaveProperty('full_wish');
      expect(result.items.length).toBe(1);
      expect(result.items).toEqual([{ id: numberId }]);
    });
  });
});
