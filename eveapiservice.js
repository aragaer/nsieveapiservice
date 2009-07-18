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

function EveApiService() {
    this.cache_session = Cc["@mozilla.org/network/cache-service;1"].
            getService(Ci.nsICacheService).createSession("HTTP",
                    Ci.nsICache.STORE_OFFLINE, true);
}

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
        return this._performRequest('serverStatus');
    },
    
    getCharacterList:   function (id, key) {
        return this._performRequest('characters', {userID: id, apiKey: key});
    },

    getCharacterSkills: function (id, key, charID) {
        return performRequest('charsheet',
                {userID: id, apiKey: key, characterID: charID});
    },

    _makeHash:          function (str) {
        var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                createInstance(Ci.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";
        var result = {};
        // data is an array of bytes
        var data = converter.convertToByteArray(str, result);
        var hasher = Cc["@mozilla.org/security/hash;1"].
                createInstance(Ci.nsICryptoHash);
        hasher.init(hasher.MD5);
        hasher.update(data, data.length);
        var hash = hasher.finish(false);
        function toHexString(c) { return ("00" + c.toString(16)).slice(-2); }
        return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
    },

    _performRequest:    function (type, data) {
        var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                createInstance(Ci.nsIXMLHttpRequest);

        var poststring = [i+'='+escape(data[i]) for (i in data)].join('&');
        var url = EVEAPIURL+EVEURLS[type].url +
            (data 
                ? '?stamp=' + this._makeHash(poststring)
                : ""
            );

        req.open('POST', url, false);
        req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
        req.send(poststring);
        if (req.status != 200) {
            dump('Failed to connect to server!\n');
            return nsnull;
        }

        var cache_descr = this.cache_session.openCacheEntry(url,
                Ci.nsICache.ACCESS_WRITE, true);

        var cached_until = evaluateXPath(req.responseXML, "/eveapi/cachedUntil/text()")[0].data;
        var d = cached_until.split(/ |:|-/); // 2009-07-18 22:54:58
        cache_descr.setExpirationTime(Date.UTC(d[0], d[1], d[2], d[3], d[4], d[5])/1000);
        cache_descr.storagePolicy = Ci.nsICache.STORE_OFFLINE;

        return EVEURLS[type].cb(req);
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
    get onlinePlayers() {
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

function processStatus(data) {
}

function processCharacters(data) {
}

function processCharsheet(data) {
}

