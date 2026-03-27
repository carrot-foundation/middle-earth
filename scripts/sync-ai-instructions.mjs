#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY_RUN = args.has('--dry-run');

const PATHS = {
  canonicalRoot: path.join(ROOT, '.ai'),
  canonicalRules: path.join(ROOT, '.ai', 'rules'),
  canonicalSkills: path.join(ROOT, '.ai', 'capabilities', 'skills'),
  canonicalAgents: path.join(ROOT, '.ai', 'capabilities', 'agents'),
  canonicalSchemas: path.join(ROOT, '.ai', 'schemas'),

  cursorRules: path.join(ROOT, '.cursor', 'rules'),
  cursorSkills: path.join(ROOT, '.cursor', 'skills'),
  cursorAgents: path.join(ROOT, '.cursor', 'agents'),

  claudeRoot: path.join(ROOT, '.claude'),
  claudeSkills: path.join(ROOT, '.claude', 'skills'),
  claudeAgents: path.join(ROOT, '.claude', 'agents'),

  codexSkills: path.join(ROOT, '.agents', 'skills'),
  rootAgents: path.join(ROOT, 'AGENTS.md'),
  rootClaude: path.join(ROOT, 'CLAUDE.md'),

  parityMatrix: path.join(ROOT, '.ai', 'PARITY_MATRIX.md'),
  projectContext: path.join(ROOT, '.ai', 'PROJECT_CONTEXT.md'),
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function ensureDir(targetPath) {
  if (DRY_RUN) return;
  await fs.mkdir(targetPath, { recursive: true });
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"'))
    return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'"))
    return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

function parseFrontmatter(rawContent) {
  const content = rawContent.replace(/\r\n/g, '\n');
  if (!content.startsWith('---\n'))
    return { data: {}, body: content.trim() };

  const closing = content.indexOf('\n---\n', 4);
  if (closing === -1) {
    log('[sync] warning: no closing frontmatter delimiter');
    return { data: {}, body: content.trim() };
  }

  const frontmatterRaw = content.slice(4, closing);
  const body = content.slice(closing + 5).replace(/^\n+/, '').trim();
  const data = {};
  let currentArrayKey = null;

  for (const line of frontmatterRaw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentArrayKey) {
      data[currentArrayKey].push(parseScalar(listMatch[1]));
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    const value = kvMatch[2];
    if (value === '') {
      data[key] = [];
      currentArrayKey = key;
      continue;
    }
    data[key] = parseScalar(value);
    currentArrayKey = null;
  }
  return { data, body };
}

function quote(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const str = String(value);
  if (str === '') return "''";
  if (/^[A-Za-z0-9_./:@-]+$/.test(str)) return str;
  return `'${str.replaceAll("'", "''")}'`;
}

function toFrontmatter(data, preferredOrder = []) {
  const keys = [
    ...preferredOrder.filter((key) => key in data),
    ...Object.keys(data).filter((key) => !preferredOrder.includes(key)),
  ];
  const lines = ['---'];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${quote(String(item))}`);
      continue;
    }
    lines.push(`${key}: ${quote(String(value))}`);
  }
  lines.push('---');
  return `${lines.join('\n')}\n`;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((i) => String(i).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim())
    return value.split(',').map((i) => i.trim()).filter(Boolean);
  return [];
}

function titleFromId(id) {
  return id.split('-').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
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

function matchSectionHeading(line, heading) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('## ')) return false;
  return trimmed.slice(3).trim().toLowerCase() === heading.toLowerCase();
}

function getSectionBody(markdownBody, heading, { toEnd = false, contextLabel = '' } = {}) {
  const lines = markdownBody.split('\n');
  const start = lines.findIndex((line) => matchSectionHeading(line, heading));
  if (start === -1) {
    const ctx = contextLabel ? ` (${contextLabel})` : '';
    log(`[sync] warning: section "## ${heading}" not found${ctx}; using full body`);
    return markdownBody.trim();
  }
  if (toEnd) return lines.slice(start + 1).join('\n').trim();
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

async function writeFile(targetPath, content) {
  if (DRY_RUN) {
    log(`[dry-run] would write: ${path.relative(ROOT, targetPath)}`);
    return;
  }
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, `${content.replace(/\s+$/u, '')}\n`, 'utf8');
}

async function loadCanonicalFiles(dir) {
  const files = await listFilesRecursive(dir, '.md');
  const out = [];
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseFrontmatter(raw);
    out.push({ file, data: parsed.data, body: parsed.body });
  }
  const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
  const seenIds = new Map();
  for (const entry of out) {
    const rel = path.relative(ROOT, entry.file);
    const id = entry.data.id;
    if (id == null) throw new Error(`[validation] ${rel} is missing "id" in frontmatter`);
    if (typeof id !== 'string') throw new Error(`[validation] ${rel} has non-string id`);
    if (id === '') throw new Error(`[validation] ${rel} has empty "id"`);
    if (!ID_PATTERN.test(id)) throw new Error(`[validation] ${rel} has malformed id "${id}"`);
    if (seenIds.has(id)) throw new Error(`[validation] duplicate id "${id}" in ${rel} and ${seenIds.get(id)}`);
    seenIds.set(id, rel);
  }
  return out.sort((a, b) => String(a.data.id).localeCompare(String(b.data.id)));
}

function renderCursorRule(rule) {
  const globs = normalizeArray(rule.data.scope);
  const isUniversal = globs.length === 1 && globs[0] === '*';
  const frontmatter = {
    description: rule.data.intent,
    globs: globs.length > 0 ? globs : ['*'],
    alwaysApply: isUniversal,
  };
  const fm = toFrontmatter(frontmatter, ['description', 'globs', 'alwaysApply']);
  let body = getSectionBody(rule.body, 'Rule body', { toEnd: true, contextLabel: `rule:${rule.data.id}` });
  const substantiveLines = body.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>'));
  const isMinimal = substantiveLines.length < 3;
  const hasFrontmatterContent = (rule.data.requirements?.length || 0) > 0 || (rule.data.anti_patterns?.length || 0) > 0;
  if (isMinimal && hasFrontmatterContent) {
    const sections = [];
    const reqs = normalizeArray(rule.data.requirements);
    if (reqs.length > 0) sections.push('## Requirements\n\n' + reqs.map((r) => `- ${r}`).join('\n'));
    const anti = normalizeArray(rule.data.anti_patterns);
    if (anti.length > 0) sections.push('## Anti-patterns\n\n' + anti.map((a) => `- ${a}`).join('\n'));
    if (sections.length > 0) body = `${body.trim()}\n\n${sections.join('\n\n')}`;
  }
  return `${fm}\n${body}\n`;
}

function renderSkillFile(skill) {
  const frontmatter = { name: skill.data.name || skill.data.id, description: skill.data.description || `Skill for ${skill.data.id}` };
  const fm = toFrontmatter(frontmatter, ['name', 'description']);
  const body = getSectionBody(skill.body, 'Instructions', { toEnd: true, contextLabel: `skill:${skill.data.id}` });
  return `${fm}\n${body}\n`;
}

function renderAgentFile(agent) {
  const frontmatter = { name: agent.data.name || agent.data.id, description: agent.data.purpose || `Specialist agent for ${agent.data.id}`, model: 'default' };
  const fm = toFrontmatter(frontmatter, ['name', 'description', 'model']);
  const body = getSectionBody(agent.body, 'Instructions', { toEnd: true, contextLabel: `agent:${agent.data.id}` });
  return `${fm}\n${body}\n`;
}

function renderRuleSkillFile(rule) {
  const frontmatter = { name: `rule-${rule.data.id}`, description: rule.data.intent || `Rule mapping for ${rule.data.id}` };
  const fm = toFrontmatter(frontmatter, ['name', 'description']);
  const scope = normalizeArray(rule.data.scope);
  return `${fm}\n# Rule ${rule.data.id}\n\nApply this rule whenever work touches:\n${scope.map((item) => `- \`${item}\``).join('\n')}\n\n${getSectionBody(rule.body, 'Rule body', { toEnd: true, contextLabel: `rule:${rule.data.id}` })}\n`;
}

function renderAgentAsCodexSkill(agent) {
  const frontmatter = { name: agent.data.id, description: agent.data.purpose || `Specialist role for ${agent.data.id}` };
  const fm = toFrontmatter(frontmatter, ['name', 'description']);
  const whenToDelegate = normalizeArray(agent.data.when_to_delegate);
  const checklist = normalizeArray(agent.data.checklist);
  return `${fm}\n# Specialist Role: ${agent.data.name || agent.data.id}\n\nUse this skill when:\n${whenToDelegate.map((item) => `- ${item}`).join('\n')}\n\n## Checklist\n${checklist.map((item) => `- ${item}`).join('\n')}\n\n## Report format\n${agent.data.report_format || 'Provide a structured report with findings and verification.'}\n\n## Instructions\n\n${getSectionBody(agent.body, 'Instructions', { toEnd: true, contextLabel: `agent:${agent.data.id}` })}\n`;
}

async function generateCursorArtifacts(canonicalRules, canonicalSkills, canonicalAgents) {
  for (const rule of canonicalRules) {
    const target = path.join(PATHS.cursorRules, `${rule.data.id}.mdc`);
    await writeFile(target, renderCursorRule(rule));
  }
  for (const skill of canonicalSkills) {
    const target = path.join(PATHS.cursorSkills, String(skill.data.id), 'SKILL.md');
    await writeFile(target, renderSkillFile(skill));
  }
  for (const agent of canonicalAgents) {
    const target = path.join(PATHS.cursorAgents, `${agent.data.id}.md`);
    await writeFile(target, renderAgentFile(agent));
  }
}

async function generateClaudeArtifacts(canonicalRules, canonicalSkills, canonicalAgents) {
  const settingsPath = path.join(PATHS.claudeRoot, 'settings.json');
  let existingSettings = {};
  if (await pathExists(settingsPath)) {
    const raw = await fs.readFile(settingsPath, 'utf8');
    try { existingSettings = JSON.parse(raw); } catch (e) {
      throw new Error(`[sync] ${settingsPath} contains invalid JSON: ${e.message}`);
    }
  }
  const existingPerms = existingSettings.permissions && typeof existingSettings.permissions === 'object' && !Array.isArray(existingSettings.permissions) ? existingSettings.permissions : {};
  const existingAllow = Array.isArray(existingPerms.allow) ? existingPerms.allow.filter((i) => typeof i === 'string') : [];
  const hardcodedAllow = [
    'Bash(ls:*)', 'Bash(find:*)', 'Bash(rg:*)', 'Bash(cat:*)', 'Bash(sed:*)',
    'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)',
    'Bash(pnpm build:*)', 'Bash(pnpm test:*)', 'Bash(pnpm lint:*)',
    'Bash(pnpm nx run:*)', 'Bash(pnpm ai\\:check:*)', 'Bash(pnpm ai\\:sync:*)',
    'Bash(npx prettier:*)', 'Bash(npx eslint:*)',
  ];
  const mergedAllow = [...new Set([...existingAllow, ...hardcodedAllow])].sort();
  const mergedSettings = { ...existingSettings, permissions: { ...existingPerms, allow: mergedAllow } };
  await writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));

  for (const skill of canonicalSkills) {
    const target = path.join(PATHS.claudeSkills, String(skill.data.id), 'SKILL.md');
    await writeFile(target, renderSkillFile(skill));
  }
  for (const rule of canonicalRules) {
    const target = path.join(PATHS.claudeSkills, `rule-${rule.data.id}`, 'SKILL.md');
    await writeFile(target, renderRuleSkillFile(rule));
  }
  for (const agent of canonicalAgents) {
    const target = path.join(PATHS.claudeAgents, `${agent.data.id}.md`);
    await writeFile(target, renderAgentFile(agent));
  }
}

