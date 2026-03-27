#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function isWithinRoot(absolutePath) {
  const resolved = path.resolve(absolutePath);
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep);
}

const PATHS = {
  canonicalRoot: path.join(ROOT, '.ai'),
  canonicalRules: path.join(ROOT, '.ai', 'rules'),
  canonicalSkills: path.join(ROOT, '.ai', 'capabilities', 'skills'),
  canonicalAgents: path.join(ROOT, '.ai', 'capabilities', 'agents'),
  canonicalSchemas: path.join(ROOT, '.ai', 'schemas'),
  cursorRules: path.join(ROOT, '.cursor', 'rules'),
  cursorSkills: path.join(ROOT, '.cursor', 'skills'),
  cursorAgents: path.join(ROOT, '.cursor', 'agents'),
  claudeSkills: path.join(ROOT, '.claude', 'skills'),
  claudeAgents: path.join(ROOT, '.claude', 'agents'),
  claudeSettings: path.join(ROOT, '.claude', 'settings.json'),
  codexSkills: path.join(ROOT, '.agents', 'skills'),
  parityMatrix: path.join(ROOT, '.ai', 'PARITY_MATRIX.md'),
};

const REQUIRED_CANONICAL_FILES = [
  path.join(PATHS.canonicalRoot, 'README.md'),
  path.join(PATHS.canonicalRoot, 'DEFINITIONS.md'),
  path.join(PATHS.canonicalRoot, 'STANDARDS.md'),
  path.join(PATHS.canonicalRoot, 'PROJECT_CONTEXT.md'),
  PATHS.parityMatrix,
];

const STALE_CHECK_FILES = [
  path.join(ROOT, 'AGENTS.md'),
  path.join(ROOT, 'CLAUDE.md'),
  path.join(ROOT, '.ai', 'README.md'),
  path.join(ROOT, '.ai', 'DEFINITIONS.md'),
  path.join(ROOT, '.ai', 'STANDARDS.md'),
  path.join(ROOT, '.ai', 'PARITY_MATRIX.md'),
];

function log(message) { process.stdout.write(`${message}\n`); }

async function pathExists(targetPath) {
  try { await fs.access(targetPath); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

function parseFrontmatter(rawContent) {
  const content = rawContent.replace(/\r\n/g, '\n');
  if (!content.startsWith('---\n')) return { data: {}, body: content.trim() };
  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) return { data: {}, body: content.trim() };
  const frontmatterRaw = content.slice(4, closing);
  const body = content.slice(closing + 5).replace(/^\n+/, '').trim();
  const data = {};
  let currentArrayKey = null;
  for (const line of frontmatterRaw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentArrayKey) { data[currentArrayKey].push(parseScalar(listMatch[1])); continue; }
    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    const value = kvMatch[2];
    if (value === '') { data[key] = []; currentArrayKey = key; continue; }
    data[key] = parseScalar(value);
    currentArrayKey = null;
  }
  return { data, body };
}

function parseSchemaRequired(content) {
  const lines = content.split('\n');
  const required = [];
  let inRequired = false;
  for (const line of lines) {
    if (line.trim() === 'required:') { inRequired = true; continue; }
    if (inRequired) {
      const match = line.match(/^\s+-\s+(\S+)/);
      if (match) required.push(match[1]);
      else inRequired = false;
    }
  }
  return required;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((i) => String(i).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((i) => i.trim()).filter(Boolean);
  return [];
}

async function listFilesRecursive(dir, extension) {
  if (!(await pathExists(dir))) return [];
  const result = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && fullPath.endsWith(extension)) result.push(fullPath);
    }
  }
  await walk(dir);
  return result.sort();
}

async function loadCanonical(dir, errors = []) {
  const files = await listFilesRecursive(dir, '.md');
  const parsed = [];
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    parsed.push({ file, data, body, raw });
  }
  const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
  const seenIds = new Map();
  for (const entry of parsed) {
    const id = entry.data.id;
    const rel = path.relative(ROOT, entry.file);
    if (id == null) { errors.push(`[validation] ${rel} is missing "id"`); continue; }
    if (typeof id !== 'string') { errors.push(`[validation] ${rel} has non-string id`); continue; }
    if (id === '') { errors.push(`[validation] ${rel} has empty "id"`); continue; }
    if (!ID_PATTERN.test(id)) { errors.push(`[validation] ${rel} has malformed id "${id}"`); continue; }
    if (seenIds.has(id)) errors.push(`[duplicate] id "${id}" in ${rel} and ${seenIds.get(id)}`);
    else seenIds.set(id, rel);
  }
  return parsed;
}

