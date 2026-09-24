/**
 * Prospects commands: the records your team is working, with their notes,
 * files, photos, tags, and activity. Every command is a thin wrapper over
 * `/v1/prospects`; uploads and downloads move bytes directly to and from
 * storage using the presigned URLs the API hands back.
 */

import chalk from 'chalk';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { apiRequest, formatDate } from '../lib/client.js';
import {
  createSpinner,
  parseRequestBody,
  printHeader,
  printJson,
  printKeyValue,
  printTable,
  truncate,
} from '../lib/output.js';

type Prospect = {
  id: string;
  record_type: string;
  record_id: string;
  lifecycle: string;
  favorite: boolean;
  source: string;
  record: {
    address?: string | null;
    name?: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  tags: Array<{ id: string; name: string }>;
  note_count?: number;
  file_count?: number;
  created_at: string;
};

type Pagination = { page: number; per_page: number; total: number; has_more: boolean };

function splitIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function recordLabel(prospect: Prospect): string {
  const record = prospect.record;
  const main = record?.address ?? record?.name ?? prospect.record_id;
  const place = [record?.city, record?.state].filter(Boolean).join(', ');
  return place ? `${main} (${place})` : String(main);
}

function printProspectRows(prospects: Prospect[]) {
  const rows = prospects.map((p) => ({
    id: p.id,
    record: truncate(recordLabel(p), 44),
    lifecycle: p.lifecycle,
    fav: p.favorite ? '★' : '',
    tags: truncate(p.tags.map((tag) => tag.name).join(', ') || '—', 24),
    added: formatDate(p.created_at),
  }));
  printTable(rows, ['id', 'record', 'lifecycle', 'fav', 'tags', 'added']);
}

function printPagination(p: Pagination) {
  console.log();
  console.log(
    chalk.dim(`Page ${p.page} — ${p.total} total${p.has_more ? ' (more available)' : ''}`)
  );
  console.log();
}

// ============================================================================
// Prospects
// ============================================================================

export async function prospectsList(options: {
  recordType?: string;
  lifecycle?: string;
  source?: string;
  favorites?: boolean;
  list?: string;
  tag?: string;
  search?: string;
  sort?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching prospects...').start();
  const data = await apiRequest<{ data: Prospect[]; pagination: Pagination }>('/prospects', {
    query: {
      record_type: options.recordType,
      lifecycle: options.lifecycle,
      source: options.source,
      favorites_only: options.favorites ? 'true' : undefined,
      list_id: options.list,
      tag_id: options.tag,
      search: options.search,
      sort: options.sort,
      page: options.page ? parseInt(options.page, 10) : undefined,
      per_page: options.perPage ? parseInt(options.perPage, 10) : undefined,
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Prospects (${options.lifecycle ?? 'active'})`);
  console.log();
  if (data.data.length) printProspectRows(data.data);
  else console.log(chalk.dim('  No prospects found.'));
  printPagination(data.pagination);
}

export async function prospectsGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching prospect...').start();
  const data = await apiRequest<{ data: Prospect }>(`/prospects/${id}`);
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }
  const p = data.data;
  printHeader(`Prospect ${p.id}`);
  printKeyValue({
    Record: recordLabel(p),
    'Record ID': p.record_id,
    Type: p.record_type,
    Lifecycle: p.lifecycle,
    Favorite: p.favorite ? 'Yes' : 'No',
    Source: p.source,
    Tags: p.tags.map((tag) => `${tag.name} (${tag.id})`).join(', ') || '—',
    Notes: String(p.note_count ?? 0),
    Files: String(p.file_count ?? 0),
    Added: formatDate(p.created_at),
  });
  console.log();
}

export async function prospectsGetByRecord(options: {
  recordId: string;
  recordType?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching prospect...').start();
  const data = await apiRequest<{ data: Prospect }>('/prospects/by-record', {
    query: {
      record_id: options.recordId,
      record_type: options.recordType,
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }
  const p = data.data;
  printHeader(`Prospect ${p.id}`);
  printKeyValue({
    Record: recordLabel(p),
    'Record ID': p.record_id,
    Type: p.record_type,
    Lifecycle: p.lifecycle,
    Favorite: p.favorite ? 'Yes' : 'No',
    Source: p.source,
    Tags: p.tags.map((tag) => `${tag.name} (${tag.id})`).join(', ') || '—',
    Added: formatDate(p.created_at),
  });
  console.log();
}

export async function prospectsAdd(options: {
  ids?: string;
  recordType?: string;
  favorite?: boolean;
  body?: string;
  file?: string;
  json?: boolean;
}): Promise<void> {
  let requestBody: Record<string, unknown>;
  if (options.ids) {
    requestBody = { record_ids: splitIds(options.ids) };
    if (options.recordType) requestBody.record_type = options.recordType;
    if (options.favorite) requestBody.favorite = true;
  } else {
    requestBody = await parseRequestBody(options);
  }

  const spinner = createSpinner('Adding prospects...').start();
  const data = await apiRequest<{
    data: { created: number; existing: number; reactivated: number; prospects: Prospect[] };
  }>('/prospects', { method: 'POST', body: requestBody });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }
  const d = data.data;
  printHeader('Prospects Added');
  printKeyValue({
    New: String(d.created),
    'Already tracked': String(d.existing),
    Reactivated: String(d.reactivated),
  });
  console.log();
  printProspectRows(d.prospects);
  console.log();
}

async function setLifecycle(
  id: string,
  lifecycle: 'active' | 'opportunity' | 'archived',
  options: { json?: boolean; noCascade?: boolean }
) {
  const spinner = createSpinner('Updating prospect...').start();
  const data = await apiRequest<{ data: Prospect }>(`/prospects/${id}`, {
    method: 'PATCH',
    body: { lifecycle, ...(options.noCascade ? { cascade: false } : {}) },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ ${data.data.id} is now ${data.data.lifecycle}`));
  console.log();
}

export async function prospectsArchive(
  id: string,
  options: { json?: boolean; noCascade?: boolean }
) {
  await setLifecycle(id, 'archived', options);
}

export async function prospectsRemove(
  id: string,
  options: { noCascade?: boolean; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Archiving prospect...').start();
  const data = await apiRequest<{ data: Prospect }>(`/prospects/${id}`, {
    method: 'DELETE',
    query: { cascade: options.noCascade ? 'false' : undefined },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Archived ${id}`));
  console.log();
}

export async function prospectsReactivate(id: string, options: { json?: boolean }) {
  await setLifecycle(id, 'active', options);
}

export async function prospectsOpportunity(id: string, options: { json?: boolean }) {
  await setLifecycle(id, 'opportunity', options);
}

export async function prospectsFavorite(
  id: string,
  options: { off?: boolean; json?: boolean }
): Promise<void> {
  const spinner = createSpinner(options.off ? 'Removing star...' : 'Starring...').start();
  const data = await apiRequest<{ data: Prospect }>(`/prospects/${id}`, {
    method: 'PATCH',
    body: { favorite: !options.off },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(options.off ? `✓ Removed star from ${id}` : `✓ Starred ${id}`));
  console.log();
}

export async function prospectsCheck(options: {
  ids: string;
  recordType?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Checking records...').start();
  const data = await apiRequest<{
    data: Array<{
      record_id: string;
      prospect_id: string | null;
      lifecycle: string | null;
      favorite: boolean;
    }>;
  }>('/prospects/check', {
    method: 'POST',
    body: {
      record_ids: splitIds(options.ids),
      ...(options.recordType && { record_type: options.recordType }),
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Prospect Check');
  console.log();
  printTable(
    data.data.map((row) => ({
      record: row.record_id,
      prospect: row.prospect_id ?? '—',
      lifecycle: row.lifecycle ?? 'not a prospect',
      fav: row.favorite ? '★' : '',
    })),
    ['record', 'prospect', 'lifecycle', 'fav']
  );
  console.log();
}

export async function prospectsCounts(options: { list?: string; json?: boolean }): Promise<void> {
  const spinner = createSpinner('Counting prospects...').start();
  const data = await apiRequest<{ data: Record<string, Record<string, number>> }>(
    '/prospects/counts',
    {
      query: { list_id: options.list },
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader('Prospect Counts');
  console.log();
  const rows = (['active', 'opportunity', 'archived'] as const).map((lifecycle) => ({
    lifecycle,
    properties: String(data.data[lifecycle]?.property ?? 0),
    people: String(data.data[lifecycle]?.person ?? 0),
    companies: String(data.data[lifecycle]?.company ?? 0),
  }));
  printTable(rows, ['lifecycle', 'properties', 'people', 'companies']);
  console.log();
}

export async function prospectsActivity(
  id: string,
  options: { category?: string; since?: string; page?: string; perPage?: string; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching activity...').start();
  const data = await apiRequest<{
    data: Array<{
      id: string;
      type: string;
      summary: string | null;
      actor: { type: string; name: string | null } | null;
      source: string;
      created_at: string;
    }>;
    pagination: Pagination;
  }>(`/prospects/${id}/activity`, {
    query: {
      category: options.category,
      since: options.since,
      page: options.page ? parseInt(options.page, 10) : undefined,
      per_page: options.perPage ? parseInt(options.perPage, 10) : undefined,
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Activity for ${id}`);
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((row) => ({
        when: formatDate(row.created_at),
        type: row.type,
        summary: truncate(row.summary ?? '—', 50),
        by: row.actor?.name ?? row.actor?.type ?? '—',
        via: row.source,
      })),
      ['when', 'type', 'summary', 'by', 'via']
    );
  } else {
    console.log(chalk.dim('  No activity yet.'));
  }
  printPagination(data.pagination);
}

// ============================================================================
// Notes
// ============================================================================

type Note = {
  id: string;
  body: string;
  author: { type: string; name: string | null } | null;
  created_at: string;
};

export async function prospectNotesList(
  id: string,
  options: { page?: string; perPage?: string; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching notes...').start();
  const data = await apiRequest<{ data: Note[]; pagination: Pagination }>(
    `/prospects/${id}/notes`,
    {
      query: {
        page: options.page ? parseInt(options.page, 10) : undefined,
        per_page: options.perPage ? parseInt(options.perPage, 10) : undefined,
      },
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Notes on ${id}`);
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((note) => ({
        id: note.id,
        note: truncate(note.body.replace(/\s+/g, ' '), 60),
        by: note.author?.name ?? note.author?.type ?? '—',
        when: formatDate(note.created_at),
      })),
      ['id', 'note', 'by', 'when']
    );
  } else {
    console.log(chalk.dim('  No notes yet.'));
  }
  printPagination(data.pagination);
}

export async function prospectNotesGet(
  id: string,
  noteId: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching note...').start();
  const data = await apiRequest<{ data: Note }>(`/prospects/${id}/notes/${noteId}`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Note ${data.data.id}`);
  printKeyValue({
    Body: data.data.body,
    By: data.data.author?.name ?? data.data.author?.type ?? '—',
    Created: formatDate(data.data.created_at),
  });
  console.log();
}

export async function prospectNotesAdd(
  id: string,
  text: string | undefined,
  options: { body?: string; file?: string; json?: boolean }
): Promise<void> {
  const requestBody = text ? { body: text } : await parseRequestBody(options);
  const spinner = createSpinner('Adding note...').start();
  const data = await apiRequest<{ data: Note }>(`/prospects/${id}/notes`, {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Added ${data.data.id}`));
  console.log();
}

export async function prospectNotesEdit(
  id: string,
  noteId: string,
  text: string,
  options: { json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Updating note...').start();
  const data = await apiRequest<{ data: Note }>(`/prospects/${id}/notes/${noteId}`, {
    method: 'PATCH',
    body: { body: text },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Updated ${data.data.id}`));
  console.log();
}

export async function prospectNotesRemove(id: string, noteId: string, options: { json?: boolean }) {
  const spinner = createSpinner('Deleting note...').start();
  const data = await apiRequest<{ data: { deleted: boolean; id: string } }>(
    `/prospects/${id}/notes/${noteId}`,
    {
      method: 'DELETE',
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Deleted ${data.data.id}`));
  console.log();
}

// ============================================================================
// Files
// ============================================================================

type ProspectFile = {
  id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_by: { type: string; name: string | null } | null;
  created_at: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function prospectFilesList(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching files...').start();
  const data = await apiRequest<{ data: ProspectFile[] }>(`/prospects/${id}/files`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Files on ${id}`);
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((file) => ({
        id: file.id,
        name: truncate(file.file_name, 40),
        size: formatBytes(file.file_size),
        type: file.content_type,
        by: file.uploaded_by?.name ?? file.uploaded_by?.type ?? '—',
        when: formatDate(file.created_at),
      })),
      ['id', 'name', 'size', 'type', 'by', 'when']
    );
  } else {
    console.log(chalk.dim('  No files yet.'));
  }
  console.log();
}

export async function prospectFilesUpload(
  id: string,
  path: string,
  options: { contentType?: string; name?: string; json?: boolean }
): Promise<void> {
  const bytes = await readFile(path);
  const fileName = options.name ?? basename(path);
  const contentType = options.contentType ?? 'application/octet-stream';

  const spinner = createSpinner(`Uploading ${fileName}...`).start();
  const target = await apiRequest<{
    data: { upload_url: string; headers: Record<string, string>; s3_key: string };
  }>(`/prospects/${id}/files/upload-url`, {
    method: 'POST',
    body: { file_name: fileName, content_type: contentType, file_size: bytes.byteLength },
  });
  const put = await fetch(target.data.upload_url, {
    method: 'PUT',
    headers: target.data.headers,
    body: bytes,
  });
  if (!put.ok) {
    spinner.stop();
    console.error(chalk.red(`Error: upload failed with status ${put.status}`));
    process.exit(1);
  }
  const data = await apiRequest<{ data: ProspectFile }>(`/prospects/${id}/files`, {
    method: 'POST',
    body: {
      s3_key: target.data.s3_key,
      file_name: fileName,
      file_size: bytes.byteLength,
      content_type: contentType,
    },
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Attached ${data.data.id} (${formatBytes(data.data.file_size)})`));
  console.log();
}

export async function prospectFilesDownload(
  id: string,
  fileId: string,
  options: { out?: string; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Fetching download link...').start();
  const link = await apiRequest<{ data: { url: string; expires_in: number } }>(
    `/prospects/${id}/files/${fileId}/download`,
    { query: { redirect: 'false' } }
  );
  if (options.json) {
    spinner.stop();
    printJson(link);
    return;
  }
  const response = await fetch(link.data.url);
  if (!response.ok) {
    spinner.stop();
    console.error(chalk.red(`Error: download failed with status ${response.status}`));
    process.exit(1);
  }
  const out = options.out ?? `${fileId}.bin`;
  await writeFile(out, Buffer.from(await response.arrayBuffer()));
  spinner.stop();
  console.log(chalk.green(`✓ Saved to ${out}`));
  console.log();
}

export async function prospectFilesRemove(id: string, fileId: string, options: { json?: boolean }) {
  const spinner = createSpinner('Deleting file...').start();
  const data = await apiRequest<{ data: { deleted: boolean; id: string } }>(
    `/prospects/${id}/files/${fileId}`,
    {
      method: 'DELETE',
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Deleted ${data.data.id}`));
  console.log();
}

// ============================================================================
// Photos
// ============================================================================

type Photo = {
  id: string;
  url: string;
  photo_type: string | null;
  caption: string | null;
  created_at: string | null;
};

export async function prospectPhotosList(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching photos...').start();
  const data = await apiRequest<{ data: Photo[] }>(`/prospects/${id}/photos`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Photos on ${id}`);
  console.log();
  if (data.data.length) {
    printTable(
      data.data.map((photo) => ({
        id: photo.id,
        type: photo.photo_type ?? '—',
        caption: truncate(photo.caption ?? '—', 30),
        when: photo.created_at ? formatDate(photo.created_at) : '—',
        url: truncate(photo.url, 48),
      })),
      ['id', 'type', 'caption', 'when', 'url']
    );
  } else {
    console.log(chalk.dim('  No photos yet.'));
  }
  console.log();
}

export async function prospectPhotosAdd(
  id: string,
  options: { file?: string; url?: string; type?: string; caption?: string; json?: boolean }
): Promise<void> {
  if (!options.file && !options.url) {
    console.error(chalk.red('Error: pass --file <path> or --url <https url>'));
    process.exit(1);
  }
  const body: Record<string, unknown> = {
    ...(options.type && { photo_type: options.type }),
    ...(options.caption && { caption: options.caption }),
  };
  if (options.file) {
    const bytes = await readFile(options.file);
    if (bytes.byteLength > 700 * 1024) {
      console.error(
        chalk.red('Error: files over 700 KB must be added with --url (the API body limit is 1 MB).')
      );
      process.exit(1);
    }
    body.image_base64 = bytes.toString('base64');
  } else {
    body.image_url = options.url;
  }
  const spinner = createSpinner('Adding photo...').start();
  const data = await apiRequest<{ data: Photo }>(`/prospects/${id}/photos`, {
    method: 'POST',
    body,
  });
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Added ${data.data.id}`));
  console.log(chalk.dim(`  ${data.data.url}`));
  console.log();
}

export async function prospectPhotosRemove(
  id: string,
  photoId: string,
  options: { json?: boolean }
) {
  const spinner = createSpinner('Deleting photo...').start();
  const data = await apiRequest<{ data: { deleted: boolean; id: string } }>(
    `/prospects/${id}/photos/${photoId}`,
    {
      method: 'DELETE',
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(chalk.green(`✓ Deleted ${data.data.id}`));
  console.log();
}

// ============================================================================
// Tags on a prospect
// ============================================================================

type Tag = {
  id: string;
  name: string;
  badge_variant: string;
  is_system: boolean;
  assigned?: boolean;
  usage_count?: number;
};

export async function prospectTagsList(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching tags...').start();
  const data = await apiRequest<{ data: Tag[] }>(`/prospects/${id}/tags`);
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  printHeader(`Tags on ${id}`);
  console.log();
  printTable(
    data.data.map((tag) => ({
      id: tag.id,
      name: tag.name,
      assigned: tag.assigned ? '✓' : '',
      color: tag.badge_variant,
      builtin: tag.is_system ? 'yes' : '',
    })),
    ['id', 'name', 'assigned', 'color', 'builtin']
  );
  console.log();
}

export async function prospectTagsSet(
  id: string,
  options: { ids: string; json?: boolean }
): Promise<void> {
  const spinner = createSpinner('Setting tags...').start();
  const data = await apiRequest<{ data: { tags: Tag[]; added: string[]; removed: string[] } }>(
    `/prospects/${id}/tags`,
    { method: 'PUT', body: { tag_ids: splitIds(options.ids) } }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(
    chalk.green(
      `✓ ${data.data.tags.map((tag) => tag.name).join(', ') || 'No tags'} (added ${data.data.added.length}, removed ${data.data.removed.length})`
    )
  );
  console.log();
}

export async function prospectTagsAdd(id: string, tagId: string, options: { json?: boolean }) {
  const spinner = createSpinner('Adding tag...').start();
  const data = await apiRequest<{ data: { changed: boolean; tag: Tag } }>(
    `/prospects/${id}/tags/${tagId}`,
    {
      method: 'POST',
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(
    chalk.green(
      data.data.changed
        ? `✓ Added "${data.data.tag.name}"`
        : `"${data.data.tag.name}" was already on ${id}`
    )
  );
  console.log();
}

export async function prospectTagsRemove(id: string, tagId: string, options: { json?: boolean }) {
  const spinner = createSpinner('Removing tag...').start();
  const data = await apiRequest<{ data: { changed: boolean; tag: Tag } }>(
    `/prospects/${id}/tags/${tagId}`,
    {
      method: 'DELETE',
    }
  );
  spinner.stop();
  if (options.json) {
    printJson(data);
    return;
  }
  console.log(
    chalk.green(
      data.data.changed
        ? `✓ Removed "${data.data.tag.name}"`
        : `"${data.data.tag.name}" was not on ${id}`
    )
  );
  console.log();
}
