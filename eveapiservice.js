const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const EVEAPIURL = "http://api.eve-online.com";

const EVEURLS = {
    serverStatus:   {
        url:    "/server/ServerStatus.xml.aspx",
        cb:     processStatus,
    },
    characters:     {
        url:    "/account/Characters.xml.aspx",
        cb:     processCharacters,
    },
    charsheet:      {
        url:    "/char/CharacterSheet.xml.aspx",
        cb:     processCharsheet,
    },
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

    init:               function () {
        this.cacheDir = Cc["@mozilla.org/file/directory_service;1"].
                getService[Ci.nsIProperties].get("ProfD", Ci.nsIFile);
        this.cacheDir.append("cache");

        if (!this.cacheDir.exists())
            file.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    },
    
    getServerStatus:    function () {
        return performRequest('serverStatus')
    },
    
    getCharacterList:   function (id, key) {
        return this._performRequest('characters', {userID: id, apiKey: key});
    },

    getCharacterSkills: function (id, key, charID) {
        return performRequest('charsheet',
                {userID: id, apiKey: key, characterID: charID});
    },

    _makeHash:          function (st) {
        var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                createInstance[Ci.nsIScriptableUnicodeConverter];
        converter.charset = "UTF-8";
        var result = {};
        // data is an array of bytes
        var data = converter.convertToByteArray(str, result);
        var hasher = Cc["@mozilla.org/security/hash;1"].
                createInstance(Ci.nsICryptoHash);
        hasher.init(ch.MD5);
        hasher.update(data, data.length);
        return hasher.finish(true);
    },

    _performRequest:    function (type, data) {
        var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                createInstance(Ci.nsIXMLHttpRequest);

        var postdata = [];
        for (i in data)
            postdata.push(i+'='+escape(data[i]));

        var poststring = postdata.join('&');

        var datastring = EVEURLS[type].url + '?' + poststring;
        var hash = this._makeHash(datastring);
        var file = this.cacheDir;
        file.append(hash+'.xml');

        req.open('POST', EVEAPIURL+EVEURLS[url], false);
        req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
        req.send(data);
        if (req.status != 200) {
            dump('Failed to connect to server!\n');
            return nsnull;
        }

        return process
            ? callback(req)
            : evaluateXPath(req.responseXML, "//rowset")[0];
    },
};

function EveServerStatus() {
    this.is_online = false;
    this.players = 0;
}

EveServerStatus.prototype = {
    classDescription:   "EVE Online Server Status",
    classID:            Components.ID("{b0274794-98da-45fd-8cf1-361cac351395}"),
    contractID:         "@aragaer.com/eve-server-status;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveServerStatus]),
    get onlinePlayers:  function () {
        return this.players_count;
    },
    isOnline:           function () {
        return this.is_online;
    },
    parse:              function (data) {
        
    },
}

var components = [EveApiService, EveServerStatus];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}



function evaluateXPath(aNode, aExpr) {
    var found = [];
    var res;
    var xpe = Cc["@mozilla.org/dom/xpath-evaluator;1"].
            createInstance(Ci.nsIDOMXPathEvaluator);
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