async function loadRequiredFieldsFromSchemas(errors = []) {
  const results = { rule: [], skill: [], agent: [] };
  for (const [key, file] of [['rule', 'rule.schema.yaml'], ['skill', 'skill.schema.yaml'], ['agent', 'agent.schema.yaml']]) {
    const p = path.join(PATHS.canonicalSchemas, file);
    if (await pathExists(p)) {
      const content = await fs.readFile(p, 'utf8');
      const parsed = parseSchemaRequired(content);
      if (parsed.length > 0) results[key] = parsed;
    }
  }
  return results;
}

function assertRequiredFields(items, fields, errors, kind) {
  for (const item of items) {
    for (const field of fields) {
      if (!(field in item.data))
        errors.push(`[${kind}] missing field \`${field}\` in ${path.relative(ROOT, item.file)}`);
    }
  }
}

function assertIdMatchesFilename(items, errors, kind) {
  for (const item of items) {
    const basename = path.basename(item.file, '.md');
    const id = String(item.data.id || '');
    if (id !== basename) errors.push(`[${kind}] id "${id}" does not match filename in ${path.relative(ROOT, item.file)}`);
  }
}

async function verifyParity(rules, skills, agents, errors) {
  for (const skill of skills) {
    const id = String(skill.data.id);
    for (const target of [
      path.join(PATHS.cursorSkills, id, 'SKILL.md'),
      path.join(PATHS.claudeSkills, id, 'SKILL.md'),
      path.join(PATHS.codexSkills, id, 'SKILL.md'),
    ]) {
      if (!(await pathExists(target))) errors.push(`[parity][skill:${id}] missing ${path.relative(ROOT, target)}`);
    }
  }
  for (const agent of agents) {
    const id = String(agent.data.id);
    for (const target of [
      path.join(PATHS.cursorAgents, `${id}.md`),
      path.join(PATHS.claudeAgents, `${id}.md`),
      path.join(PATHS.codexSkills, id, 'SKILL.md'),
    ]) {
      if (!(await pathExists(target))) errors.push(`[parity][agent:${id}] missing ${path.relative(ROOT, target)}`);
    }
  }
  for (const rule of rules) {
    const id = String(rule.data.id);
    for (const target of [
      path.join(PATHS.cursorRules, `${id}.mdc`),
      path.join(PATHS.claudeSkills, `rule-${id}`, 'SKILL.md'),
      path.join(PATHS.codexSkills, `rule-${id}`, 'SKILL.md'),
    ]) {
      if (!(await pathExists(target))) errors.push(`[parity][rule:${id}] missing ${path.relative(ROOT, target)}`);
    }
  }
}

function stripCodeBlocks(content) { return content.replace(/```[\s\S]*?```/g, ''); }

function extractMarkdownLinks(content) {
  const stripped = stripCodeBlocks(content);
  const links = [];
  const normalRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  let match = normalRegex.exec(stripped);
  while (match) { links.push(match[1]); match = normalRegex.exec(stripped); }
  return links;
}

async function resolveLink(filePath, link) {
  const cleaned = link.replaceAll(/(?:^<)|(?:>$)/g, '').trim();
  if (!cleaned || cleaned.startsWith('#')) return true;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('mailto:') || cleaned.startsWith('mdc:')) return true;
  const withoutAnchor = cleaned.split('#')[0].split('?')[0];
  if (!withoutAnchor) return true;
  if (withoutAnchor.startsWith('/')) {
    const resolvedAbs = path.resolve(path.join(ROOT, withoutAnchor.slice(1)));
    if (!isWithinRoot(resolvedAbs)) return false;
    return await pathExists(resolvedAbs);
  }
  const resolved = path.resolve(path.dirname(filePath), withoutAnchor);
  if (!isWithinRoot(resolved)) return false;
  if (await pathExists(resolved)) return true;
  if (await pathExists(`${resolved}.md`)) return true;
  return false;
}

