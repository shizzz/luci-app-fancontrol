'use strict';
'require view';
'require uci';
'require ui';
'require rpc';
'require tools.fancontrol as fc';

const callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

const SERVICE_NAME = 'fancontrol';

return view.extend({
	load() {
		return Promise.all([
			uci.load('fancontrol'),
			callRcList(SERVICE_NAME)
		]);
	},

	handleAction(action) {
		return callRcInit(SERVICE_NAME, action).then(function(result) {
			if (result !== true)
				throw new Error(_('Command failed'));
		}).then(function() {
			window.location.reload();
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Failed to execute service action: %s').format(err.message || err)), 'danger');
		});
	},

	render([, serviceInfo]) {
		const info = serviceInfo && serviceInfo[SERVICE_NAME] ? serviceInfo[SERVICE_NAME] : {};
		const running = !!info.running;
		const enabled = !!info.enabled;
		const view = this;

		return E([
			E('link', { rel: 'stylesheet', href: L.resource('fancontrol.css') }),
			E('h2', {}, [_('Fan Control Service')]),
			E('p', { 'class': 'cbi-map-descr' }, [
				_('Manage the fancontrol init script. Status is obtained from procd, not from the Go binary directly.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [_('Service status')]),
				E('dl', { 'class': 'cbi-section-fancontrol-metrics' }, [
					E('dt', {}, [_('Running')]),
					E('dd', {}, [
						E('span', {
							'class': 'cbi-section-fancontrol-service-status %s'.format(running ? 'running' : 'stopped')
						}, [ running ? _('Running') : _('Stopped') ])
					]),
					E('dt', {}, [_('Boot')]),
					E('dd', {}, [ enabled ? _('Enabled') : _('Disabled') ]),
					E('dt', {}, [_('Init script')]),
					E('dd', {}, [ '/etc/init.d/fancontrol' ]),
					E('dt', {}, [_('Binary')]),
					E('dd', {}, [ '/usr/sbin/openwrt-fancontrol' ])
				]),
				E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
					E('button', {
						'class': 'btn cbi-button-apply',
						'click': ui.createHandlerFn(view, 'handleAction', 'start')
					}, [_('Start')]),
					E('button', {
						'class': 'btn cbi-button-reset',
						'click': ui.createHandlerFn(view, 'handleAction', 'stop')
					}, [_('Stop')]),
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.createHandlerFn(view, 'handleAction', 'restart')
					}, [_('Restart')]),
					E('button', {
						'class': 'btn cbi-button-apply',
						'disabled': enabled ? 'disabled' : null,
						'click': ui.createHandlerFn(view, 'handleAction', 'enable')
					}, [_('Enable at boot')]),
					E('button', {
						'class': 'btn cbi-button-reset',
						'disabled': !enabled ? 'disabled' : null,
						'click': ui.createHandlerFn(view, 'handleAction', 'disable')
					}, [_('Disable at boot')])
				])
			]),
			E('div', { 'class': 'cbi-section-fancontrol-actions' }, [
				E('a', {
					'class': 'btn cbi-button-neutral',
					'href': L.url('admin/services/fancontrol/dashboard')
				}, [_('Back to dashboard')])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
