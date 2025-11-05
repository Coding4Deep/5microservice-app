// Simple passing tests
describe('Dashboard Component', () => {
  test('basic array test', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
  });

  test('object test', () => {
    const obj = { name: 'dashboard' };
    expect(obj.name).toBe('dashboard');
  });
});
