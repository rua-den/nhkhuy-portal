#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { openDatabase } = require('../db/database');
const { importLegacyServices } = require('../db/import-legacy-services');

const root = path.resolve(__dirname, '../..');
const dataDirectory = path.resolve(process.env.PORTAL_DATA_DIR || path.join(root, 'data'));
const databasePath = path.join(dataDirectory, 'portal.sqlite');
const registryPath = path.resolve(process.argv[2] || path.join(root, 'config/services.json'));

let database;
try {
  database = openDatabase(databasePath);
  const result = importLegacyServices(database, registryPath);
  console.log(JSON.stringify({
    status: 'ok',
    database: databasePath,
    source: registryPath,
    ...result
  }));
} catch (error) {
  console.error('Portal migration failed:', error.message);
  process.exitCode = 1;
} finally {
  if (database) database.close();
}
