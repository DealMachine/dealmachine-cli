import { execSync } from 'child_process';

const CONTAINER = 'dealmachine-next-mysql';
const DB_USER = 'dealmachine';
const DB_PASS = 'dealmachine';
const DB_NAME = 'next_dev';

function sql(query: string): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER} mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -e ${JSON.stringify(query)} --batch --skip-column-names`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();
  } catch (err: any) {
    throw new Error(`MySQL error: ${err.stderr?.toString() || err.message}`);
  }
}

function sqlWithHeaders(query: string): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER} mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME} -e ${JSON.stringify(query)} --batch`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();
  } catch (err: any) {
    throw new Error(`MySQL error: ${err.stderr?.toString() || err.message}`);
  }
}

export async function licenseAdd(keyId: string, options: {
  type: string;
  code?: string;
  expires?: string;
}) {
  const { type, code, expires } = options;

  const validTypes = ['state', 'county', 'zip_code', 'unlimited'];
  if (!validTypes.includes(type)) {
    console.error(`Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  if (type !== 'unlimited' && !code) {
    console.error(`--code is required for type "${type}"`);
    process.exit(1);
  }

  if (type === 'unlimited' && code) {
    console.error('--code should not be set for unlimited licenses');
    process.exit(1);
  }

  // Verify the key exists
  const keyExists = sql(`SELECT COUNT(*) FROM api_keys WHERE key_id = '${keyId}' AND revoked_at IS NULL`);
  if (keyExists === '0') {
    console.error(`No active API key found with key_id: ${keyId}`);
    process.exit(1);
  }

  const codeValue = code ? `'${code}'` : 'NULL';
  const expiresValue = expires ? `'${expires}'` : 'NULL';

  sql(
    `INSERT INTO api_key_licenses (key_id, location_type, location_code, expires_at)
     VALUES ('${keyId}', '${type}', ${codeValue}, ${expiresValue})`
  );

  const newId = sql(`SELECT MAX(id) FROM api_key_licenses WHERE key_id = '${keyId}'`);

  console.log('');
  console.log('  License created');
  console.log('  ───────────────────────────────────');
  console.log(`  ID:       ${newId}`);
  console.log(`  Key ID:   ${keyId}`);
  console.log(`  Type:     ${type}`);
  console.log(`  Code:     ${code ?? '(unlimited)'}`);
  console.log(`  Expires:  ${expires ?? 'never'}`);
  console.log('');
}

export async function licenseList(keyId?: string) {
  let query = `SELECT id, key_id, location_type, location_code, is_active, expires_at, created_at FROM api_key_licenses`;
  if (keyId) {
    query += ` WHERE key_id = '${keyId}'`;
  }
  query += ' ORDER BY id DESC';

  const result = sqlWithHeaders(query);

  if (!result) {
    console.log('  No licenses found.');
    return;
  }

  const lines = result.split('\n');
  if (lines.length <= 1) {
    console.log('  No licenses found.');
    return;
  }

  // Print as formatted table
  console.log('');
  const header = lines[0].split('\t');
  const widths = header.map((h) => Math.max(h.length, 12));

  // Update widths based on data
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    for (let j = 0; j < cols.length; j++) {
      widths[j] = Math.max(widths[j] || 0, (cols[j] || '').length);
    }
  }

  const formatRow = (cols: string[]) =>
    cols.map((c, i) => (c || '').padEnd(widths[i] || 12)).join('  ');

  console.log('  ' + formatRow(header));
  console.log('  ' + widths.map((w) => '─'.repeat(w)).join('──'));
  for (let i = 1; i < lines.length; i++) {
    console.log('  ' + formatRow(lines[i].split('\t')));
  }
  console.log('');
}

export async function licenseRemove(licenseId: string) {
  const exists = sql(`SELECT COUNT(*) FROM api_key_licenses WHERE id = ${licenseId}`);
  if (exists === '0') {
    console.error(`No license found with ID: ${licenseId}`);
    process.exit(1);
  }

  sql(`DELETE FROM api_key_licenses WHERE id = ${licenseId}`);
  console.log(`  License ${licenseId} deleted.`);
}