async function generateCodexArtifacts(canonicalRules, canonicalSkills, canonicalAgents) {
  for (const skill of canonicalSkills) {
    const target = path.join(PATHS.codexSkills, String(skill.data.id), 'SKILL.md');
    await writeFile(target, renderSkillFile(skill));
  }
  for (const rule of canonicalRules) {
    const target = path.join(PATHS.codexSkills, `rule-${rule.data.id}`, 'SKILL.md');
    await writeFile(target, renderRuleSkillFile(rule));
  }
  for (const agent of canonicalAgents) {
    const target = path.join(PATHS.codexSkills, String(agent.data.id), 'SKILL.md');
    await writeFile(target, renderAgentAsCodexSkill(agent));
  }
}

function checkbox(value) { return value ? 'Yes' : 'No'; }

async function generateParityMatrix(canonicalRules, canonicalSkills, canonicalAgents) {
  const lines = ['# Parity matrix', '', 'Generated by `pnpm ai:sync`.', '', '## Summary', '',
    `- Canonical rules: ${canonicalRules.length}`, `- Canonical skills: ${canonicalSkills.length}`, `- Canonical agents: ${canonicalAgents.length}`, ''];

  lines.push('## Skills parity', '', '| Skill | Cursor | Claude | Codex |', '| --- | --- | --- | --- |');
  for (const skill of canonicalSkills) {
    const id = String(skill.data.id);
    const c = await pathExists(path.join(PATHS.cursorSkills, id, 'SKILL.md'));
    const cl = await pathExists(path.join(PATHS.claudeSkills, id, 'SKILL.md'));
    const co = await pathExists(path.join(PATHS.codexSkills, id, 'SKILL.md'));
    lines.push(`| ${id} | ${checkbox(c)} | ${checkbox(cl)} | ${checkbox(co)} |`);
  }

  lines.push('', '## Agents parity', '', '| Agent | Cursor agent | Claude agent | Codex skill mapping |', '| --- | --- | --- | --- |');
  for (const agent of canonicalAgents) {
    const id = String(agent.data.id);
    const c = await pathExists(path.join(PATHS.cursorAgents, `${id}.md`));
    const cl = await pathExists(path.join(PATHS.claudeAgents, `${id}.md`));
    const co = await pathExists(path.join(PATHS.codexSkills, id, 'SKILL.md'));
    lines.push(`| ${id} | ${checkbox(c)} | ${checkbox(cl)} | ${checkbox(co)} |`);
  }

  lines.push('', '## Rules parity', '', '| Rule | Cursor rule | Claude skill mapping | Codex skill mapping |', '| --- | --- | --- | --- |');
  for (const rule of canonicalRules) {
    const id = String(rule.data.id);
    const c = await pathExists(path.join(PATHS.cursorRules, `${id}.mdc`));
    const cl = await pathExists(path.join(PATHS.claudeSkills, `rule-${id}`, 'SKILL.md'));
    const co = await pathExists(path.join(PATHS.codexSkills, `rule-${id}`, 'SKILL.md'));
    lines.push(`| ${id} | ${checkbox(c)} | ${checkbox(cl)} | ${checkbox(co)} |`);
  }

  await writeFile(PATHS.parityMatrix, `${lines.join('\n')}\n`);
}

