/* ====== 필터링 (기존 getFilteredData 이식, 순수 함수화) ====== */
export function filterData(rawData, opts) {
	const {
		filter = 'all',
		search = '',
		yearEnabled = false,
		yearMin = 1860,
		yearMax = 2026,
		yearRangeMin = 1860,
		yearRangeMax = 2026
	} = opts || {};

	return rawData.filter((item) => {
		const matchType = filter === 'all' || item.type === filter;
		const haystack = [
			item.name,
			item.description,
			item.relatedTown,
			item.address,
			item.orgType,
			item.nationality,
			item.job,
			item.relatedOrg,
			item.relatedPerson,
			item.eventType
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		const matchSearch = !search || haystack.includes(search);

		let matchYear = true;
		if (yearEnabled) {
			const founded = parseInt(item.founded) || null;
			const dissolved = parseInt(item.dissolved) || null;
			if (founded || dissolved) {
				const itemStart = founded || (dissolved ? dissolved - 50 : yearRangeMin);
				const itemEnd = dissolved || (founded ? founded + 50 : yearRangeMax);
				matchYear = itemStart <= yearMax && itemEnd >= yearMin;
			}
		}
		return matchType && matchSearch && matchYear;
	});
}
