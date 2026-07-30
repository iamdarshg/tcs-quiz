import assert from 'node:assert/strict';
import test from 'node:test';

import { getModule, getModuleManifest } from '../assets/js/tcs-data.js';
import { buildTcsMapCorpus, topicWithTcsConnections } from '../assets/js/tcs-map.js';

test('retained map corpus contains only routable TCS module topics', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id)));
  const corpus = buildTcsMapCorpus(modules);
  const knownIds = new Set(modules.flatMap((module) => module.topics.map((topic) => topic.id)));

  assert.equal(corpus.sections.length, 15);
  assert.equal(corpus.topics.length, 90);
  assert.ok(corpus.sections.every((section) => section.kind === 'module'));
  assert.ok(corpus.topics.every((topic) => topic.kind === 'module'));
  assert.ok(corpus.topics.every((topic) => topic.map.connections.length >= 2));
  assert.ok(corpus.topics.every((topic) => topic.refs.length === topic.map.connections.length));
  assert.ok(corpus.topics.flatMap((topic) => topic.refs).every((id) => knownIds.has(id)));
});

test('topic map connection nodes link to actual TCS topic pages', async () => {
  const module = await getModule('module-01');
  const topic = topicWithTcsConnections(module, module.topics[0]);
  const knownIds = new Set(module.topics.map((item) => item.id));

  assert.ok(topic.map.nodes.length >= 2);
  assert.ok(topic.map.nodes.every((node) => knownIds.has(node.topicRef)));
  assert.ok(topic.map.nodes.every((node) => node.topicRef !== topic.id));
});

test('topic map uses only explicit factual connections from the topic data', () => {
  const module = {
    id: 'module-01',
    order: 1,
    label: 'Computing foundations',
    topics: [
      {
        id: 'source',
        rank: 1,
        title: 'Source',
        category: 'History',
        tags: ['shared'],
        map: {
          connections: [{
            topicId: 'related',
            relationship: 'Technical successor',
            fact: 'Related replaced Source in the documented processing chain.'
          }]
        }
      },
      { id: 'positional', rank: 2, title: 'Positional', category: 'History', tags: ['shared'] },
      { id: 'related', rank: 3, title: 'Related', category: 'Science', tags: ['other'] }
    ]
  };

  const topic = topicWithTcsConnections(module, module.topics[0]);

  assert.equal(topic.map.nodes.length, 1);
  assert.equal(topic.map.nodes[0].topicRef, 'related');
  assert.equal(topic.map.nodes[0].rel, 'Technical successor');
  assert.equal(topic.map.nodes[0].note, 'Related replaced Source in the documented processing chain.');
});
