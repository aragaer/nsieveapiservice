const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var ItemBuilder;
var db;
const EVEAPIURL = "http://api.eve-online.com";

const EVEURLS = {
    serverStatus:   {
        url:    "/server/ServerStatus.xml.aspx",
        xmlcb:  EveServerStatus.fromXML,
    },
    characters:     {
        url:    "/account/Characters.xml.aspx",
        xmlcb:  processCharacters,
    },
    charsheet:      {
        url:    "/char/CharacterSheet.xml.aspx",
        xmlcb:  processCharsheet,
    },
    charassets:      {
        url:    "/char/AssetList.xml.aspx",
        xmlcb:  processCharassets,
    },
    corpassets:      {
        url:    "/corp/AssetList.xml.aspx",
        xmlcb:  processCharassets,
        db:     true
    },
};

function EveApiService() {
    this.cache_session = Cc["@mozilla.org/network/cache-service;1"].
            getService(Ci.nsICacheService).createSession("EVE API",
                    Ci.nsICache.STORE_OFFLINE, true);

    try {
        var static = Cc["@mozilla.org/preferences-service;1"].
            getService(Ci.nsIPrefBranch).getCharPref("eve.static_dump_path");
        dump(static+"\n");
        var file = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
        file.initWithPath(static);
        this.conn = Cc["@mozilla.org/storage/service;1"].
                getService(Ci.mozIStorageService).
                openDatabase(file);
    } catch (e) {
        dump(e.toString()+"\n");
        return;
    }

    this.conn.executeSimpleSQL("PRAGMA synchronous = OFF");
    this.conn.executeSimpleSQL("PRAGMA temp_store = MEMORY");

    db = this;
}

EveApiService.prototype = {
    classDescription: "EVE API XPCOM Component",
    classID:          Components.ID("{6f7ee12b-12b3-4101-a4c9-ecdc97c51421}"),
    contractID:       "@aragaer.com/eve-api;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIEveApiService]),
    _xpcom_categories: [{
        category: "profile-do-change",
        service: true
    }],

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

    _queryCharacterAssets:      function (id, key, charID, where, out) {
        var result = this._fetchDB('charassets',
                {userID: id, apiKey: key, characterID: charID},
                "select * from local.items where " +
                [where, "owner="+characterID].join(" and ") + ";");
        out.value = result.length;
        return result;
    },

    _fetchDB:           function (type, data, query, cb) {
        var poststring = [i+'='+escape(data[i]) for (i in data)].join('&');
        var url = EVEAPIURL+EVEURLS[type].url;
        var cacheKey = this._createKey(url, data);

        var time = this._doSelectQuery("select expires from local.cache where url='"+cacheKey+"';");
        if (time*1000 > Date.now()) {
            var res = this._fetchXML(url, poststring, cachekey);
            if (res)
                EVEURLS[type].xmlcb(res);

            time = Date.UTCFromEveTimeString(
                    evaluateXPath(res, "/eveapi/cachedUntil/text()")[0].data)/1000);
//            this._executeSimpleSQL("replace into local.cache values('"+cacheKey+"',"+time+");");
        }

        return this._doSelectQuery(query, cb);
    }

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
        var poststring = [i+'='+escape(data[i]) for (i in data)].join('&');
        var url = EVEAPIURL+EVEURLS[type].url;
        var cacheKey = this._createKey(url, data);
        var res = this._fetchXML(url, poststring, cacheKey);
        return res
            ? EVEURLS[type].xmlcb(res)
            : null;
    },

    _createKey:     function (url, data) {
        return url + '?stamp=' + this._makeHash(data);
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

    _fetchXML:    function (url, data, cacheKey) {
        var result;
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

    _executeSimpleSQL:  function (query) {
        dump("Executing "+query+"\n");
        this.conn.executeSimpleSQL(query);
    },

    _doSelectQuery:     function (query, recHandler, nodump) {
        var rv = [];
        if (!nodump)
            dump("Executing "+query+"\n");
        var statement = this.conn.createStatement(query);
        while (statement.executeStep()) {
            var c;
            var thisArray = [];
            for (c = 0; c < statement.numEntries; c++)
                thisArray.push(statement.getString(c));
            if (recHandler)
                recHandler(thisArray);
            if (thisArray.length)
                rv.push(thisArray);
        }
        statement.reset();
        return rv;
    },

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