async function checkLinks(errors) {
  const aiFiles = await listFilesRecursive(PATHS.canonicalRoot, '.md');
  const requiredRootFiles = [path.join(ROOT, 'AGENTS.md'), path.join(ROOT, 'CLAUDE.md')];
  for (const file of requiredRootFiles) {
    if (!(await pathExists(file)))
      errors.push(`[missing] required adapter doc ${path.relative(ROOT, file)} does not exist — run pnpm ai:sync`);
  }
  for (const file of [...requiredRootFiles, ...aiFiles]) {
    if (!(await pathExists(file))) continue;
    const raw = await fs.readFile(file, 'utf8');
    for (const link of extractMarkdownLinks(raw)) {
      if (!(await resolveLink(file, link)))
        errors.push(`[link] broken link in ${path.relative(ROOT, file)} -> ${link}`);
    }
  }
}

async function main() {
  const errors = [];

  for (const file of REQUIRED_CANONICAL_FILES) {
    if (!(await pathExists(file))) errors.push(`[canonical] missing ${path.relative(ROOT, file)}`);
  }

  const schemaFields = await loadRequiredFieldsFromSchemas(errors);
  const ruleFields = schemaFields.rule.length > 0 ? schemaFields.rule : ['id', 'intent', 'scope', 'requirements', 'anti_patterns'];
  const skillFields = schemaFields.skill.length > 0 ? schemaFields.skill : ['id', 'name', 'description', 'when_to_use', 'workflow', 'inputs', 'outputs', 'references'];
  const agentFields = schemaFields.agent.length > 0 ? schemaFields.agent : ['id', 'name', 'purpose', 'when_to_delegate', 'checklist', 'report_format', 'tool_limits'];

  const canonicalRules = await loadCanonical(PATHS.canonicalRules, errors);
  const canonicalSkills = await loadCanonical(PATHS.canonicalSkills, errors);
  const canonicalAgents = await loadCanonical(PATHS.canonicalAgents, errors);

  assertRequiredFields(canonicalRules, ruleFields, errors, 'rule');
  assertRequiredFields(canonicalSkills, skillFields, errors, 'skill');
  assertRequiredFields(canonicalAgents, agentFields, errors, 'agent');
  assertIdMatchesFilename(canonicalRules, errors, 'rule');
  assertIdMatchesFilename(canonicalSkills, errors, 'skill');
  assertIdMatchesFilename(canonicalAgents, errors, 'agent');

  await verifyParity(canonicalRules, canonicalSkills, canonicalAgents, errors);
  await checkLinks(errors);

  // Verify capability counts in adapters
  for (const adapterFile of [path.join(ROOT, 'CLAUDE.md'), path.join(ROOT, 'AGENTS.md')]) {
    if (!(await pathExists(adapterFile))) continue;
    const content = await fs.readFile(adapterFile, 'utf8');
    const countsMap = { Rules: canonicalRules.length, Skills: canonicalSkills.length, 'Agents/Roles': canonicalAgents.length };
    for (const [label, expected] of Object.entries(countsMap)) {
      const match = content.match(new RegExp(`-\\s+${label.replace('/', '\\/')}:\\s+(\\d+)`));
      if (match && Number(match[1]) !== expected)
        errors.push(`[counts] ${path.relative(ROOT, adapterFile)} shows ${label}: ${match[1]} but canonical has ${expected}. Run \`pnpm ai:sync\`.`);
    }
  }

  // Check for stale old-structure files
  const staleFiles = [
    path.join(PATHS.cursorRules, 'ai-rules.mdc'),
    path.join(PATHS.cursorRules, 'middle-earth-project.mdc'),
  ];
  for (const staleFile of staleFiles) {
    if (await pathExists(staleFile))
      errors.push(`[stale] ${path.relative(ROOT, staleFile)} should be removed (replaced by canonical flow)`);
  }

  if (errors.length > 0) {
    log('ai check failed');
    for (const error of errors) log(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  log('ai check passed');
  log(`rules: ${canonicalRules.length}`);
  log(`skills: ${canonicalSkills.length}`);
  log(`agents: ${canonicalAgents.length}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
