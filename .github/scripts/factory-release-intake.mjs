// Generated from Factory staging intake. Source SHA256: 7ef6161ca1c9aca6af23c8742bb5db246697ea32f6edb611c4acc5d7a64711b9
/** Reads only GitHub metadata. The same collector runs in each owning repository and in recovery. */
export async function collectStaging(repository, token, deploymentWorkflow, recoveryCheck = null) {
    const get = async (path) => {
        const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            redirect: 'error', signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok)
            throw new Error(`GitHub staging read failed (${response.status}).`);
        return response.json();
    };
    const [stage, production] = await Promise.all([get('branches/staging'), get('branches/master')]);
    const stagingSha = stage.commit.sha;
    const contains = async (ancestor, head) => {
        if (ancestor === head)
            return true;
        const comparison = await get(`compare/${ancestor}...${head}`);
        return ['ahead', 'identical'].includes(comparison.status);
    };
    const pullRequests = [];
    const resolved = [];
    for (let page = 1;; page++) {
        const rows = await get(`pulls?state=closed&base=staging&sort=updated&direction=desc&per_page=100&page=${page}`);
        for (const pr of rows) {
            if (!pr.merged_at || !pr.merge_commit_sha || pr.base?.ref !== 'staging')
                continue;
            if (!await contains(pr.merge_commit_sha, stagingSha)) {
                resolved.push({ number: pr.number, disposition: 'removed-from-staging' });
                continue;
            }
            if (await contains(pr.merge_commit_sha, production.commit.sha)) {
                resolved.push({ number: pr.number, disposition: 'on-master' });
                continue;
            }
            pullRequests.push({ number: pr.number, title: pr.title, body: (pr.body ?? '').slice(0, 20000), headRef: pr.head.ref,
                mergeSha: pr.merge_commit_sha, mergedAt: pr.merged_at });
        }
        if (rows.length < 100)
            break;
        if (page >= 20)
            throw new Error('Staging PR history exceeds the reconciliation limit. An owner must partition the history.');
    }
    let deployment = null;
    if (deploymentWorkflow) {
        const { workflow_runs: runs } = await get(`actions/workflows/${deploymentWorkflow}/runs?branch=staging&per_page=30`);
        const run = runs.find((r) => r.head_branch === 'staging' && r.head_sha === stagingSha && ['push', 'workflow_dispatch'].includes(r.event));
        if (run)
            deployment = { runId: String(run.id), headSha: run.head_sha, status: run.status, conclusion: run.conclusion,
                url: `https://github.com/${repository}/actions/runs/${run.id}`, updatedAt: run.updated_at };
    }
    if (recoveryCheck) {
        // This unique job belongs to the reviewed staging deployer. Recovery's GitHub App has
        // Checks read, but no Actions access. Check suites independently bind the exact branch.
        const { check_runs: checks } = await get(`commits/${stagingSha}/check-runs?per_page=100`);
        for (const check of checks) {
            if (check.name !== recoveryCheck || check.app?.slug !== 'github-actions' || check.head_sha !== stagingSha)
                continue;
            const suite = await get(`check-suites/${check.check_suite.id}`);
            const run = new RegExp(`^https://github\\.com/${repository}/actions/runs/(\\d+)/job/\\d+$`).exec(check.details_url ?? '');
            if (!run || suite.head_branch !== 'staging' || suite.head_sha !== stagingSha || suite.app?.slug !== 'github-actions')
                continue;
            if (!deployment || deployment.runId === run[1])
                deployment = { runId: run[1], headSha: stagingSha, status: check.status, conclusion: check.conclusion,
                    url: `https://github.com/${repository}/actions/runs/${run[1]}`, updatedAt: check.completed_at ?? check.started_at ?? new Date().toISOString() };
            break;
        }
    }
    // A moving source cannot produce an internally inconsistent snapshot.
    const [current, currentProduction] = await Promise.all([get('branches/staging'), get('branches/master')]);
    if (current.commit.sha !== stagingSha || currentProduction.commit.sha !== production.commit.sha)
        throw new Error('Source moved during reconciliation. Retry on the next run.');
    return { repository, branch: 'staging', stagingSha, productionSha: production.commit.sha, observedAt: new Date().toISOString(), deployment, pullRequests, resolved };
}

// Appended to the compiled staging collector by scripts/sync-staging-intake.mjs.
const endpoint = 'https://factory-rover-81024286635.us-west1.run.app/github/staging-intake';
async function sendObservation(payload) {
  const request = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  request.searchParams.set('audience', 'https://factory.dealmachine.com/staging-intake');
  const identity = await fetch(request, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(20000) });
  if (!identity.ok) throw new Error(`GitHub identity request failed (${identity.status}).`);
  const { value } = await identity.json();
  if (!value) throw new Error('GitHub did not return an intake identity.');
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > 500000) throw new Error('The staging observation exceeds the intake request limit.');
  const result = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(60000) });
  if (!result.ok) throw new Error(`Factory staging intake failed (${result.status}); the scheduled reconciliation will retry.`);
}
try {
  if (process.env.FACTORY_INTAKE_MODE === 'reconcile') await sendObservation({ reconcile: true });
  else {
    const observed = await collectStaging(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN, process.env.FACTORY_DEPLOYMENT_WORKFLOW || null, process.env.FACTORY_DEPLOYMENT_CHECK || null);
    for (let offset = 0; offset < observed.pullRequests.length || offset === 0; offset += 10)
      await sendObservation({ ...observed, pullRequests: observed.pullRequests.slice(offset, offset + 10) });
    console.log(`Recorded ${observed.pullRequests.length} unpromoted staging PRs.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
