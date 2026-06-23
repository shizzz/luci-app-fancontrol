'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require tools.fancontrol as fc';

return view.extend({
	load() {
		return uci.load('fancontrol');
	},

	render() {
		const requestPath = L.env.requestpath;
		const sectionId = requestPath[requestPath.length - 1];

		if (!sectionId || !uci.get('fancontrol', sectionId))
			return E('p', {}, [_('Unknown fan section.')]);

		this.sectionId = sectionId;

		const m = new form.Map('fancontrol', _('Edit Fan'),
			_('Configure fan control parameters. PID tuning options are available in PID mode only.'));

		const s = m.section(form.NamedSection, sectionId, 'fancontrol', sectionId);
		s.addremove = false;

		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Control mode'));
		o.value('pid', _('PID'));
		o.value('fixed', _('Fixed PWM'));
		o.default = 'pid';
		o.rmempty = false;

		o = s.option(form.Value, 'setpoint', _('Setpoint (°C)'));
		o.datatype = 'uinteger';
		o.depends('mode', 'pid');
		o.placeholder = '60';

		o = s.option(form.Value, 'kp', _('Kp'));
		o.datatype = 'float';
		o.depends('mode', 'pid');

		o = s.option(form.Value, 'ki', _('Ki'));
		o.datatype = 'float';
		o.depends('mode', 'pid');

		o = s.option(form.Value, 'kd', _('Kd'));
		o.datatype = 'float';
		o.depends('mode', 'pid');

		o = s.option(form.Value, 'min_pwm', _('Minimum PWM (0–255)'));
		o.datatype = 'uinteger';
		o.depends('mode', 'pid');
		o.placeholder = '50';

		o = s.option(form.Value, 'max_pwm', _('Maximum PWM (0–255)'));
		o.datatype = 'uinteger';
		o.depends('mode', 'pid');
		o.placeholder = '255';

		o = s.option(form.Value, 'interval_sec', _('Control interval (seconds)'));
		o.datatype = 'float';
		o.depends('mode', 'pid');
		o.placeholder = '1.0';

		o = s.option(form.Value, 'fixed_pwm', _('Fixed PWM (0–255)'));
		o.datatype = 'uinteger';
		o.depends('mode', 'fixed');
		o.placeholder = '128';

		o = s.option(form.Value, 'thermal_path', _('Thermal sensor path'));
		o.placeholder = '/sys/class/thermal/thermal_zone0/temp';
		o.rmempty = false;

		o = s.option(form.Value, 'pwm_path', _('PWM output path'));
		o.placeholder = '/sys/class/hwmon/hwmon0/pwm1';
		o.rmempty = false;

		o = s.option(form.Value, 'pwm_enable_path', _('PWM enable path'));
		o.placeholder = '/sys/class/hwmon/hwmon0/pwm1_enable';
		o.rmempty = false;

		o = s.option(form.Flag, 'dry_run', _('Dry run'),
			_('Calculate control output without writing to PWM sysfs nodes.'));

		o = s.option(form.Flag, 'debug', _('Debug'),
			_('Enable verbose logging in the fancontrol process.'));

		const gs = m.section(form.NamedSection, 'globals', 'globals', _('Validation'));
		gs.anonymous = true;
		gs.addremove = false;

		o = gs.option(form.Flag, 'force', _('Force save'),
			_('Allow saving even when sysfs path validation fails. Useful for GPIO or non-standard PWM implementations.'));

		this.map = m;

		return m.render().then(function(node) {
			return E([
				E('link', { rel: 'stylesheet', href: L.resource('fancontrol.css') }),
				E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
					E('a', {
						'class': 'btn cbi-button-neutral',
						'href': L.url('admin/services/fancontrol/dashboard')
					}, [_('Back to dashboard')])
				]),
				node
			]);
		});
	},

	handleSaveApply(ev) {
		const map = this.map;
		const sectionId = this.sectionId;

		return map.parse().then(function() {
			if (fc.isForceEnabled())
				return map.save(null, true);

			const thermal = uci.get('fancontrol', sectionId, 'thermal_path');
			const pwm = uci.get('fancontrol', sectionId, 'pwm_path');
			const enable = uci.get('fancontrol', sectionId, 'pwm_enable_path');
			const dryRun = uci.get('fancontrol', sectionId, 'dry_run') == '1';

			return fc.validateFanPaths(thermal, pwm, enable, !dryRun).then(function(warnings) {
				if (!warnings.length)
					return map.save(null, true);

				return new Promise(function(resolveFn) {
					ui.showModal(_('Validation warnings'), [
						E('div', { 'class': 'cbi-section-fancontrol-validation' },
							warnings.map(function(w) { return E('p', { 'class': 'warning' }, [ w ]); })
						),
						E('p', {}, [_('Enable "Force save" in the Validation section to ignore these warnings.')]),
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'btn',
								'click': function() {
									ui.hideModal();
									resolveFn(false);
								}
							}, [_('Cancel')])
						])
					]);
				});
			});
		});
	},

	handleSave(ev) {
		return this.handleSaveApply(ev);
	}
});
