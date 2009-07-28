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
}

var components = [dbwrapper];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

