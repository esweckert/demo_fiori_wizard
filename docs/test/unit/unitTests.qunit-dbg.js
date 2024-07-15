/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/esweckert/demo-transfer-app/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});