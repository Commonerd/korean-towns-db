/* ID 기반 노드 색인과 관계 해석 */
import { nodeHref } from './collections.js';
import { translate, translateType, localized } from '$lib/i18n/translations.js';

export function splitList(raw) {
	if (!raw) return [];
	return String(raw).split(',').map((value) => value.trim()).filter(Boolean);
}

export function buildIndex(nodes) {
	const byType = new Map();
	const byTypeId = new Map();
	const byPath = new Map();
	const childrenByTown = new Map();
	for (const node of nodes) {
		if (!byType.has(node.type)) byType.set(node.type, []);
		byType.get(node.type).push(node);
		if (node.externalId) byTypeId.set(`${node.type}:${node.externalId}`, node);
		const href = nodeHref(node);
		if (href) byPath.set(href, node);
	}
	for (const node of nodes) {
		if (node.type === '마을') continue;
		for (const townId of node.relatedTownIds || []) {
			if (!childrenByTown.has(townId)) childrenByTown.set(townId, []);
			childrenByTown.get(townId).push(node);
		}
	}
	return { nodes, byType, byTypeId, byPath, childrenByTown };
}

export function nodesOfType(index, type) {
	return index.byType.get(type) ?? [];
}

export function findByTypeId(index, type, externalId) {
	return index.byTypeId.get(`${type}:${externalId}`) ?? null;
}

function resolveIds(index, type, ids, locale) {
	return (ids || []).map((externalId) => {
		const node = findByTypeId(index, type, externalId);
		return { name: node ? localized(node, 'name', locale) : externalId, href: node ? nodeHref(node) : null, type };
	});
}

function toLinks(nodes, locale) {
	return nodes.map((node) => ({ name: localized(node, 'name', locale), href: nodeHref(node), type: node.type }));
}

export function relationsFor(node, index, locale = 'ko') {
	const groups = [];
	const tr = (key, params) => translate(locale, key, params);
	if (node.type === '마을') {
		const children = index.childrenByTown.get(node.townId) ?? [];
		for (const [type, key] of [['조직', 'arch.rel.orgsOfTown'], ['인물', 'arch.rel.personsOfTown'], ['사건', 'arch.rel.eventsOfTown']]) {
			const items = toLinks(children.filter((child) => child.type === type), locale);
			if (items.length) groups.push({ label: tr(key), items });
		}
		return groups;
	}
	const towns = resolveIds(index, '마을', node.relatedTownIds, locale);
	if (towns.length) groups.push({ label: tr('arch.rel.towns'), items: towns });
	const orgs = resolveIds(index, '조직', node.relatedOrgIds, locale);
	if (orgs.length) groups.push({ label: tr('arch.rel.orgs'), items: orgs });
	const persons = resolveIds(index, '인물', node.relatedPersonIds, locale);
	if (persons.length) groups.push({ label: tr('arch.rel.persons'), items: persons });
	if (node.relatedTownId) {
		const siblings = (index.childrenByTown.get(node.relatedTownId) ?? []).filter((item) => item.id !== node.id);
		if (siblings.length) {
			const townNode = findByTypeId(index, '마을', node.relatedTownId);
			const townLabel = townNode ? localized(townNode, 'name', locale) : node.relatedTownId;
			groups.push({ label: tr('arch.rel.siblings', { town: townLabel }), items: toLinks(siblings.slice(0, 24), locale), more: siblings.length > 24 ? siblings.length - 24 : 0 });
		}
	}
	return groups;
}

export function yearRangeText(node) {
	const from = (node.founded || '').trim();
	const to = (node.dissolved || '').trim();
	if (from && to) return `${from}–${to}`;
	if (from) return `${from}~`;
	if (to) return `~${to}`;
	return '';
}

export function summarize(node, max = 155, locale = 'ko') {
	const base = localized(node, 'description', locale).replace(/\s+/g, ' ').trim();
	if (base) return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
	const bits = [translateType(locale, node.type, node.settlementType), yearRangeText(node), node.address, node.relatedTown].filter(Boolean);
	return `${localized(node, 'name', locale)} — ${bits.join(' · ')}`.slice(0, max);
}
