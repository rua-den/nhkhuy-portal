'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const SOURCE_KEY = 'config/services.json:v1';
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object' || !Array.isArray(registry.services)) {
    throw new Error('Legacy registry must contain a services array.');
  }

  const ids = new Set();
  for (const service of registry.services) {
    if (!service || typeof service !== 'object' ||
        typeof service.id !== 'string' || !ID_PATTERN.test(service.id) ||
        typeof service.name !== 'string' || !service.name.trim() ||
        typeof service.url !== 'string' || !/^https:\/\//.test(service.url)) {
      throw new Error('Legacy registry contains an invalid service record.');
    }
    if (ids.has(service.id)) throw new Error('Legacy registry contains duplicate service IDs.');
    ids.add(service.id);
  }
  return registry.services;
}

function importLegacyServices(database, filename) {
  const raw = fs.readFileSync(filename, 'utf8');
  const services = validateRegistry(JSON.parse(raw));
  const checksum = crypto.createHash('sha256').update(raw).digest('hex');
  const previous = database.prepare(
    'SELECT sha256, row_count FROM legacy_imports WHERE source_key = ?'
  ).get(SOURCE_KEY);

  if (previous) {
    return {
      imported: false,
      reason: previous.sha256 === checksum ? 'already-imported' : 'source-changed-after-import',
      rowCount: previous.row_count
    };
  }

  const insertService = database.prepare(`
    INSERT OR IGNORE INTO services (
      id, name, description, url, category, icon, enabled, managed_proxy,
      upstream, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const service of services) {
      insertService.run(
        service.id,
        service.name.trim(),
        typeof service.description === 'string' ? service.description : '',
        service.url,
        typeof service.category === 'string' ? service.category : 'Apps',
        typeof service.icon === 'string' ? service.icon : 'app-window',
        service.enabled === false ? 0 : 1,
        service.managedProxy === true ? 1 : 0,
        typeof service.upstream === 'string' ? service.upstream : null,
        JSON.stringify(service),
        now,
        now
      );
    }
    database.prepare(
      'INSERT INTO legacy_imports (source_key, sha256, imported_at, row_count) VALUES (?, ?, ?, ?)'
    ).run(SOURCE_KEY, checksum, now, services.length);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return { imported: true, reason: 'first-import', rowCount: services.length };
}

module.exports = { importLegacyServices, validateRegistry };