async function generateRootAdapters(canonicalRules, canonicalSkills, canonicalAgents) {
  const sharedLinks = [
    '- `.ai/README.md`', '- `.ai/DEFINITIONS.md`', '- `.ai/STANDARDS.md`',
    '- `.ai/PARITY_MATRIX.md`', '- `.ai/PROJECT_CONTEXT.md`',
  ].join('\n');

  const skillsList = canonicalSkills.map((s) => `- \`${s.data.id}\` - ${s.data.description || s.data.id}`).join('\n');
  const rulesList = canonicalRules.map((r) => `- \`rule-${r.data.id}\` - ${r.data.intent || r.data.id}`).join('\n');
  const agentsList = canonicalAgents.map((a) => `- \`${a.data.id}\` - ${a.data.purpose || a.data.id}`).join('\n');

  const agentsContent = `# AGENTS.md

Middle Earth AI instructions for Codex, Claude, and Cursor with equal capability parity.

## Equality rule

- Cursor, Claude, and Codex are treated as equals.
- No platform is primary for instruction definition.
- Canonical source: \`.ai/\`.

## Canonical workflow

1. Edit canonical files in \`.ai/\`.
2. Run \`pnpm ai:sync\` to regenerate platform adapters.
3. Run \`pnpm ai:check\` to validate parity and links.

## Current capability counts

- Rules: ${canonicalRules.length}
- Skills: ${canonicalSkills.length}
- Agents/Roles: ${canonicalAgents.length}

## Available skills

${skillsList}

## Rule mappings

${rulesList}

## Agent roles

${agentsList}

## Canonical references

${sharedLinks}

## Runtime adapter paths

- Cursor: \`.cursor/rules/\`, \`.cursor/skills/\`, \`.cursor/agents/\`
- Claude: \`.claude/settings.json\`, \`.claude/skills/\`, \`.claude/agents/\`
- Codex: \`.agents/skills/\`, \`AGENTS.md\`

## Setup commands (workspace)

- Install deps: \`pnpm install\`
- Run lint (affected): \`pnpm lint:affected\`
- Run tests: \`pnpm nx affected --target test\`
- Build: \`pnpm nx affected --target build\`
- Validate AI instructions: \`pnpm ai:check\`
`;

  const claudeHeader = `# CLAUDE.md

Claude adapter for Middle Earth AI instructions. This file is generated from canonical \`.ai/\`.

## Equality rule

- Cursor, Claude, and Codex are configured as equals.
- Capability parity is mandatory across all three.
- Canonical source remains tool-agnostic in \`.ai/\`.

## Claude runtime

- Baseline settings: \`.claude/settings.json\`
- Skills: \`.claude/skills/*/SKILL.md\`
- Agents: \`.claude/agents/*.md\`

## Required workflow

1. Update canonical docs under \`.ai/\`.
2. Run \`pnpm ai:sync\`.
3. Run \`pnpm ai:check\`.

## Canonical references

${sharedLinks}

## Capability counts

- Rules: ${canonicalRules.length}
- Skills: ${canonicalSkills.length}
- Agents/Roles: ${canonicalAgents.length}
`;

  const projectContextContent = (await pathExists(PATHS.projectContext))
    ? (await fs.readFile(PATHS.projectContext, 'utf8')).trim()
    : null;

  const claudeContent = projectContextContent
    ? `${claudeHeader.trimEnd()}\n\n${projectContextContent}\n`
    : claudeHeader;

  const codexContent = projectContextContent
    ? `${agentsContent.trimEnd()}\n\n${projectContextContent}\n`
    : agentsContent;

  await writeFile(PATHS.rootAgents, codexContent);
  await writeFile(PATHS.rootClaude, claudeContent);
}

