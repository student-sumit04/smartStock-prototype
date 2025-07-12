
import request from 'supertest';
import app from '../app.js';

describe('Invoice API', () => {
  it('should reject unauthenticated creation', async () => {
    const res = await request(app)
      .post('/api/v1/invoice')
      .send({});
    expect(res.statusCode).toBe(401);
  });
  // Add more tests for authenticated/authorized cases as needed
});
