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

    try {
        var file = Cc["@mozilla.org/file/directory_service;1"].
                getService(Ci.nsIProperties).get('ProfD', Ci.nsIFile);
        file.append('data');
        if (!file.exists())
            file.create(file.DIRECTORY_TYPE, 0777);

        file.append('api.db');
        if (!file.exists())
            file.create(file.NORMAL_FILE_TYPE, 0700);

        this._executeSimpleSQL("attach database '"+file.path+"' as local;");
    } catch (e) {
        dump(e.toString()+"\n");
        return;
    }

    try {
        this._doSelectQuery("select 1 from local.eveNames;");
    } catch (e) {
        this._executeSimpleSQL("CREATE TABLE local.eveNames " +
            "(itemID integer, itemName char, categoryID integer, " +
            "groupID integer, typeID integer, primary key (itemID));");
    }

    try {
        this._doSelectQuery("select 1 from local.starbaseConfig;");
    } catch (e) {
        this._executeSimpleSQL("CREATE TABLE local.starbaseConfig " +
            "(itemID integer, starbaseID integer, isOnline integer, " +
            "itemType integer, primary key (itemID));");
    }

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

    _getPropByProp:       function (prop1, prop2, table, nodump) {
        var query1 = "select "+prop1+" from "+table+" where "+prop2+"='"
        var query2 = "';";
        return function (id) {
            return this._doSelectQuery(query1+id+query2, null, nodump);
        }
    },

    setItemName:        function (id, name, category, group, type) {
        this._executeSimpleSQL("replace into local.eveNames values " +
            "('"+[id, name, category, group, type].join("', '")+"');");
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

    getControlTowerFuelRequirements:    function (id, out) {
        var res = [];
        this._doSelectQuery("select resourceTypeID, purpose, quantity " +
                "from invControlTowerResources " +
                "where controlTowerTypeID='"+id+"' and factionID is null;",
            function (a) {
                res.push({wrappedJSObject:{
                    typeid:     a[0],
                    purpose:    a[1],
                    usage:      a[2]
                }});
            }
        );

        out.value = res.length;
        return res;
    },
    getControlTowerFuelForSystem:       function (id, sys, out) {
        var res = [];
        var sysdata = this._doSelectQuery("select reg.factionID, sys.security " +
                "from mapSolarSystems as sys " +
                "left join mapRegions as reg on sys.regionID = reg.regionID " +
                "where sys.solarSystemID='"+sys+"';")[0];
        this._doSelectQuery("select resourceTypeID, purpose, quantity " +
                "from invControlTowerResources " +
                "where controlTowerTypeID='"+id+"' " +
                "and factionID='"+sysdata[0]+"' and minSecurityLevel<"+sysdata[1]+";",
            function (a) {
                res.push({wrappedJSObject: {
                    typeid:     a[0],
                    purpose:    a[1],
                    usage:      a[2]
                }});
            }
        );

        out.value = res.length;
        return res;
    },
    getGridAndCPUForTower:      function (type) {
        var res = this._doSelectQuery("select a11.valueInt, a48.valueInt " +
                "from invTypes as t " +
                "left join dgmTypeAttributes as a48 on t.typeID = a48.typeID " +
                "left join dgmTypeAttributes as a11 on t.typeID = a11.typeID " +
                "where t.typeID='"+type+"' " +
                "and a11.attributeID=11 and a48.attributeID=48;")[0];
        return {wrappedJSObject : { grid : +res[0], cpu : +res[1]} };
    },


    getGridAndCPUUsage:         function (towerID) {
        var res = this._doSelectQuery("select sum(a30.valueInt), sum(a50.valueInt) " +
                "from local.starbaseConfig as lsc " +
                "left join dgmTypeAttributes as a30 on lsc.itemType = a30.typeID " +
                "left join dgmTypeAttributes as a50 on lsc.itemType = a50.typeID " +
                "where lsc.starbaseID='"+towerID+"' " +
                "and a30.attributeID=30 and a50.attributeID=50;")[0];
        return {wrappedJSObject : { grid : +res[0], cpu : +res[1]} };
    },
};
dbwrapper.prototype.getItemTypeNameByID     = dbwrapper.prototype._getPropByProp('typeName', 'typeID', 'invTypes',              true);
dbwrapper.prototype.getItemGroupNameByID    = dbwrapper.prototype._getPropByProp('groupName', 'groupID', 'invGroups',           true);
dbwrapper.prototype.getItemCategoryNameByID = dbwrapper.prototype._getPropByProp('categoryName', 'categoryID', 'invCategories', true);
dbwrapper.prototype.getItemGroupByType      = dbwrapper.prototype._getPropByProp('groupID', 'typeID', 'invTypes',               true);
dbwrapper.prototype.getItemCategoryByGroup  = dbwrapper.prototype._getPropByProp('categoryID', 'groupID', 'invGroups',          true);
dbwrapper.prototype.getItemName             = dbwrapper.prototype._getPropByProp('itemName', 'itemID', 'local.eveNames',        true);

var components = [dbwrapper];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

