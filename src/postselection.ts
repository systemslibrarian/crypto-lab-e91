// Exact, small local-hidden-variable example of the detection loophole.
// Each source instruction λ fixes both parties' outputs and detector responses
// before either measurement setting is chosen. A detector knows only its own
// setting and λ. The eight equally weighted instructions include a global sign
// to keep each retained party's marginal balanced.

export interface PostselectionRow {
	aliceSetting: number;
	bobSetting: number;
	issued: number;
	coincidences: number;
	correlation: number;
}

export interface PostselectionResult {
	rows: PostselectionRow[];
	S: number;
	coincidenceFraction: number;
}

export function localDetectionExample(selective: boolean): PostselectionResult {
	const rows: PostselectionRow[] = [];
	for (let aliceSetting = 0; aliceSetting < 2; aliceSetting++) {
		for (let bobSetting = 0; bobSetting < 2; bobSetting++) {
			let coincidences = 0;
			let products = 0;
			for (let assignedAlice = 0; assignedAlice < 2; assignedAlice++) {
				for (let assignedBob = 0; assignedBob < 2; assignedBob++) {
					for (const sign of [-1, 1]) {
						const aliceClicks = !selective || assignedAlice === aliceSetting;
						const bobClicks = !selective || assignedBob === bobSetting;
						if (!aliceClicks || !bobClicks) continue;
						// A0 = A1 = sign; B0 = sign; B1 depends only on λ.
						const alice = sign;
						const bob = bobSetting === 0 ? sign : sign * (assignedAlice === 0 ? 1 : -1);
						products += alice * bob;
						coincidences++;
					}
				}
			}
			rows.push({ aliceSetting, bobSetting, issued: 8, coincidences,
				correlation: products / coincidences });
		}
	}
	const [e00, e01, e10, e11] = rows.map((r) => r.correlation);
	return {
		rows,
		S: e00! + e01! + e10! - e11!,
		coincidenceFraction: rows.reduce((sum, row) => sum + row.coincidences, 0) / 32,
	};
}