async function removeStaleAdapters(canonicalRules, canonicalSkills, canonicalAgents) {
  const validSkillIds = new Set(canonicalSkills.map((s) => String(s.data.id)));
  const validSkillAndAgentIds = new Set([...validSkillIds, ...canonicalAgents.map((a) => String(a.data.id))]);
  const validRuleIds = new Set(canonicalRules.map((r) => String(r.data.id)));
  const validRuleSkillDirs = new Set(canonicalRules.map((r) => `rule-${r.data.id}`));

  for (const baseDir of [PATHS.cursorSkills, PATHS.claudeSkills, PATHS.codexSkills]) {
    if (!(await pathExists(baseDir))) continue;
    const allowedIds = baseDir === PATHS.codexSkills ? validSkillAndAgentIds : validSkillIds;
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (id.startsWith('rule-')) { if (validRuleSkillDirs.has(id)) continue; }
      else if (allowedIds.has(id)) continue;
      const staleDir = path.join(baseDir, id);
      if (!DRY_RUN) {
        try { await fs.rm(staleDir, { recursive: true }); } catch (e) {
          log(`[sync] warning: failed to remove ${path.relative(ROOT, staleDir)}: ${e.message}`);
          continue;
        }
      }
      log(`removed stale adapter: ${path.relative(ROOT, staleDir)}`);
    }
  }

  if (await pathExists(PATHS.cursorRules)) {
    const ruleFiles = await fs.readdir(PATHS.cursorRules, { withFileTypes: true });
    for (const entry of ruleFiles) {
      if (!entry.isFile() || !entry.name.endsWith('.mdc')) continue;
      const id = entry.name.replace(/\.mdc$/, '');
      if (validRuleIds.has(id)) continue;
      const stalePath = path.join(PATHS.cursorRules, entry.name);
      if (!DRY_RUN) {
        try { await fs.unlink(stalePath); } catch (e) {
          log(`[sync] warning: failed to remove ${path.relative(ROOT, stalePath)}: ${e.message}`);
          continue;
        }
      }
      log(`removed stale adapter: ${path.relative(ROOT, stalePath)}`);
    }
  }

  const validAgentIds = new Set(canonicalAgents.map((a) => String(a.data.id)));
  for (const agentsDir of [PATHS.cursorAgents, PATHS.claudeAgents]) {
    if (!(await pathExists(agentsDir))) continue;
    const files = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      if (validAgentIds.has(entry.name.replace(/\.md$/, ''))) continue;
      const stalePath = path.join(agentsDir, entry.name);
      if (!DRY_RUN) {
        try { await fs.unlink(stalePath); } catch (e) {
          log(`[sync] warning: failed to remove ${path.relative(ROOT, stalePath)}: ${e.message}`);
          continue;
        }
      }
      log(`removed stale adapter: ${path.relative(ROOT, stalePath)}`);
    }
  }
}

