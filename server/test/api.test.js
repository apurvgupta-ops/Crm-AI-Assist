const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

describe('CRM AI API Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/crm-ai-test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and close database connection
    await mongoose.connection.close();
  });

  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Server is healthy');
    });
  });

  describe('Query Routes', () => {
    test('GET /api/v1/query/suggestions should return suggestions', async () => {
      const response = await request(app)
        .get('/api/v1/query/suggestions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('GET /api/v1/query/schema should return schema information', async () => {
      const response = await request(app)
        .get('/api/v1/query/schema')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toBeDefined();
    });

    test('POST /api/v1/query/natural-language should require query parameter', async () => {
      const response = await request(app)
        .post('/api/v1/query/natural-language')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    // Note: This test requires OpenAI API key to work
    test.skip('POST /api/v1/query/natural-language should process valid query', async () => {
      const response = await request(app)
        .post('/api/v1/query/natural-language')
        .send({
          query: 'Show me all cold leads',
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
    });
  });

  describe('Lead Routes', () => {
    test('GET /api/v1/leads should return paginated leads', async () => {
      const response = await request(app)
        .get('/api/v1/leads')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leads).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    test('POST /api/v1/leads should create a new lead', async () => {
      const leadData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        temperature: 'cold',
        status: 'new'
      };

      const response = await request(app)
        .post('/api/v1/leads')
        .send(leadData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lead.email).toBe(leadData.email);
    });

    test('POST /api/v1/leads should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/leads')
        .send({
          firstName: 'Test'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Analytics Routes', () => {
    test('GET /api/v1/leads/analytics/summary should return analytics', async () => {
      const response = await request(app)
        .get('/api/v1/leads/analytics/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    });
  });
});
