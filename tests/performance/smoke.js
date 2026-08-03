import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const api = __ENV.PROMPTLENS_API_URL || 'http://127.0.0.1:4000/v1';
const origin = __ENV.PROMPTLENS_WEB_ORIGIN || 'http://localhost:3000';

export const options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: Number(__ENV.K6_VUS || 3),
      iterations: Number(__ENV.K6_ITERATIONS || 30),
      maxDuration: __ENV.K6_MAX_DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
  },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function jsonHeaders(extra = {}) {
  return { headers: { 'Content-Type': 'application/json', ...extra } };
}

export function setup() {
  const email = `load-${uuid()}@example.test`;
  const registration = http.post(
    `${api}/auth/register`,
    JSON.stringify({
      email,
      password: 'Load-Smoke-Password-42!',
      displayName: 'Load Smoke',
      tenantName: 'Load Smoke Workspace',
    }),
    jsonHeaders(),
  );
  check(registration, { 'load user registered': (response) => response.status === 201 });
  if (registration.status !== 201) {
    fail(`load user registration failed: ${registration.status} ${registration.body}`);
  }
  const session = registration.cookies.promptlens_session[0].value;
  const sessionHeaders = {
    Cookie: `promptlens_session=${session}`,
    Origin: origin,
  };
  const projects = http.get(`${api}/projects`, jsonHeaders({ Cookie: sessionHeaders.Cookie }));
  const projectId = projects.json()[0].id;
  const authorization = http.post(
    `${api}/connectors/device/authorization`,
    JSON.stringify({ platform: 'k6', displayName: 'k6 load smoke', protocolVersion: '1.0' }),
    jsonHeaders({ Origin: origin }),
  );
  const device = authorization.json();
  const approval = http.post(
    `${api}/connectors/device/approve`,
    JSON.stringify({ userCode: device.userCode, projectId }),
    jsonHeaders(sessionHeaders),
  );
  if (approval.status !== 204)
    console.error(`support setup approval failed: ${approval.status} ${approval.body}`);
  check(approval, { 'load connector approved': (response) => response.status === 204 });
  const token = http.post(
    `${api}/connectors/device/token`,
    JSON.stringify({ deviceCode: device.deviceCode }),
    jsonHeaders({ Origin: origin }),
  );
  if (token.status !== 200)
    console.error(`support setup token failed: ${token.status} ${token.body}`);
  check(token, { 'load connector authorized': (response) => response.status === 200 });
  return { accessToken: token.json().accessToken, projectId, session };
}

export default function (data) {
  const marker = `load-${__VU}-${__ITER}-${uuid()}`;
  const ingest = http.post(
    `${api}/ingest/prompts`,
    JSON.stringify({
      clientEventId: uuid(),
      projectId: data.projectId,
      content: `Create a measurable production test plan. Marker: ${marker}`,
      platform: 'k6',
      model: 'load-smoke',
      occurredAt: new Date().toISOString(),
      timezone: 'UTC',
      tags: ['performance'],
    }),
    jsonHeaders({ Authorization: `Bearer ${data.accessToken}`, Origin: origin }),
  );
  check(ingest, { 'prompt accepted': (response) => response.status === 202 });
  const search = http.get(
    `${api}/prompts?q=${encodeURIComponent(marker)}`,
    jsonHeaders({ Cookie: `promptlens_session=${data.session}` }),
  );
  check(search, { 'search succeeds': (response) => response.status === 200 });
  sleep(0.1);
}
