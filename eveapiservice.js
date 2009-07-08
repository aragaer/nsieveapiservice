const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const EVEAPIURL = "http://api.eve-online.com";

const EVEURLS = {
    serverStatus:   "/server/ServerStatus.xml.aspx",
    characters:     "/account/Characters.xml.aspx",
    charsheet:      "/char/CharacterSheet.xml.aspx",
};

function EveApiService() { }

EveApiService.prototype = {
    classDescription: "EVE API XPCOM Component",
    classID:          Components.ID("{6f7ee12b-12b3-4101-a4c9-ecdc97c51421}"),
    contractID:       "@aragaer.com/eve-api;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIEveApiService]),
    _xpcom_categories: [{
        category: "xpcom-startup",
        service: true
    }],
    
    getServerStatus:    function () {
        return performRequest(null, 'serverStatus')
    },
    
    getCharacterList:   function (id, key) {
        return performRequest('userID='+escape(id)+'&apiKey='+escape(key),
                'characters', function (req) {
                    return evaluateXPath(req.responseXML, "//rowset")[0];
                });
    },

    getCharacterSkills: function (id, key, charID) {
        return performRequest('userID='+escape(id)+'&apiKey='+escape(key)+
                    '&characterID='+escape(charID),
                'charsheet', function (req) {
                    return evaluateXPath(req.responseXML, "//rowset")[0];
                });
    }
};
var components = [EveApiService];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

function performRequest(data, url, process) {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
            .createInstance(Ci.nsIXMLHttpRequest);
    req.open('POST', EVEAPIURL+EVEURLS[url], false);
    req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
    req.send(data);
    if (req.status != 200) {
        dump('Failed to connect to server!\n');
        return nsnull;
    }

    return process
        ? process(req)
        : evaluateXPath(req.responseXML, "//rowset")[0];
}

function evaluateXPath(aNode, aExpr) {
    var found = [];
    var res;
    var xpe = Cc["@mozilla.org/dom/xpath-evaluator;1"]
            .createInstance(Ci.nsIDOMXPathEvaluator);
    var nsResolver = xpe.createNSResolver(aNode.ownerDocument == null
            ? aNode.documentElement
            : aNode.ownerDocument.documentElement);
    try {
        var result = xpe.evaluate(aExpr, aNode, nsResolver, 0, null);
    } catch (e) {
        dump("error running xpe with expression '"+aExpr+"'\nCaller:"+
              evaluateXPath.caller+"\n");
        return found;
    }
    while (res = result.iterateNext())
        found.push(res);
    return found;
}

