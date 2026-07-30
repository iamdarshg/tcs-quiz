import assert from 'node:assert/strict';
import test from 'node:test';

import { getModule } from '../assets/js/tcs-data.js';
import { resolveTopicRoute } from '../assets/js/topic-route.js';

test('a retained map topic link resolves to its TCS module fact', async () => {
  const module = await getModule('module-01');
  const topic = module.topics[0];

  assert.deepEqual(resolveTopicRoute(`#/topic/${topic.id}`, [module]), {
    module,
    topic
  });
});

test('an unavailable legacy topic link resolves to a recoverable miss', async () => {
  const module = await getModule('module-01');
  assert.equal(resolveTopicRoute('#/topic/legacy-topic-id', [module]), null);
});
