import { Option, type Command } from 'commander';

/**
 * The web export screen's column options (WORK-21135) as export Command
 * flags. Each flag sets the matching export request setting; leaving them out
 * keeps the export's existing columns. A --body or --file value wins over a
 * flag that is left out.
 */
export interface ExportColumnCliOptions {
  addressFormat?: string;
  personAddress?: string;
  phoneActivity?: boolean;
  phoneMatchConfidence?: boolean;
  emailMatchConfidence?: boolean;
  emailVerificationStatus?: boolean;
}

const ADDRESS_FORMATS = ['full', 'parsed'];

export function addExportColumnOptions(command: Command, source: 'properties' | 'people'): Command {
  command.addOption(
    new Option(
      '--address-format <format>',
      source === 'properties'
        ? 'Property address as one column (full, default) or as street, city, state, ZIP and county columns (parsed)'
        : 'Person address as one column (full, default) or as street, city, state and ZIP columns (parsed)'
    ).choices(ADDRESS_FORMATS)
  );
  if (source === 'properties') {
    command.addOption(
      new Option(
        '--person-address <format>',
        "Add each contact's home address as one column (full) or as street, city, state and ZIP columns (parsed)"
      ).choices(ADDRESS_FORMATS)
    );
  }
  return command
    .option(
      '--phone-activity',
      'Add is_phone_1_active to is_phone_3_active (Yes or No). Not available on V2 yet'
    )
    .option('--phone-match-confidence', 'Add each phone match confidence, 0 to 100 (contact rows)')
    .option('--email-match-confidence', 'Add each email match confidence, 0 to 100 (contact rows)')
    .option('--email-verification-status', 'Add each email verification status (contact rows)');
}

export function applyExportColumnOptions(
  requestBody: Record<string, unknown>,
  options: ExportColumnCliOptions
): void {
  for (const [flag, value] of [
    ['--address-format', options.addressFormat],
    ['--person-address', options.personAddress],
  ] as const) {
    if (value !== undefined && !ADDRESS_FORMATS.includes(value)) {
      throw new Error(`${flag} must be full or parsed`);
    }
  }
  if (options.addressFormat) requestBody.address_format = options.addressFormat;
  if (options.personAddress) requestBody.person_address = options.personAddress;
  if (options.phoneActivity) requestBody.include_phone_activity = true;
  if (options.phoneMatchConfidence) requestBody.include_phone_match_confidence = true;
  if (options.emailMatchConfidence) requestBody.include_email_match_confidence = true;
  if (options.emailVerificationStatus) requestBody.include_email_verification_status = true;
}
