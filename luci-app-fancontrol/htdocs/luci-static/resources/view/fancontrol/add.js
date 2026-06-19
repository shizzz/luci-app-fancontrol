'use strict';
'require view';
'require dom';
'require uci';
'require ui';
'require tools.fancontrol as fc';

return view.extend({
	load() {
		return Promise.all([
			uci.load('fancontrol'),
			fc.discoverThermalZones(),
			fc.discoverPwmOutputs()
		]);
	},

	render([, thermalZones, pwmOutputs]) {
		const view = this;
		const state = {
			sectionName: '',
			mode: 'pid',
			thermalManual: false,
			pwmManual: false,
			thermalPath: thermalZones.length ? thermalZones[0].path : '',
			pwmPath: pwmOutputs.length ? pwmOutputs[0].pwm_path : '',
			pwmEnablePath: pwmOutputs.length ? pwmOutputs[0].pwm_enable_path : '',
			selectedPwm: pwmOutputs.length ? pwmOutputs[0] : null
		};

		const validationBox = E('div', { 'class': 'cbi-section-fancontrol-validation' });
		const sectionPreview = E('span', { 'class': 'cbi-section-fancontrol-path-preview' }, ['—']);

		const thermalSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: '' }, [_('Manual entry')])
		].concat(thermalZones.map(function(zone) {
			return E('option', { value: zone.path }, ['%s (%s)'.format(zone.label, zone.path)]);
		})));

		const pwmSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { value: '' }, [_('Manual entry')])
		].concat(pwmOutputs.map(function(output) {
			return E('option', { value: output.pwm_path }, [output.label]);
		})));

		const thermalManualInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'style': 'width: 100%; display: none;',
			'placeholder': '/sys/class/thermal/thermal_zone0/temp'
		});

		const pwmManualInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'style': 'width: 100%; display: none;',
			'placeholder': '/sys/class/hwmon/hwmon0/pwm1'
		});

		const pwmEnableInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'style': 'width: 100%;',
			'placeholder': '/sys/class/hwmon/hwmon0/pwm1_enable'
		});

		function updateSectionPreview() {
			const pwmPath = state.pwmManual ? pwmManualInput.value.trim() : state.pwmPath;
			const selected = pwmOutputs.find(function(item) { return item.pwm_path === pwmPath; });

			if (selected) {
				fc.deriveSectionNameFromHwmon(selected.pwm_path).then(function(name) {
					state.sectionName = name;
					sectionPreview.textContent = name;
				});
			}
			else {
				state.sectionName = fc.uniqueSectionName('fan');
				sectionPreview.textContent = state.sectionName;
			}
		}

		function syncThermal() {
			state.thermalManual = thermalSelect.value === '';
			thermalManualInput.style.display = state.thermalManual ? '' : 'none';
			state.thermalPath = state.thermalManual ? thermalManualInput.value.trim() : thermalSelect.value;
		}

		function syncPwm() {
			state.pwmManual = pwmSelect.value === '';
			pwmManualInput.style.display = state.pwmManual ? '' : 'none';

			if (state.pwmManual) {
				state.pwmPath = pwmManualInput.value.trim();
				state.pwmEnablePath = pwmEnableInput.value.trim();
			}
			else {
				const selected = pwmOutputs.find(function(item) { return item.pwm_path === pwmSelect.value; });
				state.selectedPwm = selected || null;
				state.pwmPath = selected ? selected.pwm_path : '';
				state.pwmEnablePath = selected ? selected.pwm_enable_path : pwmEnableInput.value.trim();
				if (selected && selected.pwm_enable_path)
					pwmEnableInput.value = selected.pwm_enable_path;
			}

			updateSectionPreview();
		}

		thermalSelect.addEventListener('change', syncThermal);
		pwmSelect.addEventListener('change', syncPwm);
		thermalManualInput.addEventListener('input', syncThermal);
		pwmManualInput.addEventListener('input', syncPwm);
		pwmEnableInput.addEventListener('input', syncPwm);

		if (thermalZones.length)
			thermalSelect.value = thermalZones[0].path;

		if (pwmOutputs.length)
			pwmSelect.value = pwmOutputs[0].pwm_path;

		syncThermal();
		syncPwm();

		function runValidation(force) {
			syncThermal();
			syncPwm();

			return fc.validateFanPaths(state.thermalPath, state.pwmPath, state.pwmEnablePath, true)
				.then(function(warnings) {
					dom.content(validationBox, null);

					if (warnings.length) {
						warnings.forEach(function(w) {
							validationBox.appendChild(E('p', { 'class': 'warning' }, [ w ]));
						});

					if (!force) {
						validationBox.appendChild(E('p', {}, [
							_('Fix validation issues or enable force save to continue.')
						]));
						return false;
					}
					}

					return true;
				});
		}

		const forceFlag = E('input', { type: 'checkbox' });

		return E([
			E('link', { rel: 'stylesheet', href: L.resource('fancontrol.css') }),
			E('h2', {}, [_('Add Fan')]),
			E('p', { 'class': 'cbi-map-descr' }, [
				_('Discover thermal sensors and PWM outputs from sysfs, or enter paths manually.')
			]),
			E('div', { 'class': 'cbi-section cbi-section-fancontrol-wizard-step' }, [
				E('h3', {}, [_('Hardware discovery')]),
				E('label', {}, [_('Thermal sensor')]),
				thermalSelect,
				thermalManualInput,
				E('br'),
				E('label', { 'style': 'margin-top: 0.75em; display: block;' }, [_('PWM output')]),
				pwmSelect,
				pwmManualInput,
				E('br'),
				E('label', { 'style': 'margin-top: 0.75em; display: block;' }, [_('PWM enable path')]),
				pwmEnableInput,
				E('p', { 'style': 'margin-top: 0.75em;' }, [
					_('UCI section name: '),
					sectionPreview
				])
			]),
			E('div', { 'class': 'cbi-section cbi-section-fancontrol-wizard-step' }, [
				E('h3', {}, [_('Initial settings')]),
				E('label', {}, [_('Control mode')]),
				E('select', {
					'class': 'cbi-input-select',
					'change': function(ev) { state.mode = ev.target.value; }
				}, [
					E('option', { value: 'pid', selected: 'selected' }, [_('PID')]),
					E('option', { value: 'fixed' }, [_('Fixed PWM')])
				])
			]),
			E('div', { 'class': 'cbi-section cbi-section-fancontrol-wizard-step' }, [
				E('h3', {}, [_('Validation')]),
				E('label', {}, [
					forceFlag,
					' ',
					_('Force save (ignore validation warnings)')
				]),
				validationBox
			]),
			E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
				E('button', {
					'class': 'btn cbi-button-apply',
					'click': ui.createHandlerFn(view, function() {
						const force = forceFlag.checked || fc.isForceEnabled();

						return runValidation(force).then(function(ok) {
							if (!ok)
								return;

							const namePromise = state.pwmManual
								? Promise.resolve(fc.uniqueSectionName('fan'))
								: fc.deriveSectionNameFromHwmon(state.pwmPath);

							return namePromise.then(function(name) {
								state.sectionName = name;

								uci.add('fancontrol', 'fancontrol', state.sectionName);
								uci.set('fancontrol', state.sectionName, 'enabled', '1');
								uci.set('fancontrol', state.sectionName, 'mode', state.mode);
								uci.set('fancontrol', state.sectionName, 'setpoint', '60');
								uci.set('fancontrol', state.sectionName, 'kp', '2.0');
								uci.set('fancontrol', state.sectionName, 'ki', '0.5');
								uci.set('fancontrol', state.sectionName, 'kd', '1.0');
								uci.set('fancontrol', state.sectionName, 'min_pwm', '50');
								uci.set('fancontrol', state.sectionName, 'max_pwm', '255');
								uci.set('fancontrol', state.sectionName, 'fixed_pwm', '128');
								uci.set('fancontrol', state.sectionName, 'interval_sec', '1.0');
								uci.set('fancontrol', state.sectionName, 'thermal_path', state.thermalPath);
								uci.set('fancontrol', state.sectionName, 'pwm_path', state.pwmPath);
								uci.set('fancontrol', state.sectionName, 'pwm_enable_path', state.pwmEnablePath);
								uci.set('fancontrol', state.sectionName, 'dry_run', '0');
								uci.set('fancontrol', state.sectionName, 'debug', '0');

								return uci.save().then(function() {
									window.location = L.url('admin/services/fancontrol/edit/' + state.sectionName);
								});
							});
						});
					})
				}, [_('Create fan')]),
				E('a', {
					'class': 'btn cbi-button-neutral',
					'href': L.url('admin/services/fancontrol/dashboard')
				}, [_('Cancel')])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
