/**
 * Comps command — find comparable properties for sale analysis
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiRequest } from '../lib/client.js';
import {
  parseRequestBody,
  printJson,
  printHeader,
  printTable,
  printCredits,
  printKeyValue,
  truncate,
} from '../lib/output.js';

// ============================================================================
// Types
// ============================================================================

interface CompsResponse {
  data: Array<{
    dm_property_id: string;
    found: boolean;
    subject?: Record<string, unknown>;
    comps?: Record<string, unknown>[];
    summary?: Record<string, unknown>;
    value_estimation?: Record<string, unknown>;
    total_comps_found?: number;
  }>;
  credits: { used: number; properties: number; deduplicated: number };
}

// ============================================================================
// Comps Command
// ============================================================================

export async function comps(
  propertyIds: string[],
  options: {
    body?: string;
    file?: string;
    radius?: string;
    timeframe?: string;
    limit?: string;
    sortBy?: string;
    sortDirection?: string;
    includeForeclosures?: boolean;
    includeActiveListings?: boolean;
    json?: boolean;
  }
): Promise<void> {
  let requestBody: Record<string, unknown>;

  // If --body or -f provided, use that directly
  if (options.body || options.file) {
    requestBody = await parseRequestBody(options);
  } else {
    // Build request from CLI options
    if (!propertyIds || propertyIds.length === 0) {
      console.error(chalk.red('Error: At least one property ID is required.'));
      console.log(chalk.dim('Usage: dm comps prop_12345 [prop_67890 ...]'));
      process.exit(1);
    }

    requestBody = { property_ids: propertyIds };

    // Build location from --radius
    if (options.radius) {
      requestBody.location = {
        type: 'radius',
        radius_miles: parseFloat(options.radius),
      };
    }

    // Build criteria from flags
    const criteria: Record<string, unknown> = {};
    if (options.timeframe) criteria.timeframe = options.timeframe;
    if (options.limit) criteria.limit = parseInt(options.limit, 10);
    if (options.sortBy) criteria.sort_by = options.sortBy;
    if (options.sortDirection) criteria.sort_direction = options.sortDirection;
    if (options.includeForeclosures) criteria.include_foreclosures = true;
    if (options.includeActiveListings !== undefined) {
      criteria.include_active_listings = options.includeActiveListings;
    }

    if (Object.keys(criteria).length > 0) {
      requestBody.criteria = criteria;
    }
  }

  const spinner = ora('Finding comparable properties...').start();
  const data = await apiRequest<CompsResponse>('/comps', {
    method: 'POST',
    body: requestBody,
  });
  spinner.stop();

  if (options.json) {
    printJson(data);
    return;
  }

  // Pretty print results
  for (const result of data.data) {
    printHeader(`Comps for ${result.dm_property_id}`);

    if (!result.found) {
      console.log(chalk.dim('  Property not found'));
      continue;
    }

    // Subject info
    if (result.subject) {
      const s = result.subject as Record<string, any>;
      console.log(chalk.bold('  Subject Property'));
      printKeyValue({
        address: s.address || s.display_line_1 || '—',
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms,
        sqft: s.sqft,
        estimated_value: s.estimated_value ? `$${Number(s.estimated_value).toLocaleString()}` : '—',
      }, 4);
    }

    // Value estimation
    if (result.value_estimation) {
      const ve = result.value_estimation as Record<string, any>;
      if (ve.estimated_value > 0) {
        console.log();
        console.log(chalk.bold('  Value Estimation'));
        const ci = ve.confidence_interval || {};
        printKeyValue({
          estimated_value: `$${Number(ve.estimated_value).toLocaleString()}`,
          range: ci.low && ci.high
            ? `$${Number(ci.low).toLocaleString()} — $${Number(ci.high).toLocaleString()}`
            : '—',
          methodology: ve.methodology || '—',
          based_on: `${ve.based_on_comps || 0} comps`,
        }, 4);
      }
    }

    // Summary stats
    if (result.summary) {
      const sm = result.summary as Record<string, any>;
      console.log();
      console.log(chalk.bold('  Summary'));
      printKeyValue({
        comps_found: sm.count || 0,
        avg_price: sm.avg_price ? `$${Number(sm.avg_price).toLocaleString()}` : '—',
        median_price: sm.median_price ? `$${Number(sm.median_price).toLocaleString()}` : '—',
        avg_price_per_sqft: sm.avg_price_per_sqft ? `$${sm.avg_price_per_sqft}/sqft` : '—',
        avg_distance: sm.avg_distance ? `${sm.avg_distance} mi` : '—',
        confidence: sm.confidence_level || '—',
      }, 4);
    }

    // Comps table
    if (result.comps && result.comps.length > 0) {
      console.log();
      console.log(chalk.bold(`  Comps (${result.total_comps_found || result.comps.length})`));
      const compRows = (result.comps as Record<string, any>[]).map((comp) => ({
        id: comp.dm_property_id || '—',
        type: comp.type || '—',
        address: truncate(comp.display_line_1 || comp.address || '—', 30),
        price: comp.type === 'sale'
          ? (comp.sale_price ? `$${Number(comp.sale_price).toLocaleString()}` : '—')
          : (comp.listing_price ? `$${Number(comp.listing_price).toLocaleString()}` : '—'),
        '$/sqft': comp.price_per_sqft ? `$${Math.round(comp.price_per_sqft)}` : '—',
        distance: comp.distance != null ? `${comp.distance} mi` : '—',
        score: comp.match_score?.overall != null ? `${comp.match_score.overall}` : '—',
      }));

      printTable(compRows, ['id', 'type', 'address', 'price', '$/sqft', 'distance', 'score']);
    }

    console.log();
  }

  printCredits(data.credits);
}
