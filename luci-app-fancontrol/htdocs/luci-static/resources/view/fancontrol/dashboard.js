'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require ui';
'require tools.fancontrol as fc';

return view.extend({
	load() {
		return uci.load('fancontrol');
	},

	render() {
		const view = this;
		const fans = fc.getFanSections();
		const history = {};
		const cardsRoot = E('div', { 'class': 'cbi-section-fancontrol-cards' });

		fans.forEach(function(section) {
			history[section['.name']] = fc.createHistoryBuffer();
		});

		const pollFn = function() {
			return Promise.all(fans.map(function(section) {
				const id = section['.name'];
				const cfg = fc.getFanConfig(id);

				return Promise.all([
					fc.readTemperature(cfg.thermal_path),
					fc.readPwmPercent(cfg.pwm_path)
				]).then(function(values) {
					return { id: id, cfg: cfg, temp: values[0], pwm: values[1] };
				});
			})).then(function(results) {
				results.forEach(function(result) {
					const card = cardsRoot.querySelector('[data-fan="%s"]'.format(result.id));
					if (!card)
						return;

					const tempNode = card.querySelector('[data-metric="temp"]');
					const pwmNode = card.querySelector('[data-metric="pwm"]');
					const canvas = card.querySelector('canvas');

					if (tempNode)
						tempNode.textContent = result.temp != null ? '%.1f °C'.format(result.temp) : '—';

					if (pwmNode)
						pwmNode.textContent = result.pwm != null ? '%d %%'.format(result.pwm) : '—';

					const buffer = history[result.id];
					fc.pushHistory(buffer, result.temp, result.pwm);
					fc.drawDualChart(canvas, buffer.temp, buffer.pwm);
				});
			});
		};

		if (fans.length === 0) {
			cardsRoot.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [_('No fans configured yet.')]),
				E('a', {
					'class': 'btn cbi-button-action',
					'href': L.url('admin/services/fancontrol/add')
				}, [_('Add a fan')])
			]));
		}
		else {
			fans.forEach(function(section) {
				const id = section['.name'];
				const cfg = fc.getFanConfig(id);
				const enabledClass = cfg.enabled ? 'cbi-section-fancontrol-status-enabled' : 'cbi-section-fancontrol-status-disabled';

				cardsRoot.appendChild(E('div', {
					'class': 'cbi-section-fancontrol-card',
					'data-fan': id
				}, [
					E('h3', {}, [ id ]),
					E('dl', { 'class': 'cbi-section-fancontrol-metrics' }, [
						E('dt', {}, [_('Temperature')]),
						E('dd', { 'data-metric': 'temp' }, ['—']),
						E('dt', {}, [_('PWM')]),
						E('dd', { 'data-metric': 'pwm' }, ['—']),
						E('dt', {}, [_('Status')]),
						E('dd', {}, [
							E('span', { 'class': enabledClass }, [
								cfg.enabled ? _('Enabled') : _('Disabled')
							])
						]),
						E('dt', {}, [_('Mode')]),
						E('dd', {}, [ cfg.mode === 'fixed' ? _('Fixed PWM') : _('PID') ]),
						E('dt', {}, [_('Thermal sensor')]),
						E('dd', { 'class': 'cbi-section-fancontrol-path-preview' }, [ cfg.thermal_path || '—' ]),
						E('dt', {}, [_('PWM output')]),
						E('dd', { 'class': 'cbi-section-fancontrol-path-preview' }, [ cfg.pwm_path || '—' ])
					]),
					E('canvas', {
						'class': 'cbi-section-fancontrol-chart',
						'width': 300,
						'height': 80
					}),
					E('div', { 'class': 'cbi-section-fancontrol-legend' }, [
						E('span', { 'class': 'temp' }, [_('Temperature')]),
						E('span', { 'class': 'pwm' }, [_('PWM %')])
					]),
					E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
						E('a', {
							'class': 'btn cbi-button-action',
							'href': L.url('admin/services/fancontrol/edit', id)
						}, [_('Edit')]),
						E('button', {
							'class': 'btn cbi-button-negative',
							'click': ui.createHandlerFn(view, 'handleDelete', id)
						}, [_('Delete')])
					])
				]));
			});
		}

		poll.add(pollFn, 1);
		pollFn();

		return E([
			E('link', { rel: 'stylesheet', href: L.resource('fancontrol.css') }),
			E('h2', {}, [_('Fan Control Dashboard')]),
			E('p', { 'class': 'cbi-map-descr' }, [
				_('Live fan status read from sysfs. Values refresh every second.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
					E('a', {
						'class': 'btn cbi-button-action',
						'href': L.url('admin/services/fancontrol/add')
					}, [_('Add fan')]),
					E('a', {
						'class': 'btn cbi-button-neutral',
						'href': L.url('admin/services/fancontrol/service')
					}, [_('Service')])
				]),
				cardsRoot
			])
		]);
	},

	handleDelete(sectionId) {
		return ui.showModal(_('Delete fan'), [
			E('p', {}, [_('Really delete fan configuration "%s"?').format(sectionId)]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [_('Cancel')]),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, function() {
						uci.remove('fancontrol', sectionId);
						return uci.save().then(function() {
							ui.hideModal();
							window.location.reload();
						});
					})
				}, [_('Delete')])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
