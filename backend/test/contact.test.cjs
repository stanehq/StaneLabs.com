require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { ConfigService } = require('@nestjs/config');
const nodemailer = require('nodemailer');
const { ContactDto } = require('../dist/contact.dto.js');
const { ContactService } = require('../dist/contact.service.js');
const { validateEnvironment } = require('../dist/config.js');

const valid = { name: 'Contacto de prueba', email: 'test@example.com', topic: 'Consulta inicial', message: 'Solicitud general sin datos sensibles.', website: '' };
const configured = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: 587, SMTP_SECURE: false, SMTP_USER: 'test', SMTP_PASS: 'test-only', SMTP_FROM: 'sender@example.com', SECURITY_EMAIL: 'security@stanelabs.com' };

test('rejects an invalid email, header injection, unexpected fields and oversized message', async () => {
  for (const data of [{ ...valid, email: 'invalid' }, { ...valid, name: 'nombre\r\nBcc: outsider@example.com' }, { ...valid, extra: 'not allowed' }, { ...valid, message: 'a'.repeat(2001) }]) {
    const errors = await validate(plainToInstance(ContactDto, data), { whitelist: true, forbidNonWhitelisted: true });
    assert(errors.length > 0);
  }
  assert.equal((await validate(plainToInstance(ContactDto, valid))).length, 0);
});

test('requires an exact CORS origin and rejects an injected sender', () => {
  assert.throws(() => validateEnvironment({ FRONTEND_ORIGIN: 'https://stanelabs.com/path' }));
  assert.throws(() => validateEnvironment({ SMTP_FROM: 'sender@example.com\r\nBcc:x@example.com' }));
  assert.equal(validateEnvironment({}).SECURITY_EMAIL, 'security@stanelabs.com');
});

test('does not report success when SMTP is unconfigured, rejected or unavailable', async () => {
  const unconfigured = new ContactService(new ConfigService({}));
  assert.equal(unconfigured.configured(), false);
  await assert.rejects(unconfigured.send(valid), (error) => error.getStatus() === 503);
  const original = nodemailer.createTransport;
  try {
    nodemailer.createTransport = () => ({ sendMail: async () => ({ accepted: [], rejected: ['security@stanelabs.com'] }) });
    const rejected = new ContactService(new ConfigService(configured));
    await assert.rejects(rejected.send(valid), (error) => error.getStatus() === 503);
    nodemailer.createTransport = () => ({ sendMail: async () => { throw new Error('test-only failure'); } });
    const failed = new ContactService(new ConfigService(configured));
    await assert.rejects(failed.send(valid), (error) => error.getStatus() === 503);
    nodemailer.createTransport = () => ({ sendMail: async (mail) => {
      assert.equal(mail.to, 'security@stanelabs.com');
      assert.equal(mail.replyTo, valid.email);
      return { accepted: ['security@stanelabs.com'] };
    } });
    assert.deepEqual(await new ContactService(new ConfigService(configured)).send(valid), { status: 'sent' });
  } finally { nodemailer.createTransport = original; }
});