async function main() {
  const canonicalRules = await loadCanonicalFiles(PATHS.canonicalRules);
  const canonicalSkills = await loadCanonicalFiles(PATHS.canonicalSkills);
  const canonicalAgents = await loadCanonicalFiles(PATHS.canonicalAgents);

  const skillIds = new Set(canonicalSkills.map((s) => String(s.data.id)));
  for (const skill of canonicalSkills) {
    if (String(skill.data.id).startsWith('rule-'))
      throw new Error(`[validation] skill id "${skill.data.id}" must not start with "rule-"`);
  }
  for (const agent of canonicalAgents) {
    if (String(agent.data.id).startsWith('rule-'))
      throw new Error(`[validation] agent id "${agent.data.id}" must not start with "rule-"`);
    if (skillIds.has(String(agent.data.id)))
      throw new Error(`[codex] duplicate skill/agent id: ${agent.data.id}`);
  }

  await generateCursorArtifacts(canonicalRules, canonicalSkills, canonicalAgents);
  await generateClaudeArtifacts(canonicalRules, canonicalSkills, canonicalAgents);
  await generateCodexArtifacts(canonicalRules, canonicalSkills, canonicalAgents);
  await generateParityMatrix(canonicalRules, canonicalSkills, canonicalAgents);
  await generateRootAdapters(canonicalRules, canonicalSkills, canonicalAgents);
  await removeStaleAdapters(canonicalRules, canonicalSkills, canonicalAgents);

  log('ai sync complete');
  log(`rules: ${canonicalRules.length}`);
  log(`skills: ${canonicalSkills.length}`);
  log(`agents: ${canonicalAgents.length}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
