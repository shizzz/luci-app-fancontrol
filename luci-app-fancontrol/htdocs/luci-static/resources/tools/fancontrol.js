'use strict';
'require baseclass';
'require fs';
'require uci';

const PWM_MAX = 255;
const HISTORY_LENGTH = 60;

const FanControl = baseclass.extend({
	PWM_MAX: PWM_MAX,
	HISTORY_LENGTH: HISTORY_LENGTH,

	pwmToPercent(value) {
		const pwm = parseInt(value, 10);
		if (isNaN(pwm))
			return null;

		return Math.max(0, Math.min(100, Math.round((pwm / PWM_MAX) * 100)));
	},

	async readTemperature(path) {
		const raw = await fs.trimmed(path);
		if (!raw)
			return null;

		const milli = parseInt(raw, 10);
		if (isNaN(milli))
			return null;

		return +(milli / 1000).toFixed(1);
	},

	async readPwmRaw(path) {
		const raw = await fs.trimmed(path);
		if (!raw)
			return null;

		const pwm = parseInt(raw, 10);
		return isNaN(pwm) ? null : pwm;
	},

	async readPwmPercent(path) {
		const pwm = await this.readPwmRaw(path);
		return pwm == null ? null : this.pwmToPercent(pwm);
	},

	async discoverThermalZones() {
		const zones = [];

		return L.resolveDefault(fs.list('/sys/class/thermal'), []).then(function(entries) {
			const names = entries
				.filter(function(entry) {
					return /^thermal_zone\d+$/.test(entry.name);
				})
				.map(function(entry) { return entry.name; })
				.sort(function(a, b) {
					return parseInt(a.replace(/\D+/g, ''), 10) - parseInt(b.replace(/\D+/g, ''), 10);
				});

			return Promise.all(names.map(function(name) {
				const base = '/sys/class/thermal/' + name;
				const path = base + '/temp';

				return Promise.all([
					L.resolveDefault(fs.stat(path), null),
					fs.trimmed(base + '/type')
				]).then(function(res) {
					if (!res[0])
						return null;

					return {
						path: path,
						label: res[1] || name,
						zone: name
					};
				});
			})).then(function(items) {
				items.forEach(function(item) {
					if (item)
						zones.push(item);
				});
				return zones;
			});
		});
	},

	async discoverPwmOutputs() {
		const outputs = [];

		return L.resolveDefault(fs.list('/sys/class/hwmon'), []).then(function(hwmons) {
			const dirs = hwmons
				.filter(function(entry) { return /^hwmon\d+$/.test(entry.name); })
				.map(function(entry) { return entry.name; })
				.sort(function(a, b) {
					return parseInt(a.replace(/\D+/g, ''), 10) - parseInt(b.replace(/\D+/g, ''), 10);
				});

			return Promise.all(dirs.map(function(hwmon) {
				const base = '/sys/class/hwmon/' + hwmon;

				return Promise.all([
					fs.list(base),
					fs.trimmed(base + '/name')
				]).then(function(res) {
					const entries = res[0] || [];
					const chipName = res[1] || hwmon;
					const pwms = entries
						.filter(function(entry) {
							return entry.type === 'file' && /^pwm\d+$/.test(entry.name);
						})
						.map(function(entry) { return entry.name; })
						.sort();

					return Promise.all(pwms.map(function(pwm) {
						const pwmPath = base + '/' + pwm;
						const enablePath = base + '/' + pwm + '_enable';

						return L.resolveDefault(fs.stat(enablePath), null).then(function(enableStat) {
							return {
								pwm_path: pwmPath,
								pwm_enable_path: enableStat ? enablePath : '',
								label: '%s / %s'.format(chipName, pwm),
								hwmon: hwmon,
								chip_name: chipName,
								pwm: pwm
							};
						});
					}));
				});
			})).then(function(nested) {
				nested.forEach(function(group) {
					(group || []).forEach(function(item) {
						if (item)
							outputs.push(item);
					});
				});
				return outputs;
			});
		});
	},

	sanitizeSectionName(name) {
		let section = String(name || '')
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '_')
			.replace(/^_+|_+$/g, '');

		if (section.endsWith('_thermal'))
			section = section.slice(0, -'_thermal'.length);

		if (!section)
			section = 'fan';

		return section;
	},

	uniqueSectionName(baseName) {
		const existing = uci.sections('fancontrol', 'fancontrol').map(function(section) {
			return section['.name'];
		});

		if (existing.indexOf(baseName) < 0)
			return baseName;

		for (let i = 2; i < 1000; i++) {
			const candidate = '%s_%d'.format(baseName, i);
			if (existing.indexOf(candidate) < 0)
				return candidate;
		}

		return '%s_%d'.format(baseName, Date.now());
	},

	async deriveSectionNameFromHwmon(hwmonPath) {
		const match = /^\/sys\/class\/hwmon\/(hwmon\d+)\//.exec(hwmonPath || '');
		if (!match)
			return 'fan';

		const name = await fs.trimmed('/sys/class/hwmon/%s/name'.format(match[1]));
		return this.uniqueSectionName(this.sanitizeSectionName(name));
	},

	async validateFanPaths(thermalPath, pwmPath, pwmEnablePath, checkWrite) {
		const warnings = [];

		async function checkPath(label, path, writable) {
			if (!path) {
				warnings.push(_('%s path is empty').format(label));
				return;
			}

			try {
				const stat = await fs.stat(path);
				if (!stat)
					warnings.push(_('%s path does not exist: %s').format(label, path));
				else if (writable && !(stat.mode & 0o200))
					warnings.push(_('%s path is not writable: %s').format(label, path));
			}
			catch (e) {
				warnings.push(_('%s path does not exist: %s').format(label, path));
			}
		}

		await checkPath(_('Thermal sensor'), thermalPath, false);
		await checkPath(_('PWM output'), pwmPath, !!checkWrite);
		await checkPath(_('PWM enable'), pwmEnablePath, !!checkWrite);

		return warnings;
	},

	isForceEnabled() {
		return uci.get('fancontrol', 'globals', 'force') == '1';
	},

	getFanSections() {
		return uci.sections('fancontrol', 'fancontrol');
	},

	getFanConfig(sectionId) {
		const section = uci.get('fancontrol', sectionId);
		if (!section)
			return null;

		return {
			id: sectionId,
			name: sectionId,
			enabled: section.enabled != '0',
			mode: section.mode || 'pid',
			setpoint: section.setpoint,
			kp: section.kp,
			ki: section.ki,
			kd: section.kd,
			min_pwm: section.min_pwm,
			max_pwm: section.max_pwm,
			fixed_pwm: section.fixed_pwm,
			interval_sec: section.interval_sec,
			thermal_path: section.thermal_path,
			pwm_path: section.pwm_path,
			pwm_enable_path: section.pwm_enable_path,
			dry_run: section.dry_run == '1',
			debug: section.debug == '1'
		};
	},

	drawDualChart(canvas, tempHistory, pwmHistory) {
		if (!canvas)
			return;

		const ctx = canvas.getContext('2d');
		const width = canvas.width;
		const height = canvas.height;
		const pad = 4;

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#f8f8f8';
		ctx.fillRect(0, 0, width, height);

		function drawSeries(data, color, maxValue) {
			if (!data.length)
				return;

			ctx.beginPath();
			ctx.strokeStyle = color;
			ctx.lineWidth = 1.5;

			data.forEach(function(value, index) {
				const x = pad + (index / Math.max(1, HISTORY_LENGTH - 1)) * (width - pad * 2);
				const y = height - pad - ((value / maxValue) * (height - pad * 2));

				if (index === 0)
					ctx.moveTo(x, y);
				else
					ctx.lineTo(x, y);
			});

			ctx.stroke();
		}

		const maxTemp = Math.max(20, ...tempHistory.filter(function(v) { return v != null; }), 100);
		drawSeries(tempHistory.map(function(v) { return v == null ? 0 : v; }), '#c0392b', maxTemp);
		drawSeries(pwmHistory.map(function(v) { return v == null ? 0 : v; }), '#2980b9', 100);
	},

	createHistoryBuffer() {
		return {
			temp: [],
			pwm: []
		};
	},

	pushHistory(buffer, temp, pwm) {
		buffer.temp.push(temp);
		buffer.pwm.push(pwm);

		while (buffer.temp.length > HISTORY_LENGTH)
			buffer.temp.shift();

		while (buffer.pwm.length > HISTORY_LENGTH)
			buffer.pwm.shift();
	}
});

return FanControl;
