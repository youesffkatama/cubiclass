const request = require('supertest');
const { app, server, io } = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    server.close();
    io.close();
});

describe('Auth Routes', () => {
    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'testuser',
                email: 'testuser@example.com',
                password: 'password123',
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body.data.user).toHaveProperty('username', 'testuser');
    });

    it('should not register a user with an existing email', async () => {
        await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'testuser2',
                email: 'testuser2@example.com',
                password: 'password123',
            });

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'testuser3',
                email: 'testuser2@example.com',
                password: 'password123',
            });
        expect(res.statusCode).toEqual(400);
    });

    it('should login an existing user', async () => {
        await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'loginuser',
                email: 'loginuser@example.com',
                password: 'password123',
            });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'loginuser@example.com',
                password: 'password123',
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('tokens');
    });

    it('should not login with incorrect password', async () => {
        await request(app)
            .post('/api/v1/auth/register')
            .send({
                username: 'loginuser2',
                email: 'loginuser2@example.com',
                password: 'password123',
            });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'loginuser2@example.com',
                password: 'wrongpassword',
            });
        expect(res.statusCode).toEqual(401);
    });
});
