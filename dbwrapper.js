const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function dbwrapper() {
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
}

function iteminfo(name, group) {
    this._name = name;
    this._group = group;
}

dbwrapper.prototype = {
    classDescription:   "EVE Online static dump",
    classID:            Components.ID("{66575bef-61c0-4ea3-9c34-17c10870e6a9}"),
    contractID:         "@aragaer/eve/db;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveDBService]),
    _xpcom_categories: [{
        category: "profile-do-change",
        service: true
    }],

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


    getItemNameByType:  function (typeID) {
        return this._doSelectQuery("select typeName from invTypes where typeID='"+typeID+"';", null, true);
    },

    locationToString:   function (locationID) {
        switch (true) {
        case locationID == 0:
            return "";
        case locationID >= 66000000 && locationID < 67000000:
            locationID -= 6000001;
        case locationID >= 60000000 && locationID <= 61000000:
            return this._doSelectQuery("select stationName " +
                    "from staStations where stationID='"+locationID+"';", null, true);

        case locationID >= 67000000 && locationID < 68000000:
            locationID -= 6000000;
        case locationID >= 60014860 && locatioID <= 60014929:
        case locationID >= 61000000:
            return "Some conquerable outpost";

        default:
            return this._doSelectQuery("select solarSystemName from "+
                    " mapSolarSystems where solarSystemID='"+locationID+"';", null, true);
        };
    },

    getItemTypeInfo:    function(typeID) {
        var res = this._doSelectQuery("select typeName, groupID " +
                "from invTypes where typeID='"+typeID+"';", null, true)[0];
        return new iteminfo(res[0], res[1]);
    },
};

iteminfo.prototype = {
    classDescription:   "EVE Online Item type info",
    classID:            Components.ID("{97c4b53a-58c0-454c-af6e-38f86f93cc33}"),
    contractID:         "@aragaer/eve/item-info;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemInfo]),
    
    get name()      this._name,
    get group()   this._group,
};

var components = [dbwrapper, iteminfo];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

