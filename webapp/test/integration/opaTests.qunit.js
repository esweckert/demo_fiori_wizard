/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/media-saturn/articletransfer/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});