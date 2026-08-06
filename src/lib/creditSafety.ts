import { isQuiet } from './output.js';

export interface CreditSafetyOptions {
  estimateCost?: boolean;
  yes?: boolean;
  json?: boolean;
}

export interface CreditSafetyResult {
  isEstimate: boolean;
  wasAutomaticallyEstimated: boolean;
}

/**
 * Protect agent and scripted calls from accidental credit spend.
 * Interactive users keep the existing behavior. Non-interactive callers must
 * explicitly pass --yes or they receive the API's free estimate response.
 */
export function applyCreditSafety(
  requestBody: Record<string, unknown>,
  options: CreditSafetyOptions
): CreditSafetyResult {
  if (options.estimateCost) requestBody.estimate_cost = true;

  const requestedEstimate = requestBody.estimate_cost === true;
  const nonInteractive =
    options.json === true ||
    isQuiet() ||
    process.env.DM_AGENT === '1' ||
    process.env.CI === 'true' ||
    process.stdin.isTTY !== true ||
    process.stdout.isTTY !== true;

  if (!requestedEstimate && !options.yes && nonInteractive) {
    requestBody.estimate_cost = true;
    return { isEstimate: true, wasAutomaticallyEstimated: true };
  }

  return {
    isEstimate: requestedEstimate,
    wasAutomaticallyEstimated: false,
  };
}

export function printAutomaticEstimateNotice(command: string): void {
  console.error(
    `No credits were spent. Review estimated_credits, get the user's approval, then rerun ${command} with --yes.`
  );
}
