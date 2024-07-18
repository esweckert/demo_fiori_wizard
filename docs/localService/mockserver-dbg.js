sap.ui.define(['sap/ui/core/util/MockServer',
    'sap/ui/thirdparty/jquery'
], function (MockServer, jQuery) {
    'use strict';
    var oMockServer,
        _sAppModulePath = 'com/esweckert/demo-transfer-app/',
        _sJsonFilesModulePath = _sAppModulePath + 'localService/data';

    function syncGetJSON(sURL) {
        let sResult;
        jQuery.ajax({
            url: sURL,
            async: false,
            dataType: "json",
            success(data) {
                sResult = data;
            }
        });
        return sResult;
    }

    return {
        /**
         * Initializes the mock server.
         * You can configure the delay with the URL parameter "serverDelay".
         * The local mock data in this folder is returned instead of the real data for testing.
         * @public
         */

        init: function () {

            var sODataServiceUrl = "/sap/opu/odata/sap/ZMM_DEMO_TRANSFER_SRV/";

            oMockServer = new MockServer({
                rootUri: sODataServiceUrl
            });

            var sLocalServicePath = sap.ui.require.toUrl("com/esweckert/demo-transfer-app/localService");


            // configure mock server with a delay
            MockServer.config({
                autoRespond: true,
                autoRespondAfter: 500
            });

            oMockServer.simulate(sLocalServicePath + "/metadata.xml", {
                sMockdataBaseUrl: sLocalServicePath + "/data",
                bGenerateMissingMockData: true
            });

            /* =========================================================== */
            /* Beginn simulate respone                                     */
            /* =========================================================== */

            // JSON response containing the OData error(s)
            const oErrorResponseTemplate = syncGetJSON(sLocalServicePath + "/response/ODataErrorResponseTemplate.json");

            // sap-message header data
            const oSapMessageHeaderValue = syncGetJSON(sLocalServicePath + "/response/SAP-Message-Header.json");

            // pre-fetch the mockdata
            const oProductSet = syncGetJSON(sLocalServicePath + "/data/ProductSet.json");

            const aRequests = oMockServer.getRequests();

            function fnValidateUpdateEntity(oProductSet) {
                const aErrors = [];
                // simulate some dummy backend validation
                if (oProductSet.subsidary === 'SE') {
                    aErrors.push({
                        code: "E:101",
                        message: "Products from Sweden can not be transfered anymore!",
                        propertyref: "",
                        severity: "error",
                        target: "/ProductSet"
                    });
                }

                return aErrors;
            }

            function fnUpdateEntityResponse(oRequest) {
                oRequest.response = function (oXhr) {
                    const oData = JSON.parse(oXhr.requestBody);
                    const aErrors = fnValidateUpdateEntity(oData);

                    if (aErrors.length) {
                        oErrorResponseTemplate.error.innererror.errordetails = aErrors;
                        oXhr.respond(500, {
                            "Content-Type": "application/json"
                        }, JSON.stringify(oErrorResponseTemplate));

                    } else {

                        // update mock data
                        oProductSet.d.articles = oData.articles;
                        oProductSet.d.subsidary = oData.subsidary;
                        oProductSet.d.articleKind = oData.articleKind;
                        oProductSet.d.legacyProdid = oData.legacyProdid;
                        oProductSet.d.creatatCheck = oData.creatatCheck;
                        oProductSet.d.noArticles = oData.articles.split(',').length;

                        // now send the ok response
                        oXhr.respond(200, {
                            "Content-Type": "application/json",
                            "sap-message": JSON.stringify(oSapMessageHeaderValue)
                        }, JSON.stringify(oProductSet));
                    }
                };
            }

            function fnGetEntityResponse(oRequest) {
                oRequest.response = function (oXhr) {
                    oXhr.respond(200, {
                        "Content-Type": "application/json"
                    }, JSON.stringify(oProductSet));
                };
            }

            aRequests.forEach((oRequest) => {
                if (oRequest.method === "GET" && oRequest.path.toString().includes("ProductSet")) {
                    //we simply return always the first entry
                    fnGetEntityResponse(oRequest);
                } else if (oRequest.method === "POST" && oRequest.path.toString().includes("ProductSet")) {
                    fnUpdateEntityResponse(oRequest);
                }
            });


            oMockServer.start();

            jQuery.sap.log.info('Running the app with mock data');
        },

        /**
         * @public returns the mockserver of the app, should be used in integration tests
         * @returns {sap.ui.core.util.MockServer}
         */
        getMockServer: function () {
            return oMockServer;
        }
    };
});