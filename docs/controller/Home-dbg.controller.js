sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/f/library",
	"sap/ui/layout/HorizontalLayout",
	"sap/ui/layout/VerticalLayout",
	"sap/m/Dialog",
	"sap/m/DialogType",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/message/Message",
	"sap/ui/core/Fragment",
	"sap/ui/core/library",
	"sap/ui/model/odata/v2/ODataModel",
	"com/esweckert/demo-transfer-app/localService/mockserver"
], function (Controller, JSONModel, library, HorizontalLayout, VerticalLayout, Dialog, DialogType, MessageBox, MessageToast, Message,
	Fragment, coreLibrary, ODataModel, mockserver) {
	"use strict";

	// shortcut for sap.ui.core.MessageType
	var MessageType = coreLibrary.MessageType;

	return Controller.extend("com.esweckert.demo-transfer-app.controller.App", {
		onInit: function () {

			this._wizard = this.byId("TransfereWizard");
			this._oNavContainer = this.byId("navContainer");
			this._oDynamicPage = this.getPage();

			var oMessageManager;

			var oView = this.getView();
			var oViewModel = new JSONModel({
				country: null,
				externalId: true,
				productId: false,
				gtin: false,
				selectHeader: this.getResourceBundle().getText("labelExternalId"),
				selectFooter: this.getResourceBundle().getText("noteExternalId"),
				dateLimit: false,
				value: '',
				state: false
			});

			/**			var sODataServiceUrl = "/sap/opu/odata/sap/ZMM_PROCESS_MMS_ARTICLE_SRV/";
			 
						// init our mock server
						mockserver.init(sODataServiceUrl);
			
						// Northwind service
						this.getView().setModel(
							new ODataModel(sODataServiceUrl, {
								defaultBindingMode: "TwoWay"
							})
						);
			
						this.getView().bindElement("/ProductSet");
						*/

			// Create upload fragment
			Fragment.load({
				name: "com.esweckert.demo-transfer-app.view.UploadPopover",
				controller: this
			}).then(function (pDialog) {
				this._oUploadDialog = pDialog;
				this.getView().addDependent(this._oUploadDialog);
			}.bind(this));

			// set message model
			oMessageManager = sap.ui.getCore().getMessageManager();
			oView.setModel(oMessageManager.getMessageModel(), "message");

			// initialize Message Model in case not empty
			oMessageManager.removeAllMessages();

			// or just do it for the whole view
			oMessageManager.registerObject(oView, true);

			oView.setModel(oViewModel, "homeView");

			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

		},

		getPage: function () {
			return this.byId("dynamicPage");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onComboChange: function (oEvent) {
			var sValue = this.byId("idCombobox").getSelectedKey();
			this.getView().getModel("homeView").setProperty("/country", sValue);
			this._wizard.validateStep(this.byId("CountryStep"));
		},

		onDateSwitch: function (oEvent) {
			var bState = this.byId("idSwitch").getState();
			this.getView().getModel("homeView").setProperty("/dateLimit", bState);
		},

		onProductIdSelect: function (oEvent) {
			this.handlePreferences("idProductId");
			this.byId("idGtin").setSelected(false)
			this.byId("idExternalId").setSelected(false);
		},

		onExternalIdSelect: function (oEvent) {
			this.handlePreferences("idExternalId");
			this.byId("idGtin").setSelected(false)
			this.byId("idProductId").setSelected(false);
		},

		onGtinSelect: function (oEvent) {
			this.handlePreferences("idGtin");
			this.byId("idProductId").setSelected(false)
			this.byId("idExternalId").setSelected(false);
		},

		onMessageButtonPress: function (oEvent) {
			this._getMessagePopover().openBy(oEvent.getSource());
		},

		onSubmitButtonPress: function (oEvent) {
			var that = this;

			var sData = this.getView().byId("textArea").getValue(),
				oView = this.getView().getModel("homeView"),
				sParam;

			if (oView.getProperty("/externalId")) {
				sParam = "L";
			} else if (oView.getProperty("/productId")) {
				sParam = "G";
			} else if (oView.getProperty("/gtin")) {
				sParam = "E";
			} else {
				console.error("No parameter could be determined!");
			}

			if (sData === undefined || sData === "") {
				MessageBox.error(this.getResourceBundle().getText("errorMissingId"));
			} else if (this.getView().byId("textArea").getValueState() === "Error") {
				MessageBox.error(this.getResourceBundle().getText("errorValidation"));
			} else {
				var oJson = {
					articles: sData,
					subsidary: this.getView().getModel("homeView").getProperty("/country"),
					articleKind: sParam,
					legacyProdid: this.getView().getModel("homeView").getProperty("/externalId"),
					creatatCheck: this.getView().getModel("homeView").getProperty("/dateLimit")
				};
				that._postData(oJson);
			}
		},

		handleLiveChange: function (oEvent) {

			// max length 512 char exceeded
			var oTextArea = oEvent.getSource(),
				sValue = oTextArea.getValue(),
				iValueLength = oTextArea.getValue().length,
				iMaxLength = oTextArea.getMaxLength(),
				sStateLengthExceeded = iValueLength > iMaxLength ? "Error" : "None",
				oViewModel = this.getView().getModel("homeView"),
				aLength = [];

			// as long as a value exist number type can not be changed
			if (sValue.length >= 1) {
				this.byId("idProductId").setEnabled(false);
				this.byId("idExternalId").setEnabled(false);
				this.byId("idGtin").setEnabled(false);
			} else {
				this.byId("idProductId").setEnabled(true);
				this.byId("idExternalId").setEnabled(true);
				this.byId("idGtin").setEnabled(true);
			}

			// syntax check msh number, global id, gtin

			if (oViewModel.getProperty("/gtin")) {
				aLength.push(8, 13, 14);
			} else if (oViewModel.getProperty("/externalId")) {
				aLength.push(7);
			} else {
				aLength.push(12);
			}

			function isValid(str, array) {
				var res = str.split(',').every(function (item) {
					if (isNaN(item)) {
						return false;
					} else {
						return (array.includes(item.length));
					}
				});
				return res ? "None" : "Error";
			}

			var sStateInvalidNumber = isValid(sValue, aLength);

			// Update TextBox state
			var sState = (sStateLengthExceeded === "None" && sStateInvalidNumber === "None") ? "None" : "Error";
			oTextArea.setValueState(sState);
		},

		handlePreferences: function (sSelected) {

			if (sSelected === "idExternalId") {
				this.getView().getModel("homeView").setProperty("/externalId", true);
				this.getView().getModel("homeView").setProperty("/productId", false);
				this.getView().getModel("homeView").setProperty("/gtin", false);
				this.getView().getModel("homeView").setProperty("/selectHeader", this.getResourceBundle().getText("labelExternalId"));
				this.getView().getModel("homeView").setProperty("/selectFooter", this.getResourceBundle().getText("noteExternalId"));
			} else if (sSelected === "idProductId") {
				this.getView().getModel("homeView").setProperty("/externalId", false);
				this.getView().getModel("homeView").setProperty("/productId", true);
				this.getView().getModel("homeView").setProperty("/gtin", false);
				this.getView().getModel("homeView").setProperty("/selectHeader", this.getResourceBundle().getText("labelProductId"));
				this.getView().getModel("homeView").setProperty("/selectFooter", this.getResourceBundle().getText("noteProductId"));
			} else if (sSelected === "idGtin") {
				this.getView().getModel("homeView").setProperty("/externalId", false);
				this.getView().getModel("homeView").setProperty("/productId", false);
				this.getView().getModel("homeView").setProperty("/gtin", true);
				this.getView().getModel("homeView").setProperty("/selectHeader", this.getResourceBundle().getText("labelGtin"));
				this.getView().getModel("homeView").setProperty("/selectFooter", this.getResourceBundle().getText("noteGtin"));
			} else {
				console.error("An error happend handling preference selection!");
			}

		},

		completedHandler: function () {
			// open the upload dialog
			this._oUploadDialog.open();
		},

		onCloseUploadDialog: function (oEvent) {
			var oFileUploader = sap.ui.getCore().byId("fileUploader");
			oFileUploader.setValue("");
			this._oUploadDialog.close();
		},

		onUploadBtnPress: function (oEvent) {
			var that = this;

			// Initialize File Uploader
			var oFileUploader = sap.ui.getCore().byId("fileUploader");
			var sFileName = oFileUploader.getValue();
			if (!sFileName) {
				MessageToast.show(this.getResourceBundle().getText("noFileSelected"));
				return;
			}
			var file = oFileUploader.getFocusDomRef().files[0];
			var oReader = new FileReader();
			var oTextArea = this.getView().byId("textArea");
			var oModel = this.getView().getModel("homeView");
			oReader.onload = function (evt) {
				var strCSV = evt.target.result;
				oModel.setProperty("/value", strCSV);
				oTextArea.fireLiveChange();
			};
			oReader.readAsBinaryString(file);

			that.onCloseUploadDialog(oEvent);

		},

		/* =========================================================== */
		/* Private API's                                               */
		/* =========================================================== */

		_getMessagePopover: function () {
			// create popover lazily
			if (!this._oMessagePopover) {
				this._oMessagePopover = sap.ui.xmlfragment(this.getView().getId(),
					"com.esweckert.demo-transfer-app.view.MessagePopover", this);
				this.getView().addDependent(this._oMessagePopover);
			}
			return this._oMessagePopover;
		},

		_postData: function (item) {
			var that = this;
			var uri = "/ProductSet";
			var oDataModel = new sap.ui.model.odata.v2.ODataModel({
				serviceUrl: "/sap/opu/odata/sap/ZMM_PROCESS_MMS_ARTICLE_SRV/",
				defaultUpdateMethod: "POST"
			});
			oDataModel.setHeaders({
				"content-type": "application/json;charset=utf-8"
			});
			oDataModel.setUseBatch(false);

			oDataModel.create(uri, item, {
				success: function (oData, oResponse) {
					// get number of records 
					var sData = that.getView().byId("textArea").getValue();
					var aData = sData.split(',');
					var iCount = aData.length;


					MessageBox.success(that.getResourceBundle().getText("successUpload"), {
						title: that.getResourceBundle().getText("successUploadTitle"),
						id: "messageBoxUpload",
						details: "<p><strong>Status: </strong></p>\n " +
							"<p>HTTP " + oResponse.statusCode + "\n" + oResponse.statusText + "</p>\n" +
							"<ul>" +
							"<li>" + that.getResourceBundle().getText("recordsSent") + ' ' + iCount +
							"<li>" + that.getResourceBundle().getText("recordsReceived") + ' ' + oData.noArticles +
							"<ul>",
						contentWidth: "100px",
						styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer"
					});
				},
				error: function (oResponse) {
					var sErrorMsg = oResponse.message;
					MessageBox.error(sErrorMsg);
				}
			});

		},

		/* =========================================================== */
		/* Helper methods                                              */
		/* =========================================================== */

		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		getText: function (id, params) {
			return this.getResourceBundle().getText(id, params);
		}

	});
});