const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var ItemBuilder;
const EVEAPIURL = "http://api.eve-online.com";

const EVEURLS = {
    serverStatus:   {
        url:    "/server/ServerStatus.xml.aspx",
        cb:     EveServerStatus.fromXML,
    },
    characters:     {
        url:    "/account/Characters.xml.aspx",
        cb:     processCharacters,
    },
    charsheet:      {
        url:    "/char/CharacterSheet.xml.aspx",
        cb:     processCharsheet,
    },
    charassets:      {
        url:    "/char/AssetList.xml.aspx",
        cb:     processCharassets,
    },
    corpassets:      {
        url:    "/corp/AssetList.xml.aspx",
        cb:     processCharassets,
    },
};

function EveApiService() {
    this.cache_session = Cc["@mozilla.org/network/cache-service;1"].
            getService(Ci.nsICacheService).createSession("EVE API",
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

    _error: "",

    getServerStatus:    function () {
        return this._performRequest('serverStatus');
    },
    
    getCharacterList:   function (id, key) {
        return this._performRequest('characters', {userID: id, apiKey: key});
    },

    getCharacterSkills: function (id, key, charID) {
        return this._performRequest('charsheet',
                {userID: id, apiKey: key, characterID: charID});
    },

    getCharacterAssets: function (id, key, charID, count) {
        var result = this._performRequest('charassets',
                {userID: id, apiKey: key, characterID: charID});
        count.value = result.length;
        return result;
    },

    getCorporationAssets: function (id, key, charID, count) {
        var result = this._performRequest('corpassets',
                {userID: id, apiKey: key, characterID: charID});
        count.value = result.length;
        return result;
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
        this._error = "";
        var poststring = [i+'='+escape(data[i]) for (i in data)].join('&');
        var res = this._fetchXML(EVEAPIURL+EVEURLS[type].url, poststring);
        return res
            ? EVEURLS[type].cb(res)
            : null;
    },

    _fromCache:     function (cd) {
        var stream = cd.openInputStream(0);
        var parser = Cc["@mozilla.org/xmlextras/domparser;1"].
                createInstance(Ci.nsIDOMParser);
        var result = parser.parseFromStream(stream, "UTF-8",
                stream.available(), "text/xml");
        stream.close();
        cd.close();
        return result;
     },

    _fetchXML:    function (url, data) {
        var result;
        var cacheKey = url + '?stamp=' + this._makeHash(data);
        dump("Fetching "+cacheKey+"\n");
        var cd = this.cache_session.openCacheEntry(cacheKey, Ci.nsICache.ACCESS_READ_WRITE, true);
        if (cd.accessGranted == Ci.nsICache.ACCESS_READ_WRITE   // It exists
                &&  cd.expirationTime*1000 > Date.now()) {      // And it is valid
            dump("Using cache now\n");
            return this._fromCache(cd);
        }

        var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                createInstance(Ci.nsIXMLHttpRequest);
        req.open('POST', url, false);
        req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
        try {
            req.send(data);
        } catch (e) {
            req = {status: 0};
        }
        if (req.status != 200) {
            dump('Failed to connect to server!\n');
            if (cd.accessGranted == Ci.nsICache.ACCESS_READ_WRITE)
                return this._fromCache(cd);
            return null;
        }

        result = req.responseXML;

        var error = evaluateXPath(result, "/eveapi/error/text()")[0];
        if (error) {
            dump(error+"\n");
            this._error = error.data;
            return this._fromCache(cd);
        }

        var serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].
            createInstance(Ci.nsIDOMSerializer);
        var os = cd.openOutputStream(0);
        serializer.serializeToStream(result, os, "");
        os.close();

        var curtime = evaluateXPath(result, "/eveapi/currentTime/text()")[0].data;
        var cached_until = evaluateXPath(result, "/eveapi/cachedUntil/text()")[0].data;
        dump("Got on ["+curtime+"] expires on ["+cached_until+"]\n");
        cd.setExpirationTime(Date.UTCFromEveTimeString(cached_until)/1000);
        cd.markValid();
        cd.close();

        return result;
    },

    get error()     this._error,
};

function EveServerStatus(online, players) {
    this.is_online = online;
    this.players_count = players;
}

EveServerStatus.fromXML = function (data) {
    players = evaluateXPath(data, "//onlinePlayers/text()")[0].data;
    return new EveServerStatus(players > 0, players);
};

EveServerStatus.prototype = {
    classDescription:   "EVE Online Server Status",
    classID:            Components.ID("{b0274794-98da-45fd-8cf1-361cac351395}"),
    contractID:         "@aragaer.com/eve-server-status;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveServerStatus]),
    get onlinePlayers() this.players_count,
    isOnline:           function () { return this.is_online; },
}

var components = [EveApiService, EveServerStatus];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

function evaluateXPath(aNode, aExpr) {
    var found = [];
    var res, result;
    var xpe = Cc["@mozilla.org/dom/xpath-evaluator;1"].
            createInstance(Ci.nsIDOMXPathEvaluator);
    var nsResolver = xpe.createNSResolver(aNode.ownerDocument == null
            ? aNode.documentElement
            : aNode.ownerDocument.documentElement);
    try {
        result = xpe.evaluate(aExpr, aNode, nsResolver, 0, null);
    } catch (e) {
        dump("error running xpe with expression '"+aExpr+"'\nCaller:"+
              evaluateXPath.caller+"\n");
        return found;
    }
    while (res = result.iterateNext())
        found.push(res);
    return found;
}

function processCharacters(data) {
    dump("STUB processCharacters\n");
    return evaluateXPath(data, "/eveapi/result/rowset")[0];
}
function processCharsheet(data) { return data; }

function processCharassets(data) {
    if (!ItemBuilder)
        ItemBuilder = Cc["@aragaer/eve/item-builder;1"].
                getService(Ci.nsIEveItemBuilder);
    var result = [];
    evaluateXPath(data, "/eveapi/result/rowset/row").forEach(function (item) {
        var loc = item.getAttribute('locationID');
        var cont = ItemBuilder.createItem(
            item.getAttribute('itemID'),
            loc,
            null,
            item.getAttribute('typeID'),
            item.hasAttribute('quantity')
                ? item.getAttribute('quantity')
                : 1,
            item.hasAttribute('flag')
                ? item.getAttribute('flag')
                : 0,
            item.hasAttribute('singleton')
                ? item.getAttribute('singleton')
                : 0
        );
        result.push(cont);
        evaluateXPath(item, "rowset/row").forEach(function (child) {
            cont.addItem(ItemBuilder.createItem(
                child.getAttribute('itemID'),
                loc,
                cont,
                child.getAttribute('typeID'),
                child.hasAttribute('quantity')
                    ? child.getAttribute('quantity')
                    : 1,
                child.hasAttribute('flag')
                    ? child.getAttribute('flag')
                    : 0,
                child.hasAttribute('singleton')
                    ? child.getAttribute('singleton')
                    : 0
            ));
        });
    });
    return result;
}

Date.UTCFromEveTimeString = function (str) {
    var d = str.split(/:| |-/);
    d[1]--; // Month

    return Date.UTC(d[0], d[1], d[2], d[3], d[4], d[5]);
}

