#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-sqlite-check-'));
let database;
try {
  database = new DatabaseSync(path.join(directory, 'runtime-check.sqlite'));
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  database.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY, label TEXT NOT NULL UNIQUE); CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id), value TEXT NOT NULL);');
  const insertParent = database.prepare('INSERT INTO parent (label) VALUES (?)');
  const insertChild = database.prepare('INSERT INTO child (parent_id, value) VALUES (?, ?)');
  const findValue = database.prepare('SELECT child.value AS value FROM child INNER JOIN parent ON parent.id = child.parent_id WHERE parent.label = ?');
  database.exec('BEGIN IMMEDIATE');
  const parent = insertParent.run('portal-runtime');
  insertChild.run(Number(parent.lastInsertRowid), 'sqlite-ready');
  database.exec('COMMIT');
  assert.equal(findValue.get('portal-runtime').value, 'sqlite-ready');
  assert.throws(() => database.prepare('INSERT INTO child (parent_id, value) VALUES (?, ?)').run(999999, 'invalid'), /FOREIGN KEY/);
  console.log(JSON.stringify({status:'ok',node:process.version,arch:process.arch,sqlite:process.versions.sqlite || 'bundled',journalMode:database.prepare('PRAGMA journal_mode').get().journal_mode,transactions:'ok',foreignKeys:'ok'}));
} finally {
  if (database) database.close();
  fs.rmSync(directory, {recursive:true,force:true});
}
