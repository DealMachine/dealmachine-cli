import chalk from 'chalk';
import { apiRequest, formatDate } from '../lib/client.js';
import { createSpinner, printHeader, printJson, printKeyValue, printTable } from '../lib/output.js';

type Drive = {
  id: string;
  source: string;
  mode: string;
  name: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  driver: { user_id: number | null; name: string };
  distance_meters: number | null;
  duration_seconds: number | null;
  prospects_added_count: number;
};

type DriveDetail = {
  id: string;
  source: string;
  route: unknown;
  events: unknown[];
  visits: unknown[];
  prospects: Array<{
    prospect_id: string | null;
    record_id: string;
    lifecycle: string | null;
    source: string | null;
    added_at: string;
    record: { address: string | null };
  }>;
};

type Pagination = { page: number; per_page: number; total: number; has_more: boolean };

export async function drivingList(options: {
  driverUserId?: string;
  mode?: string;
  startedAfter?: string;
  startedBefore?: string;
  page?: string;
  perPage?: string;
  json?: boolean;
}): Promise<void> {
  const spinner = createSpinner('Fetching drives...').start();
  const response = await apiRequest<{ data: Drive[]; pagination: Pagination }>('/driving/drives', {
    query: {
      driver_user_id: options.driverUserId ? Number.parseInt(options.driverUserId, 10) : undefined,
      mode: options.mode,
      started_after: options.startedAfter,
      started_before: options.startedBefore,
      page: options.page ? Number.parseInt(options.page, 10) : undefined,
      per_page: options.perPage ? Number.parseInt(options.perPage, 10) : undefined,
    },
  });
  spinner.stop();

  if (options.json) {
    printJson(response);
    return;
  }

  printHeader('Driving History');
  console.log();
  if (response.data.length === 0) {
    console.log(chalk.dim('  No drives found.'));
  } else {
    printTable(
      response.data.map((drive) => ({
        id: drive.id,
        date: formatDate(drive.started_at),
        driver: drive.driver.name,
        mode: drive.mode,
        status: drive.status,
        prospects: drive.prospects_added_count,
      })),
      ['id', 'date', 'driver', 'mode', 'status', 'prospects']
    );
  }
  console.log();
  console.log(
    chalk.dim(
      `Page ${response.pagination.page}. ${response.pagination.total} total${
        response.pagination.has_more ? ' (more available)' : ''
      }`
    )
  );
  console.log();
}

export async function drivingGet(id: string, options: { json?: boolean }): Promise<void> {
  const spinner = createSpinner('Fetching drive...').start();
  const response = await apiRequest<{ data: DriveDetail }>(`/driving/drives/${id}`);
  spinner.stop();

  if (options.json) {
    printJson(response);
    return;
  }

  const drive = response.data;
  printHeader(`Drive ${drive.id}`);
  printKeyValue({
    Source: drive.source,
    Events: String(drive.events.length),
    Visits: String(drive.visits.length),
    Prospects: String(drive.prospects.length),
  });
  if (drive.prospects.length > 0) {
    console.log();
    printTable(
      drive.prospects.map((prospect) => ({
        prospect: prospect.prospect_id ?? '',
        record: prospect.record_id,
        address: prospect.record.address ?? '',
        lifecycle: prospect.lifecycle ?? '',
        added: formatDate(prospect.added_at),
      })),
      ['prospect', 'record', 'address', 'lifecycle', 'added']
    );
  }
  console.log();
}
