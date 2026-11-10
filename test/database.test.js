'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { openDatabase } = require('../src/db/database');
const { importLegacyServices } = require('../src/db/import-legacy-services');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-db-test-'));
  return {
    directory,
    databasePath: path.join(directory, 'portal.sqlite'),
    registryPath: path.join(directory, 'services.json'),
    cleanup() { fs.rmSync(directory, { recursive: true, force: true }); }
  };
}

test('migrations are applied once and survive reopening', () => {
  const f = fixture();
  try {
    let db = openDatabase(f.databasePath);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 1);
    db.close();
    db = openDatabase(f.databasePath);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 1);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get());
    db.close();
  } finally {
    f.cleanup();
  }
});

test('legacy service import preserves metadata and is idempotent', () => {
  const f = fixture();
  let db;
  try {
    const registry = {
      services: [{
        id: 'demo', name: 'Demo', url: 'https://demo.example.test',
        description: 'A test service', category: 'Tools', icon: 'wrench',
        enabled: true, managedProxy: false, customField: { keep: true }
      }]
    };
    fs.writeFileSync(f.registryPath, JSON.stringify(registry));
    db = openDatabase(f.databasePath);

    assert.deepEqual(importLegacyServices(db, f.registryPath), {
      imported: true, reason: 'first-import', rowCount: 1
    });
    const stored = db.prepare('SELECT * FROM services WHERE id = ?').get('demo');
    assert.equal(stored.name, 'Demo');
    assert.equal(stored.enabled, 1);
    assert.deepEqual(JSON.parse(stored.metadata_json).customField, { keep: true });

    assert.equal(importLegacyServices(db, f.registryPath).reason, 'already-imported');
    fs.writeFileSync(f.registryPath, JSON.stringify({ services: [{ ...registry.services[0], name: 'Changed' }] }));
    assert.equal(importLegacyServices(db, f.registryPath).reason, 'source-changed-after-import');
    assert.equal(db.prepare('SELECT name FROM services WHERE id = ?').get('demo').name, 'Demo');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM services').get().count, 1);
  } finally {
    if (db) db.close();
    f.cleanup();
  }
});

test('invalid registry is rejected without recording a partial import', () => {
  const f = fixture();
  let db;
  try {
    fs.writeFileSync(f.registryPath, JSON.stringify({
      services: [
        { id: 'valid', name: 'Valid', url: 'https://valid.example.test' },
        { id: 'bad id', name: 'Invalid', url: 'https://invalid.example.test' }
      ]
    }));
    db = openDatabase(f.databasePath);
    assert.throws(() => importLegacyServices(db, f.registryPath), /invalid service record/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM services').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM legacy_imports').get().count, 0);
  } finally {
    if (db) db.close();
    f.cleanup();
  }
});
