import fs from 'fs';
import axios from 'axios';
import * as core from '@actions/core';

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = 'cloudx-io/setup-go';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';
  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

// Record the job start time and configured retention window for trim.js (the
// post step). Entries used by this run will have mtimes at or after this
// instant, modulo Go's touch granularity — see the cutoff slack in trim.js.

const DEFAULT_MAX_STALENESS_HOURS = 2;
const HOUR_MS = 60 * 60 * 1000;
const MAX_STALENESS_HOURS = Math.floor(Number.MAX_SAFE_INTEGER / HOUR_MS);
const rawMaxStalenessHours = process.env.INPUT_MAX_STALENESS_HOURS ??
  process.env['INPUT_MAX-STALENESS-HOURS'] ??
  String(DEFAULT_MAX_STALENESS_HOURS);
const maxStalenessHours = Number(rawMaxStalenessHours);

if (!/^\d+$/.test(rawMaxStalenessHours) ||
    !Number.isSafeInteger(maxStalenessHours) ||
    maxStalenessHours > MAX_STALENESS_HOURS) {
  throw new Error('max-staleness-hours must be a non-negative integer number of hours that fits in a JavaScript timestamp');
}

await validateSubscription();
fs.appendFileSync(
  process.env.GITHUB_STATE,
  `startMs=${Date.now()}\nmaxStalenessHours=${maxStalenessHours}\n`,
);
